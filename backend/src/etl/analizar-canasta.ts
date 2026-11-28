import { extraerDatos } from './extraer';
import { normalizarTexto } from './transformar';

const catalogosPermitidos = new Set([
  'basicos',
  'frutas y legumbres',
  'pacic',
  'mercados',
  'pescados y mariscos'
]);

async function analizarCanasta(): Promise<void> {
  console.log('Identificando productos candidatos...\n');

  const productos = new Map<
    string,
    {
      producto: string;
      categoria: string;
      registros: number;
      presentaciones: Set<string>;
    }
  >();

  let total = 0;

  for await (const registro of extraerDatos()) {

    const catalogo = normalizarTexto(registro.catalogo);

    if (!catalogosPermitidos.has(catalogo)) {
      continue;
    }

    total++;

    const clave = normalizarTexto(registro.producto);

    if (!productos.has(clave)) {
      productos.set(clave, {
        producto: registro.producto,
        categoria: registro.categoria,
        registros: 0,
        presentaciones: new Set<string>()
      });
    }

    const producto = productos.get(clave)!;

    producto.registros++;
    producto.presentaciones.add(registro.presentacion);
  }

  const resultados = [...productos.values()]
    .sort((a, b) => a.producto.localeCompare(b.producto))
    .map((p) => ({
      producto: p.producto,
      categoria: p.categoria,
      registros: p.registros,
      presentaciones: p.presentaciones.size
    }));

  console.log('--- PRODUCTOS CANDIDATOS ---');

  console.table(resultados);

  console.log(`\nRegistros candidatos: ${total}`);
  console.log(`Productos diferentes: ${productos.size}`);
}

analizarCanasta().catch((error: Error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});