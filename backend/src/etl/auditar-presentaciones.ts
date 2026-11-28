import fs from 'node:fs';
import path from 'node:path';
import { extraerDatos } from './extraer';
import { normalizarTexto } from './transformar';
import { normalizarPresentacion } from './unidades';
import { perteneceCanasta } from './canasta';

interface Auditoria {
  producto: string;
  marca: string;
  presentacion: string;
  cantidad: number | null;
  unidad: string;
  registros: number;
  estado: string;
}

function escaparCSV(valor: unknown): string {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`;
}

async function auditarPresentaciones(): Promise<void> {
  console.log('Auditando presentaciones de Profeco...\n');

  const presentaciones = new Map<string, Auditoria>();
  const grupos = new Map<string, Set<string>>();

  let total = 0;

  for await (const registro of extraerDatos()) {
    if (!perteneceCanasta(
      registro.producto,
      registro.catalogo
    )) {
      continue;
    }

    total++;

    const producto = normalizarTexto(registro.producto);
    const marca = normalizarTexto(registro.marca);
    const presentacion = normalizarTexto(
      registro.presentacion
    );

    const unidad = normalizarPresentacion(
      registro.presentacion
    );

    const clave = JSON.stringify([
      producto,
      marca,
      presentacion
    ]);

    const existente = presentaciones.get(clave);

    if (existente) {
      existente.registros++;
    } else {
      presentaciones.set(clave, {
        producto: registro.producto,
        marca: registro.marca,
        presentacion: registro.presentacion,
        cantidad: unidad?.cantidad ?? null,
        unidad: unidad?.unidad ?? '',
        registros: 1,
        estado: unidad ? 'NORMALIZADA' : 'PENDIENTE'
      });
    }

    if (unidad) {
      const claveGrupo = JSON.stringify([
        producto,
        marca,
        unidad.cantidad,
        unidad.unidad
      ]);

      if (!grupos.has(claveGrupo)) {
        grupos.set(claveGrupo, new Set<string>());
      }

      grupos.get(claveGrupo)!.add(presentacion);
    }
  }

  const resultados = [...presentaciones.values()].sort(
    (a, b) =>
      a.producto.localeCompare(b.producto) ||
      a.marca.localeCompare(b.marca) ||
      a.presentacion.localeCompare(b.presentacion)
  );

  const encabezados = [
    'producto',
    'marca',
    'presentacion_original',
    'cantidad_normalizada',
    'unidad_normalizada',
    'registros',
    'estado'
  ];

  const filas = resultados.map((fila) =>
    [
      fila.producto,
      fila.marca,
      fila.presentacion,
      fila.cantidad,
      fila.unidad,
      fila.registros,
      fila.estado
    ].map(escaparCSV).join(',')
  );

  const archivo = path.resolve(
    process.cwd(),
    'datos',
    'auditoria_presentaciones.csv'
  );

  fs.writeFileSync(
    archivo,
    '\uFEFF' + [encabezados.join(','), ...filas].join('\n'),
    'utf8'
  );

  const coincidencias = [...grupos.entries()].filter(
    ([, variantes]) => variantes.size > 1
  );

  const pendientes = resultados.filter(
    (fila) => fila.estado === 'PENDIENTE'
  );

  console.log('--- RESULTADOS DE AUDITORIA ---');
  console.log(`Registros analizados: ${total}`);
  console.log(`Presentaciones diferentes: ${resultados.length}`);
  console.log(`Presentaciones pendientes: ${pendientes.length}`);
  console.log(`Grupos con posibles colisiones: ${coincidencias.length}`);

  console.log('\n--- EJEMPLOS DE POSIBLES COLISIONES ---');

  for (const [clave, variantes] of coincidencias.slice(0, 10)) {
    const [producto, marca, cantidad, unidad] = JSON.parse(clave);

    console.log(`\nProducto: ${producto}`);
    console.log(`Marca: ${marca}`);
    console.log(`Cantidad: ${cantidad} ${unidad}`);

    for (const variante of variantes) {
      console.log(` - ${variante}`);
    }
  }

  console.log('\n--- ARCHIVO GENERADO ---');
  console.log(archivo);

  console.log('\nAuditoria finalizada.');
}

auditarPresentaciones().catch((error: Error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});