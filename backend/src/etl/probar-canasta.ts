import { extraerDatos } from './extraer';
import {
    productosCanasta,
    perteneceCanasta,
    obtenerProductoCanonico
} from './canasta';
import { transformarRegistro } from './transformar';
import { normalizarPresentacion } from './unidades';

interface EstadisticaProducto {
    producto: string;
    registros: number;
    normalizados: number;
    pendientes: number;
    invalidos: number;
}

async function probarCanasta(): Promise<void> {

    console.log('Probando canasta basica de Kesta...');

    let originales = 0;
    let seleccionados = 0;
    let fueraSeleccion = 0;
    let normalizados = 0;
    let pendientes = 0;
    let invalidos = 0;

    const estadisticas = new Map<
        string,
        EstadisticaProducto
    >();

    const presentacionesPendientes = new Map<
        string,
        Set<string>
    >();

    // 1. Inicializar los productos canonicos.
    for (const producto of productosCanasta) {

        estadisticas.set(producto, {
            producto,
            registros: 0,
            normalizados: 0,
            pendientes: 0,
            invalidos: 0
        });
    }

    // 2. Leer los registros originales.
    for await (const registro of extraerDatos()) {

        originales++;

        if (!perteneceCanasta(
            registro.producto,
            registro.catalogo
        )) {
            fueraSeleccion++;
            continue;
        }

        // 3. Resolver el nombre canonico.
        const productoCanonico = obtenerProductoCanonico(
            registro.producto
        );

        if (!productoCanonico) {
            fueraSeleccion++;
            continue;
        }

        const estadistica = estadisticas.get(
            productoCanonico
        );

        if (!estadistica) {
            throw new Error(
                `Producto canonico no registrado: ${productoCanonico}`
            );
        }

        seleccionados++;
        estadistica.registros++;

        // 4. Validar el registro.
        const resultado = transformarRegistro(registro);

        if (!resultado.valido) {

            invalidos++;
            estadistica.invalidos++;
            continue;
        }

        // 5. Normalizar la presentacion.
        const presentacion = normalizarPresentacion(
            registro.presentacion
        );

        if (!presentacion) {

            pendientes++;
            estadistica.pendientes++;

            if (!presentacionesPendientes.has(
                productoCanonico
            )) {
                presentacionesPendientes.set(
                    productoCanonico,
                    new Set<string>()
                );
            }

            presentacionesPendientes
                .get(productoCanonico)!
                .add(registro.presentacion);

            continue;
        }

        normalizados++;
        estadistica.normalizados++;
    }

    // 6. Mostrar resultados generales.
    console.log('\n--- RESULTADOS GENERALES ---');

    console.log(`Registros originales: ${originales}`);
    console.log(`Registros seleccionados: ${seleccionados}`);
    console.log(`Registros fuera de seleccion: ${fueraSeleccion}`);
    console.log(`Registros normalizados: ${normalizados}`);
    console.log(`Pendientes de revision: ${pendientes}`);
    console.log(`Registros invalidos: ${invalidos}`);

    // 7. Mostrar resultados por producto.
    console.log('\n--- RESULTADOS POR PRODUCTO ---');

    console.table([...estadisticas.values()]);

    // 8. Mostrar presentaciones pendientes.
    console.log('\n--- PRESENTACIONES PENDIENTES ---');

    for (const [
        producto,
        presentaciones
    ] of presentacionesPendientes) {

        console.log(`\n${producto}:`);

        for (const presentacion of
            [...presentaciones].slice(0, 5)) {

            console.log(` - ${presentacion}`);
        }
    }

    const productosEncontrados = [
        ...estadisticas.values()
    ].filter(
        producto => producto.registros > 0
    ).length;

    const productosNormalizados = [
        ...estadisticas.values()
    ].filter(
        producto => producto.normalizados > 0
    ).length;

    console.log(
        `\nProductos encontrados: ${productosEncontrados}`
    );

    console.log(
        `Productos con unidades reconocidas: ${productosNormalizados}`
    );

    console.log('\nPrueba finalizada.');
}

probarCanasta().catch((error: Error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
});