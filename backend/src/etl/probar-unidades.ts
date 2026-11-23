import { extraerDatos } from './extraer';
import { normalizarPresentacion } from './unidades';

async function probarUnidades(): Promise<void> {
  console.log('Probando unidades de Profeco...\n');

  let total = 0;
  let normalizadas = 0;
  let pendientes = 0;

  const unidades = new Map<string, number>();
  const ejemplosValidos = new Map<string, string>();
  const ejemplosPendientes = new Set<string>();

  for await (const registro of extraerDatos()) {
    total++;

    const resultado = normalizarPresentacion(
      registro.presentacion
    );

    if (resultado) {
      normalizadas++;

      unidades.set(
        resultado.unidad,
        (unidades.get(resultado.unidad) ?? 0) + 1
      );

      if (ejemplosValidos.size < 15) {
        ejemplosValidos.set(
          registro.presentacion,
          `${resultado.cantidad} ${resultado.unidad}`
        );
      }
    } else {
      pendientes++;

      if (ejemplosPendientes.size < 20) {
        ejemplosPendientes.add(registro.presentacion);
      }
    }
  }

  console.log('--- RESULTADOS ---');
  console.log(`Registros analizados: ${total}`);
  console.log(`Presentaciones normalizadas: ${normalizadas}`);
  console.log(`Pendientes de revision: ${pendientes}`);

  console.log('\n--- UNIDADES IDENTIFICADAS ---');
  console.table(Object.fromEntries(unidades));

  console.log('\n--- EJEMPLOS NORMALIZADOS ---');
  console.table(
    Array.from(ejemplosValidos, ([original, normalizada]) => ({
      original,
      normalizada
    }))
  );

  console.log('\n--- EJEMPLOS PENDIENTES ---');
  console.table([...ejemplosPendientes]);
}

probarUnidades().catch((error: Error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});