import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';
import {
  transformarRegistro,
  RegistroProfeco
} from './transformar';

const archivoCSV = path.resolve(
  process.cwd(),
  'datos',
  'QQP_Morelia_2026.csv'
);

const columnasObligatorias = [
  'archivo_origen',
  'producto',
  'presentacion',
  'marca',
  'categoria',
  'catalogo',
  'precio',
  'fecha_registro',
  'cadena_comercial',
  'giro',
  'nombre_comercial',
  'direccion',
  'estado',
  'municipio',
  'latitud',
  'longitud'
];

export async function* extraerDatos(
  archivo: string = archivoCSV
): AsyncGenerator<RegistroProfeco> {
  if (!fs.existsSync(archivo)) {
    throw new Error(`No se encontró el archivo: ${archivo}`);
  }

  const parser = fs.createReadStream(archivo).pipe(
    parse({
      columns: (encabezados: string[]) => {
        const faltantes = columnasObligatorias.filter(
          (columna) => !encabezados.includes(columna)
        );

        if (faltantes.length > 0) {
          throw new Error(
            `Faltan columnas: ${faltantes.join(', ')}`
          );
        }

        return encabezados;
      },
      bom: true,
      skip_empty_lines: true
    })
  );

  for await (const registro of parser) {
    yield registro as RegistroProfeco;
  }
}

async function probarPipeline(): Promise<void> {
  console.log('Iniciando pipeline de Profeco...');

  let total = 0;
  let validos = 0;
  let invalidos = 0;

  const productos = new Set<string>();
  const motivos = new Map<string, number>();

  for await (const registro of extraerDatos()) {
    total++;

    const resultado = transformarRegistro(registro);

    if (resultado.valido) {
      validos++;
      productos.add(resultado.datos.producto);

      if (validos === 1) {
        console.log('\nPrimer registro transformado:');
        console.log(resultado.datos);
      }
    } else {
      invalidos++;

      motivos.set(
        resultado.motivo,
        (motivos.get(resultado.motivo) ?? 0) + 1
      );
    }
  }

  console.log('\n--- RESULTADOS DEL PIPELINE ---');
  console.log(`Registros leídos: ${total}`);
  console.log(`Registros válidos: ${validos}`);
  console.log(`Registros inválidos: ${invalidos}`);
  console.log(`Productos normalizados: ${productos.size}`);

  console.log('\nMotivos de rechazo:');
  console.table(Object.fromEntries(motivos));

  console.log('\nPipeline finalizado.');
}

if (require.main === module) {
  probarPipeline().catch((error: Error) => {
    console.error('Error del pipeline:', error.message);
    process.exitCode = 1;
  });
}