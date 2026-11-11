import fs from 'node:fs';
import path from 'node:path';
import { normalizarTexto } from './transformar';

interface ProductoCanonico {
    canonico: string;
    alias: string[];
}

interface MapeoCanasta {
    version: string;
    fuente: string;
    municipio: string;
    estado: string;
    productos: ProductoCanonico[];
}

// 1. Leer el archivo de mapeo.
const archivoMapeo = path.resolve(
    process.cwd(),
    'src',
    'etl',
    'mapeo-canasta.json'
);

const mapeo: MapeoCanasta = JSON.parse(
    fs.readFileSync(archivoMapeo, 'utf8')
);

// 2. Obtener los productos canonicos.
export const productosCanasta = mapeo.productos.map(
    producto => producto.canonico
);

// 3. Construir el indice de alias.
const indiceAlias = new Map<string, string>();

for (const producto of mapeo.productos) {

    const nombres = [
        producto.canonico,
        ...producto.alias
    ];

    for (const nombre of nombres) {

        const clave = normalizarTexto(nombre);
        const existente = indiceAlias.get(clave);

        if (
            existente &&
            existente !== producto.canonico
        ) {
            throw new Error(
                `Alias ambiguo: ${nombre}`
            );
        }

        indiceAlias.set(
            clave,
            producto.canonico
        );
    }
}

// 4. Catalogos permitidos de Profeco.
const catalogosPermitidos = new Set([
    'basicos',
    'frutas y legumbres',
    'pacic',
    'mercados',
    'pescados y mariscos'
]);

// 5. Obtener el nombre canonico.
export function obtenerProductoCanonico(
    producto: string
): string | null {

    return indiceAlias.get(
        normalizarTexto(producto)
    ) ?? null;
}

// 6. Comprobar si pertenece a la canasta.
export function perteneceCanasta(
    producto: string,
    catalogo: string
): boolean {

    return (
        obtenerProductoCanonico(producto) !== null &&
        catalogosPermitidos.has(
            normalizarTexto(catalogo)
        )
    );
}