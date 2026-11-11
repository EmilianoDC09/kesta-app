import { PoolClient } from 'pg';

import {
    RegistroProfeco,
    normalizarTexto
} from './transformar';

import {
    obtenerProductoCanonico,
    perteneceCanasta
} from './canasta';

import {
    normalizarPresentacion
} from './unidades';

export type ResultadoMapeo =
    | {
        vinculado: true;
        productoId: number;
        presentacionId: number;
        creada?: boolean;
    }
    | {
        vinculado: false;
        motivo: string;
    };

// Normalizacion de texto en PostgreSQL.
function textoSQL(columna: string): string {

    return `
        LOWER(
            unaccent(
                TRIM(
                    regexp_replace(
                        ${columna},
                        '[[:space:]]+',
                        ' ',
                        'g'
                    )
                )
            )
        )
    `;
}

export async function mapearProducto(
    client: PoolClient,
    registro: RegistroProfeco
): Promise<ResultadoMapeo> {

    // 1. Identificar el producto canonico.
    const canonico = obtenerProductoCanonico(
        registro.producto
    );

    if (!canonico) {

        return {
            vinculado: false,
            motivo: 'Producto fuera del mapeo de canasta'
        };
    }

    if (!perteneceCanasta(
        registro.producto,
        registro.catalogo
    )) {

        return {
            vinculado: false,
            motivo: 'Catalogo de Profeco fuera de seleccion'
        };
    }

    // 2. Normalizar los datos.
    const producto = normalizarTexto(canonico);

    const marca = normalizarTexto(
        registro.marca
    );

    const descripcion = normalizarTexto(
        registro.presentacion
    );

    const unidad = normalizarPresentacion(
        registro.presentacion
    );

    if (!unidad) {

        return {
            vinculado: false,
            motivo: 'Presentacion pendiente de normalizacion'
        };
    }

    if (!marca || !descripcion) {

        return {
            vinculado: false,
            motivo: 'Marca o descripcion incompleta'
        };
    }

    // 3. Buscar el producto interno.
    const productos = await client.query(`
        SELECT id
        FROM productos
        WHERE ${textoSQL('nombre')} = $1
    `, [producto]);

    if (productos.rows.length !== 1) {

        return {
            vinculado: false,
            motivo: productos.rows.length === 0
                ? 'Producto no registrado en Kesta'
                : 'Producto ambiguo en Kesta'
        };
    }

    const productoId = productos.rows[0].id;

    // 4. Buscar la marca interna.
    const marcas = await client.query(`
        SELECT id
        FROM marcas
        WHERE ${textoSQL('nombre')} = $1
    `, [marca]);

    if (marcas.rows.length !== 1) {

        return {
            vinculado: false,
            motivo: marcas.rows.length === 0
                ? 'Marca no registrada en Kesta'
                : 'Marca ambigua en Kesta'
        };
    }

    const marcaId = marcas.rows[0].id;

    // 5. Evitar creaciones simultaneas.
    // Debe ejecutarse dentro de una transaccion.
    await client.query(`
        SELECT pg_advisory_xact_lock(
            $1::integer,
            $2::integer
        )
    `, [productoId, marcaId]);

    // 6. Buscar la presentacion existente.
    const existentes = await client.query(`
        SELECT pr.id

        FROM presentaciones pr

        INNER JOIN unidades u
            ON u.id = pr.unidad_id

        WHERE pr.producto_id = $1

          AND pr.marca_id = $2

          AND ${textoSQL('pr.descripcion')} = $3

          AND (
              CASE
                  WHEN LOWER(u.abreviatura) = 'kg'
                      THEN pr.cantidad * 1000

                  WHEN LOWER(u.abreviatura) = 'l'
                      THEN pr.cantidad * 1000

                  ELSE pr.cantidad
              END
          ) = $4

          AND (
              CASE
                  WHEN LOWER(u.abreviatura) = 'kg'
                      THEN 'g'

                  WHEN LOWER(u.abreviatura) = 'l'
                      THEN 'ml'

                  ELSE LOWER(u.abreviatura)
              END
          ) = $5
    `, [
        productoId,
        marcaId,
        descripcion,
        unidad.cantidad,
        unidad.unidad
    ]);

    if (existentes.rows.length > 1) {

        return {
            vinculado: false,
            motivo: 'Multiples coincidencias en el catalogo'
        };
    }

    if (existentes.rows.length === 1) {

        return {
            vinculado: true,
            productoId,
            presentacionId: existentes.rows[0].id,
            creada: false
        };
    }

    // 7. Confirmar que la marca ya esta asociada
    // al producto dentro del catalogo.
    const asociacion = await client.query(`
        SELECT id
        FROM presentaciones
        WHERE producto_id = $1
          AND marca_id = $2
        LIMIT 1
    `, [
        productoId,
        marcaId
    ]);

    if (asociacion.rows.length === 0) {

        return {
            vinculado: false,
            motivo: 'Marca sin asociacion previa con el producto'
        };
    }

    // 8. Buscar la unidad normalizada.
    const unidades = await client.query(`
        SELECT id
        FROM unidades
        WHERE LOWER(TRIM(abreviatura)) = $1
    `, [unidad.unidad]);

    if (unidades.rows.length !== 1) {

        return {
            vinculado: false,
            motivo: unidades.rows.length === 0
                ? 'Unidad no registrada en Kesta'
                : 'Unidad ambigua en Kesta'
        };
    }

    const unidadId = unidades.rows[0].id;

    // 9. Comprobar que la cantidad puede
    // almacenarse sin perder precision.
    if (
        !Number.isFinite(unidad.cantidad) ||
        unidad.cantidad <= 0 ||
        unidad.cantidad > 99999999.99 ||
        Math.abs(
            unidad.cantidad * 100 -
            Math.round(unidad.cantidad * 100)
        ) > 0.000001
    ) {

        return {
            vinculado: false,
            motivo: 'Cantidad incompatible con el catalogo'
        };
    }

    // 10. Crear la presentacion faltante.
    const nueva = await client.query(`
        INSERT INTO presentaciones (
            producto_id,
            marca_id,
            cantidad,
            unidad_id,
            descripcion
        )
        VALUES (
            $1, $2, $3, $4, $5
        )
        RETURNING id
    `, [
        productoId,
        marcaId,
        unidad.cantidad,
        unidadId,
        registro.presentacion.trim()
    ]);

    return {
        vinculado: true,
        productoId,
        presentacionId: nueva.rows[0].id,
        creada: true
    };
}