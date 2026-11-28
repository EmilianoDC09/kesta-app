import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../db';
import { extraerDatos } from './extraer';

import {
  perteneceCanasta,
  obtenerProductoCanonico
} from './canasta';

import {
  transformarRegistro,
  normalizarTexto
} from './transformar';

import { normalizarPresentacion } from './unidades';

interface PresentacionCatalogo {
  categoria: string;
  producto: string;
  marca: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  registros: number;
}

// Categorias propuestas para productos nuevos.
const categoriasCanonicas: Record<string, string> = {
  'atun': 'Pescados y Mariscos en Conserva',
  'carne cerdo': 'Carne y Vísceras de Cerdo',
  'galletas dulces': 'Galletas'
};

// Consultar las categorias existentes en PostgreSQL.
async function obtenerCategoriasExistentes():
  Promise<Map<string, string>> {

  const resultado = await pool.query(`
    SELECT
      p.nombre AS producto,
      c.nombre AS categoria
    FROM productos p
    INNER JOIN categorias c
      ON c.id = p.categoria_id
  `);

  const categorias = new Map<string, string>();

  for (const fila of resultado.rows) {

    const clave = normalizarTexto(fila.producto);

    const existente = categorias.get(clave);

    if (
      existente &&
      normalizarTexto(existente) !==
      normalizarTexto(fila.categoria)
    ) {
      throw new Error(
        `Categorias ambiguas en PostgreSQL: ${fila.producto}`
      );
    }

    categorias.set(clave, fila.categoria);
  }

  return categorias;
}

async function generarCatalogo(): Promise<void> {

  const categoriasExistentes =
    await obtenerCategoriasExistentes();

  const categorias = new Set<string>();
  const productos = new Set<string>();
  const marcas = new Set<string>();
  const unidades = new Set<string>();

  const presentaciones = new Map<
    string,
    PresentacionCatalogo
  >();

  const categoriasPorProducto =
    new Map<string, string>();

  let seleccionados = 0;
  let normalizados = 0;
  let pendientes = 0;
  let categoriasReasignadas = 0;

  console.log('Generando catalogo de Profeco...');

  console.log(
    `Productos con categoria existente: ${categoriasExistentes.size}`
  );

  for await (const registro of extraerDatos()) {

    // 1. Seleccionar productos de la canasta.
    if (!perteneceCanasta(
      registro.producto,
      registro.catalogo
    )) {
      continue;
    }

    seleccionados++;

    // 2. Validar el registro.
    const resultado = transformarRegistro(registro);

    if (!resultado.valido) {
      pendientes++;
      continue;
    }

    // 3. Resolver el nombre canonico.
    const producto = obtenerProductoCanonico(
      registro.producto
    );

    if (!producto) {
      pendientes++;
      continue;
    }

    // 4. Normalizar cantidad y unidad.
    const presentacion = normalizarPresentacion(
      registro.presentacion
    );

    if (!presentacion) {
      pendientes++;
      continue;
    }

    normalizados++;

    const claveProducto = normalizarTexto(producto);

    // 5. Respetar la categoria registrada en Kesta.
    const categoria =
      categoriasExistentes.get(claveProducto)
      ?? categoriasCanonicas[claveProducto]
      ?? registro.categoria.trim();

    // Contabilizar diferencias con Profeco.
    if (
      normalizarTexto(categoria) !==
      normalizarTexto(registro.categoria)
    ) {
      categoriasReasignadas++;
    }

    // Detectar conflictos en productos nuevos.
    const categoriaAnterior =
      categoriasPorProducto.get(claveProducto);

    if (
      categoriaAnterior &&
      normalizarTexto(categoriaAnterior) !==
      normalizarTexto(categoria)
    ) {
      throw new Error(
        `Producto nuevo con categoria ambigua: ${producto}`
      );
    }

    categoriasPorProducto.set(
      claveProducto,
      categoria
    );

    const marca = registro.marca.trim();
    const descripcion = registro.presentacion.trim();

    categorias.add(normalizarTexto(categoria));
    productos.add(claveProducto);
    marcas.add(normalizarTexto(marca));
    unidades.add(presentacion.unidad);

    // 6. Identificar cada presentacion.
    const clave = JSON.stringify([
      normalizarTexto(categoria),
      claveProducto,
      normalizarTexto(marca),
      normalizarTexto(descripcion),
      presentacion.cantidad,
      presentacion.unidad
    ]);

    const existente = presentaciones.get(clave);

    if (existente) {

      existente.registros++;

    } else {

      presentaciones.set(clave, {
        categoria,
        producto,
        marca,
        descripcion,
        cantidad: presentacion.cantidad,
        unidad: presentacion.unidad,
        registros: 1
      });
    }
  }

  // 7. Preparar el catalogo actualizado.
  const catalogo = {
    fuente: 'Profeco QQP',
    municipio: 'Morelia',
    estado: 'Michoacan',
    estadoCatalogo: 'pendiente_revision',

    resumen: {
      seleccionados,
      normalizados,
      pendientes,
      categorias: categorias.size,
      productos: productos.size,
      marcas: marcas.size,
      unidades: unidades.size,
      presentaciones: presentaciones.size,
      categoriasReasignadas
    },

    presentaciones: [...presentaciones.values()]
      .sort((a, b) =>
        a.producto.localeCompare(b.producto) ||
        a.marca.localeCompare(b.marca) ||
        a.descripcion.localeCompare(b.descripcion)
      )
  };

  // 8. Guardar el archivo JSON.
  const destino = path.resolve(
    process.cwd(),
    'datos',
    'catalogo_profeco.json'
  );

  fs.writeFileSync(
    destino,
    JSON.stringify(catalogo, null, 2),
    'utf8'
  );

  console.log('\n--- RESUMEN DEL CATALOGO ---');
  console.table(catalogo.resumen);

  console.log('\nUnidades identificadas:');
  console.log([...unidades]);

  console.log('\nArchivo generado:');
  console.log(destino);

  console.log('\nCatalogo pendiente de revision.');
}

generarCatalogo()
  .catch((error: Error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });