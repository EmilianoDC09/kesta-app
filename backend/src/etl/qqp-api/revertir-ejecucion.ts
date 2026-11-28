/**
 * Revierte una ejecucion de ingesta de Profeco: borra sus precios, productos externos y descartes, y lo que creo
 * (presentaciones y sucursales) si ya nada lo usa.
 *
 *   npx tsx src/etl/qqp-api/revertir-ejecucion.ts --id 6             simulacion: muestra que se borraria
 *   npx tsx src/etl/qqp-api/revertir-ejecucion.ts --id 6 --aplicar   borra
 *
 * Para cargas anteriores a la migracion 005 (sin creada_por_ejecucion), en ejecuciones del extractor anterior por API
 * se reconocen sus restos asi:
 *  - presentaciones con descripcion generada por ese extractor ("1000 ml" o "1000 ml - entera") que quedan sin uso;
 *  - sucursales sin coordenadas ni creador que quedan sin precios.
 */
import { pool } from '../../db';
import { CONFIG_QQP } from './config';

const PATRON_PRESENTACION_LEGADO = '^[0-9]+(\\.[0-9]+)? (g|ml|pza|rollo|manojo)( - .+)?$';

const PRESENTACION_SIN_USO = `
  NOT EXISTS (SELECT 1 FROM precios x WHERE x.presentacion_id = pr.id)
  AND NOT EXISTS (SELECT 1 FROM canasta_productos x WHERE x.presentacion_id = pr.id)
  AND NOT EXISTS (SELECT 1 FROM alertas_precio x WHERE x.presentacion_id = pr.id)
  AND NOT EXISTS (SELECT 1 FROM productos_externos x WHERE x.presentacion_id = pr.id)`;

const UBICACION_SIN_USO = `
  NOT EXISTS (SELECT 1 FROM precios x WHERE x.ubicacion_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM verificaciones_ubicacion x WHERE x.ubicacion_comercio_id = u.id)`;

async function revertir(id: number, aplicar: boolean) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ej = await client.query('SELECT id, origen, estado, cargadas FROM ejecuciones_ingesta WHERE id = $1 FOR UPDATE', [id]);
    if (ej.rows.length === 0) throw new Error(`No existe la ejecucion ${id}`);
    const { origen, estado } = ej.rows[0];
    if (estado === 'revertida') throw new Error(`La ejecucion ${id} ya fue revertida`);
    if (estado === 'en_proceso') throw new Error(`La ejecucion ${id} sigue en proceso`);
    const legado = origen === CONFIG_QQP.origenLegado;
    console.log(`Ejecucion ${id} (${origen}, ${estado})${legado ? ' — extractor anterior por API' : ''}`);

    // Precios con votos de la comunidad no se borran: esa informacion no es de la ingesta.
    const conVotos = await client.query(
      `SELECT count(*)::int AS n FROM precios p WHERE p.ejecucion_id = $1
       AND EXISTS (SELECT 1 FROM verificaciones_precio v WHERE v.precio_id = p.id)`,
      [id]
    );
    const precios = await client.query(
      `DELETE FROM precios p WHERE p.ejecucion_id = $1
       AND NOT EXISTS (SELECT 1 FROM verificaciones_precio v WHERE v.precio_id = p.id)`,
      [id]
    );
    const externos = await client.query('DELETE FROM productos_externos WHERE ejecucion_id = $1', [id]);
    const descartes = await client.query('DELETE FROM descartes_ingesta WHERE ejecucion_id = $1', [id]);

    const presentaciones = await client.query(
      `DELETE FROM presentaciones pr
       WHERE (pr.creada_por_ejecucion = $1 OR ($2 AND pr.creada_por_ejecucion IS NULL AND pr.descripcion ~* $3))
         AND ${PRESENTACION_SIN_USO}
       RETURNING pr.id, pr.descripcion`,
      [id, legado, PATRON_PRESENTACION_LEGADO]
    );
    const ubicaciones = await client.query(
      `DELETE FROM ubicaciones_comercio u
       WHERE (u.creada_por_ejecucion = $1
              OR ($2 AND u.creada_por_ejecucion IS NULL AND u.ubicacion IS NULL AND u.creado_por IS NULL))
         AND ${UBICACION_SIN_USO}
       RETURNING u.id, u.direccion`,
      [id, legado]
    );

    const resumen = {
      precios_borrados: precios.rowCount ?? 0,
      precios_conservados_con_votos: conVotos.rows[0].n,
      productos_externos_borrados: externos.rowCount ?? 0,
      descartes_borrados: descartes.rowCount ?? 0,
      presentaciones_borradas: presentaciones.rowCount ?? 0,
      sucursales_borradas: ubicaciones.rowCount ?? 0,
    };
    console.table(resumen);
    if (presentaciones.rows.length) {
      console.log('Presentaciones:');
      console.table(presentaciones.rows.slice(0, 50));
    }
    if (ubicaciones.rows.length) {
      console.log('Sucursales:');
      console.table(ubicaciones.rows.slice(0, 50));
    }

    await client.query(
      `UPDATE ejecuciones_ingesta
       SET estado = 'revertida', detalle = detalle || jsonb_build_object('revertida_en', NOW(), 'reversion', $2::jsonb)
       WHERE id = $1`,
      [id, JSON.stringify(resumen)]
    );

    if (aplicar) {
      await client.query('COMMIT');
      console.log(`\nEjecucion ${id} revertida.`);
    } else {
      await client.query('ROLLBACK');
      console.log('\nSimulacion: no se borro nada. Usa --aplicar para revertir.');
    }
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const i = process.argv.indexOf('--id');
  const id = i === -1 ? NaN : Number(process.argv[i + 1]);
  if (!Number.isInteger(id) || id <= 0) {
    console.error('Uso: npx tsx src/etl/qqp-api/revertir-ejecucion.ts --id <ejecucion> [--aplicar]');
    process.exit(1);
  }
  revertir(id, process.argv.includes('--aplicar'))
    .catch((e: Error) => {
      console.error('Error al revertir:', e.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
