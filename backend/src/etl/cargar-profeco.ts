import { createHash } from 'node:crypto';
import { PoolClient } from 'pg';

import { pool } from '../db';
import { extraerDatos } from './extraer';
import { mapearProducto } from './mapear';

import {
    RegistroProfeco,
    transformarRegistro,
    normalizarTexto
} from './transformar';

interface Contadores {
    leidas: number;
    cargadas: number;
    duplicadas: number;
    sin_vincular: number;
    descartadas: number;
}

// 1. Generar una clave unica por observacion.
function generarClave(registro: RegistroProfeco): string {

    const datos = [
        'profeco',
        normalizarTexto(registro.producto),
        normalizarTexto(registro.marca),
        normalizarTexto(registro.presentacion),
        normalizarTexto(registro.cadena_comercial),
        normalizarTexto(registro.nombre_comercial),
        normalizarTexto(registro.direccion),
        normalizarTexto(registro.estado),
        normalizarTexto(registro.municipio),
        registro.fecha_registro.trim().replace(/\//g, '-'),
        Number(registro.precio)
    ];

    return createHash('sha256')
        .update(JSON.stringify(datos))
        .digest('hex');
}

// 2. Obtener o registrar la fuente.
async function obtenerFuente(
    client: PoolClient
): Promise<number> {

    const resultado = await client.query(`
        SELECT id
        FROM fuentes
        WHERE LOWER(TRIM(nombre)) IN (
            'profeco',
            'profeco qqp'
        )
        AND LOWER(TRIM(tipo)) = 'profeco'
    `);

    if (resultado.rows.length > 1) {
        throw new Error('Existen fuentes Profeco duplicadas');
    }

    if (resultado.rows.length === 1) {
        return resultado.rows[0].id;
    }

    const nueva = await client.query(`
        INSERT INTO fuentes (nombre, tipo)
        VALUES ('Profeco', 'profeco')
        RETURNING id
    `);

    return nueva.rows[0].id;
}

// 3. Obtener o registrar el comercio.
async function obtenerComercio(
    client: PoolClient,
    registro: RegistroProfeco
): Promise<number> {

    const nombre =
        registro.cadena_comercial.trim() ||
        registro.nombre_comercial.trim();

    if (!nombre) {
        throw new Error('Comercio sin nombre');
    }

    const resultado = await client.query(`
        SELECT id
        FROM comercios
        WHERE LOWER(
            unaccent(
                TRIM(
                    regexp_replace(
                        nombre,
                        '[[:space:]]+',
                        ' ',
                        'g'
                    )
                )
            )
        ) = $1
    `, [normalizarTexto(nombre)]);

    if (resultado.rows.length > 1) {
        throw new Error(`Comercio ambiguo: ${nombre}`);
    }

    if (resultado.rows.length === 1) {
        return resultado.rows[0].id;
    }

    const nuevo = await client.query(`
        INSERT INTO comercios (nombre, tipo)
        VALUES ($1, 'Formal')
        RETURNING id
    `, [nombre]);

    return nuevo.rows[0].id;
}

// 4. Obtener o registrar la ubicacion.
async function obtenerUbicacion(
    client: PoolClient,
    comercioId: number,
    registro: RegistroProfeco
): Promise<number | null> {

    const direccion = registro.direccion.trim();

    if (!direccion) {
        return null;
    }

    const existente = await client.query(`
        SELECT id
        FROM ubicaciones_comercio
        WHERE comercio_id = $1
          AND LOWER(
              unaccent(
                  TRIM(
                      regexp_replace(
                          direccion,
                          '[[:space:]]+',
                          ' ',
                          'g'
                      )
                  )
              )
          ) = $2
    `, [
        comercioId,
        normalizarTexto(direccion)
    ]);

    if (existente.rows.length > 1) {
        throw new Error(
            `Ubicacion ambigua: ${direccion}`
        );
    }

    if (existente.rows.length === 1) {
        return existente.rows[0].id;
    }

    const latitud = Number(registro.latitud);
    const longitud = Number(registro.longitud);

    const coordenadasValidas =
        registro.latitud.trim() !== '' &&
        registro.longitud.trim() !== '' &&
        Number.isFinite(latitud) &&
        Number.isFinite(longitud) &&
        latitud >= -90 &&
        latitud <= 90 &&
        longitud >= -180 &&
        longitud <= 180;

    const nueva = await client.query(`
        INSERT INTO ubicaciones_comercio (
            comercio_id,
            direccion,
            ubicacion,
            estado_verificacion,
            referencia
        )
        VALUES (
            $1,
            $2,
            CASE
                WHEN $3::double precision IS NOT NULL
                 AND $4::double precision IS NOT NULL
                THEN ST_SetSRID(
                    ST_MakePoint($4, $3),
                    4326
                )::geography
                ELSE NULL
            END,
            'Pendiente',
            $5
        )
        RETURNING id
    `, [
        comercioId,
        direccion,
        coordenadasValidas ? latitud : null,
        coordenadasValidas ? longitud : null,
        registro.nombre_comercial.trim()
    ]);

    return nueva.rows[0].id;
}

// 5. Registrar productos sin vincular.
async function guardarExterno(
    client: PoolClient,
    ejecucionId: number,
    fuenteId: number,
    clave: string,
    registro: RegistroProfeco,
    motivo: string
): Promise<boolean> {

    const resultado = await client.query(`
        INSERT INTO productos_externos (
            ejecucion_id,
            fuente_id,
            clave_origen,
            producto,
            marca,
            presentacion,
            categoria,
            precio,
            fecha_obtencion,
            comercio,
            sucursal,
            direccion,
            latitud,
            longitud,
            motivo,
            datos_originales
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15, $16
        )
        ON CONFLICT (clave_origen)
        DO NOTHING
        RETURNING id
    `, [
        ejecucionId,
        fuenteId,
        clave,
        registro.producto,
        registro.marca,
        registro.presentacion,
        registro.categoria,
        Number(registro.precio),
        registro.fecha_registro.replace(/\//g, '-'),
        registro.cadena_comercial,
        registro.nombre_comercial,
        registro.direccion,
        registro.latitud.trim() &&
            Number.isFinite(Number(registro.latitud)) &&
            Math.abs(Number(registro.latitud)) <= 90
            ? Number(registro.latitud)
            : null,
        registro.longitud.trim() &&
            Number.isFinite(Number(registro.longitud)) &&
            Math.abs(Number(registro.longitud)) <= 180
            ? Number(registro.longitud)
            : null,
        motivo,
        JSON.stringify(registro)
    ]);

    return resultado.rows.length === 1;
}

// 6. Registrar datos invalidos.
async function guardarDescarte(
    client: PoolClient,
    ejecucionId: number,
    clave: string,
    registro: RegistroProfeco,
    motivo: string
): Promise<void> {

    await client.query(`
        INSERT INTO descartes_ingesta (
            ejecucion_id,
            clave_origen,
            motivo,
            datos_originales
        )
        VALUES ($1, $2, $3, $4)
    `, [
        ejecucionId,
        clave,
        motivo,
        JSON.stringify(registro)
    ]);
}

// 7. Ejecutar el pipeline completo.
async function cargarProfeco(): Promise<void> {

    const aplicar = process.argv.includes('--aplicar');

    const client = await pool.connect();

    const contadores: Contadores = {
        leidas: 0,
        cargadas: 0,
        duplicadas: 0,
        sin_vincular: 0,
        descartadas: 0
    };

    const motivos = new Map<string, number>();

    let ejecucionId: number | null = null;

    try {

        // Registrar la ejecucion.
        if (aplicar) {

            const ejecucion = await client.query(`
                INSERT INTO ejecuciones_ingesta (
                    tipo,
                    origen,
                    estado
                )
                VALUES (
                    'profeco',
                    'QQP_Morelia_2026.csv',
                    'en_proceso'
                )
                RETURNING id
            `);

            ejecucionId = ejecucion.rows[0].id;
        }

        await client.query('BEGIN');

        // Evitar ejecuciones simultaneas de este ETL.
        await client.query(`
            SELECT pg_advisory_xact_lock(51001)
        `);

        await client.query(`
            LOCK TABLE fuentes, comercios,
                ubicaciones_comercio
            IN SHARE ROW EXCLUSIVE MODE
        `);

        if (!aplicar) {

            const ejecucion = await client.query(`
                INSERT INTO ejecuciones_ingesta (
                    tipo,
                    origen,
                    estado
                )
                VALUES (
                    'profeco',
                    'QQP_Morelia_2026.csv',
                    'en_proceso'
                )
                RETURNING id
            `);

            ejecucionId = ejecucion.rows[0].id;
        }

        const idEjecucion = ejecucionId!;

        const fuenteId = await obtenerFuente(client);

        console.log(
            aplicar
                ? 'Iniciando carga real de Profeco...'
                : 'Iniciando simulacion de Profeco...'
        );

        // Procesar cada registro del CSV.
        for await (const registro of extraerDatos()) {

            contadores.leidas++;

            const clave = generarClave(registro);

            const resultado = transformarRegistro(registro);

            // Registrar datos invalidos.
            if (!resultado.valido) {

                await guardarDescarte(
                    client,
                    idEjecucion,
                    clave,
                    registro,
                    resultado.motivo
                );

                contadores.descartadas++;

                motivos.set(
                    resultado.motivo,
                    (motivos.get(resultado.motivo) ?? 0) + 1
                );

                continue;
            }

            // Verificar si el precio ya existe.
            const duplicado = await client.query(`
                SELECT id
                FROM precios
                WHERE clave_origen = $1
            `, [clave]);

            if (duplicado.rows.length > 0) {

                contadores.duplicadas++;
                continue;
            }

            // Vincular con el catalogo interno.
            const mapeo = await mapearProducto(
                client,
                registro
            );

            if (!mapeo.vinculado) {

                const insertado = await guardarExterno(
                    client,
                    idEjecucion,
                    fuenteId,
                    clave,
                    registro,
                    mapeo.motivo
                );

                if (insertado) {

                    contadores.sin_vincular++;

                    motivos.set(
                        mapeo.motivo,
                        (motivos.get(mapeo.motivo) ?? 0) + 1
                    );

                } else {

                    contadores.duplicadas++;
                }

                continue;
            }

            // No inventar establecimientos.
            if (
                !registro.cadena_comercial.trim() &&
                !registro.nombre_comercial.trim()
            ) {

                await guardarDescarte(
                    client,
                    idEjecucion,
                    clave,
                    registro,
                    'Comercio sin nombre'
                );

                contadores.descartadas++;
                continue;
            }

            const comercioId = await obtenerComercio(
                client,
                registro
            );

            const ubicacionId = await obtenerUbicacion(
                client,
                comercioId,
                registro
            );

            // Insertar el precio real.
            const precio = await client.query(`
                INSERT INTO precios (
                    presentacion_id,
                    comercio_id,
                    ubicacion_id,
                    fuente_id,
                    precio,
                    fecha_obtencion,
                    estado_verificacion,
                    clave_origen,
                    ejecucion_id
                )
                VALUES (
                    $1, $2, $3, $4,
                    $5, $6, 'Activo',
                    $7, $8
                )
                ON CONFLICT (clave_origen)
                DO NOTHING
                RETURNING id
            `, [
                mapeo.presentacionId,
                comercioId,
                ubicacionId,
                fuenteId,
                resultado.datos.precio,
                resultado.datos.fecha,
                clave,
                idEjecucion
            ]);

            if (precio.rows.length === 1) {

                contadores.cargadas++;

                await client.query(`
                    UPDATE productos_externos
                    SET estado = 'vinculado',
                        presentacion_id = $2,
                        vinculado_en = NOW()
                    WHERE clave_origen = $1
                      AND estado = 'pendiente'
                `, [
                    clave,
                    mapeo.presentacionId
                ]);

            } else {

                contadores.duplicadas++;
            }

            if (contadores.cargadas > 0 &&
                contadores.cargadas % 1000 === 0 &&
                precio.rows.length === 1) {

                console.log(
                    `Precios procesados: ${contadores.cargadas}`
                );
            }
        }

        // Registrar los resultados de la ejecucion.
        await client.query(`
            UPDATE ejecuciones_ingesta
            SET fin = NOW(),
                estado = 'completada',
                leidas = $2,
                cargadas = $3,
                duplicadas = $4,
                sin_vincular = $5,
                descartadas = $6,
                detalle = $7
            WHERE id = $1
        `, [
            idEjecucion,
            contadores.leidas,
            contadores.cargadas,
            contadores.duplicadas,
            contadores.sin_vincular,
            contadores.descartadas,
            JSON.stringify(
                Object.fromEntries(motivos)
            )
        ]);

        console.log('\n--- RESULTADOS DEL ETL ---');

        console.table(contadores);

        console.log('\n--- MOTIVOS DE NO VINCULACION ---');

        console.table(
            Object.fromEntries(motivos)
        );

        if (aplicar) {

            await client.query('COMMIT');

            console.log(
                '\nCarga de Profeco completada correctamente.'
            );

        } else {

            await client.query('ROLLBACK');

            console.log('\nSimulacion completada.');
            console.log('No se guardaron registros.');
        }

    } catch (error) {

        await client.query('ROLLBACK');

        if (aplicar && ejecucionId !== null) {

            await client.query(`
                UPDATE ejecuciones_ingesta
                SET estado = 'fallida',
                    fin = NOW(),
                    error = $2
                WHERE id = $1
            `, [
                ejecucionId,
                (error as Error).message
            ]);
        }

        throw error;

    } finally {

        client.release();
    }
}

cargarProfeco()
    .catch((error: Error) => {
        console.error('Error del ETL:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });