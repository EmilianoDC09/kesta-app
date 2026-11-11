import { pool } from '../db';
import { mapearProducto } from './mapear';
import { extraerDatos } from './extraer';
import { perteneceCanasta } from './canasta';
import { normalizarPresentacion } from './unidades';

async function probarMapeo(): Promise<void> {

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        console.log('Iniciando prueba de mapeo...');

        for await (const registro of extraerDatos()) {

            if (!perteneceCanasta(
                registro.producto,
                registro.catalogo
            )) {
                continue;
            }

            if (!normalizarPresentacion(
                registro.presentacion
            )) {
                continue;
            }

            const original = await mapearProducto(
                client,
                registro
            );

            if (!original.vinculado) {
                continue;
            }

            console.log('\n--- PRESENTACION ORIGINAL ---');
            console.log(original);

            // Crear una presentacion de prueba.
            const registroPrueba = {
                ...registro,
                presentacion:
                    registro.presentacion +
                    ' PRUEBA AUTOMATICA KESTA'
            };

            const nueva = await mapearProducto(
                client,
                registroPrueba
            );

            console.log('\n--- PRESENTACION NUEVA ---');
            console.log(nueva);

            if (!nueva.vinculado || !nueva.creada) {

                throw new Error(
                    'No se creo la presentacion nueva'
                );
            }

            // Repetir el mapeo.
            const repetida = await mapearProducto(
                client,
                registroPrueba
            );

            console.log('\n--- PRESENTACION REPETIDA ---');
            console.log(repetida);

            if (
                !repetida.vinculado ||
                repetida.creada ||
                repetida.presentacionId !==
                    nueva.presentacionId
            ) {

                throw new Error(
                    'La presentacion no se reutilizo correctamente'
                );
            }

            console.log('\n--- RESULTADO ---');
            console.log('Creacion automatica: CORRECTA');
            console.log('Prevencion de duplicados: CORRECTA');

            await client.query('ROLLBACK');

            console.log('\nPrueba completada correctamente.');
            console.log('No se guardaron datos de prueba.');

            return;
        }

        throw new Error(
            'No se encontro un registro adecuado para la prueba'
        );

    } catch (error) {

        await client.query('ROLLBACK');
        throw error;

    } finally {

        client.release();
    }
}

probarMapeo()
    .catch((error: Error) => {

        console.error('Error:', error.message);
        process.exitCode = 1;

    })
    .finally(async () => {

        await pool.end();

    });