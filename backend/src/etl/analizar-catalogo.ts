import { extraerDatos } from './extraer';

async function analizarCatalogo(): Promise<void> {
  console.log('Analizando catalogo de Profeco...\n');

  const categorias = new Map<string, number>();
  const catalogos = new Map<string, number>();

  for await (const registro of extraerDatos()) {
    const categoria = registro.categoria.trim();
    const catalogo = registro.catalogo.trim();

    categorias.set(
      categoria,
      (categorias.get(categoria) ?? 0) + 1
    );

    catalogos.set(
      catalogo,
      (catalogos.get(catalogo) ?? 0) + 1
    );
  }

  console.log('--- CATEGORIAS DE PROFECO ---');

  console.table(
    [...categorias.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categoria, registros]) => ({
        categoria,
        registros
      }))
  );

  console.log('\n--- CATALOGOS DE PROFECO ---');

  console.table(
    [...catalogos.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([catalogo, registros]) => ({
        catalogo,
        registros
      }))
  );
}

analizarCatalogo().catch((error: Error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});