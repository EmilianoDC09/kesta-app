import fs from 'node:fs';
import path from 'node:path';
import { PoolClient } from 'pg';
import { pool } from '../db';
import { normalizarTexto } from './transformar';

interface PresentacionCatalogo {
    categoria: string;
    producto: string;
    marca: string;
    descripcion: string;
    cantidad: number;
    unidad: string;
    registros: number;
}

interface CatalogoProfeco {
    presentaciones: PresentacionCatalogo[];
}

const nombresUnidades: Record<string, string> = {
    g: 'Gramo',
    ml: 'Mililitro',
    pza: 'Pieza',
    rollo: 'Rollo',
    manojo: 'Manojo'
};

async function obtenerOCrear(
    client: PoolClient,
    tabla: 'categorias' | 'marcas',
    nombre: string
): Promise<number> {

    const existente = await client.query(
        `SELECT id FROM ${tabla}
         WHERE LOWER(unaccent(TRIM(nombre))) = $1`,
        [normalizarTexto(nombre)]
    );

    if (existente.rows.length > 1) {
        throw new Error(`Coincidencia ambigua: ${tabla} - ${nombre}`);
    }

    if (existente.rows.length === 1) {
        return existente.rows[0].id;
    }

    const nuevo = await client.query(
        `INSERT INTO ${tabla} (nombre)
         VALUES ($1) RETURNING id`,
        [nombre]
    );

    return nuevo.rows[0].id;
}

async function cargarCatalogo(): Promise<void> {

    const archivo = path.resolve(
        process.cwd(),
        'datos',
        'catalogo_profeco.json'
    );

    const catalogo: CatalogoProfeco = JSON.parse(
        fs.readFileSync(archivo, 'utf8')
    );

    const aplicar = process.argv.includes('--aplicar');

    const client = await pool.connect();

    const categorias = new Set<number>();
    const marcas = new Set<number>();
    const unidades = new Set<number>();
    const productos = new Set<number>();
    const presentaciones = new Set<number>();

    let nuevas = 0;
    let existentes = 0;

    try {

        await client.query('BEGIN');

        await client.query(`
            LOCK TABLE categorias, marcas, unidades,
            productos, presentaciones
            IN SHARE ROW EXCLUSIVE MODE
        `);

        console.log(
            aplicar
                ? 'Iniciando carga del catalogo...'
                : 'Iniciando simulacion del catalogo...'
        );

        for (const item of catalogo.presentaciones) {

            if (
                !item.producto?.trim() ||
                !item.categoria?.trim() ||
                !item.marca?.trim() ||
                !item.descripcion?.trim() ||
                !Number.isFinite(item.cantidad) ||
                item.cantidad <= 0 ||
                !nombresUnidades[item.unidad]
            ) {
                throw new Error(
                    `Presentacion invalida: ${JSON.stringify(item)}`
                );
            }

            // 1. Categoria
            const categoriaId = await obtenerOCrear(
                client,
                'categorias',
                item.categoria
            );

            categorias.add(categoriaId);

            // 2. Marca
            const marcaId = await obtenerOCrear(
                client,
                'marcas',
                item.marca
            );

            marcas.add(marcaId);

            // 3. Unidad
            let unidad = await client.query(
                `SELECT id FROM unidades
                 WHERE LOWER(abreviatura) = $1`,
                [item.unidad]
            );

            if (unidad.rows.length > 1) {
                throw new Error(`Unidad duplicada: ${item.unidad}`);
            }

            if (unidad.rows.length === 0) {

                unidad = await client.query(
                    `INSERT INTO unidades (nombre, abreviatura)
                     VALUES ($1, $2)
                     RETURNING id`,
                    [
                        nombresUnidades[item.unidad],
                        item.unidad
                    ]
                );
            }

            const unidadId = unidad.rows[0].id;
            unidades.add(unidadId);

            // 4. Producto
            let producto = await client.query(
                `SELECT id, categoria_id FROM productos
                 WHERE LOWER(unaccent(TRIM(nombre))) = $1`,
                [normalizarTexto(item.producto)]
            );

            if (producto.rows.length > 1) {
                throw new Error(
                    `Producto ambiguo: ${item.producto}`
                );
            }

            if (producto.rows.length === 0) {

                producto = await client.query(
                    `INSERT INTO productos (nombre, categoria_id)
                     VALUES ($1, $2)
                     RETURNING id, categoria_id`,
                    [item.producto, categoriaId]
                );

            } else if (
                producto.rows[0].categoria_id !== categoriaId
            ) {

                throw new Error(
                    `Conflicto de categoria: ${item.producto}`
                );
            }

            const productoId = producto.rows[0].id;
            productos.add(productoId);

            // 5. Presentacion
            let presentacion = await client.query(
                `SELECT id FROM presentaciones
                 WHERE producto_id = $1
                   AND marca_id = $2
                   AND unidad_id = $3
                   AND cantidad = $4
                   AND LOWER(unaccent(TRIM(descripcion))) = $5`,
                [
                    productoId,
                    marcaId,
                    unidadId,
                    item.cantidad,
                    normalizarTexto(item.descripcion)
                ]
            );

            if (presentacion.rows.length > 1) {
                throw new Error(
                    `Presentacion duplicada: ${item.descripcion}`
                );
            }

            if (presentacion.rows.length === 0) {

                presentacion = await client.query(
                    `INSERT INTO presentaciones
                     (
                        producto_id,
                        marca_id,
                        cantidad,
                        unidad_id,
                        descripcion
                     )
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id`,
                    [
                        productoId,
                        marcaId,
                        item.cantidad,
                        unidadId,
                        item.descripcion
                    ]
                );

                nuevas++;

            } else {

                existentes++;
            }

            presentaciones.add(presentacion.rows[0].id);
        }

        console.log('\n--- RESULTADOS DEL CATALOGO ---');

        console.table({
            categorias: categorias.size,
            marcas: marcas.size,
            unidades: unidades.size,
            productos: productos.size,
            presentaciones: presentaciones.size,
            presentaciones_nuevas: nuevas,
            presentaciones_existentes: existentes
        });

        if (aplicar) {

            await client.query('COMMIT');
            console.log('\nCatalogo guardado correctamente.');

        } else {

            await client.query('ROLLBACK');
            console.log('\nSimulacion completada.');
            console.log('No se guardaron registros del catalogo.');
        }

    } catch (error) {

        await client.query('ROLLBACK');
        throw error;

    } finally {

        client.release();
    }
}

cargarCatalogo()
    .catch((error: Error) => {
        console.error('Error de carga:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });