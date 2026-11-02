import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { pool } from '../db';
import { migrar } from './migrate';

export const PASSWORD_SEED = 'Kesta1234!';

/** Reinicia los datos y carga db/seed.sql. Solo para desarrollo y pruebas. */
export async function sembrar() {
  if (config.esProduccion) throw new Error('El seed borra todos los datos; no se ejecuta en produccion');
  await migrar();
  const hash = await bcrypt.hash(PASSWORD_SEED, 10);
  const sql = fs.readFileSync(path.resolve(__dirname, '../../db/seed.sql'), 'utf8').replaceAll('__HASH__', hash);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tablas = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('spatial_ref_sys', 'schema_migrations')`)).rows.map((r) => `"${r.tablename}"`);
    await client.query(`TRUNCATE ${tablas.join(', ')} RESTART IDENTITY CASCADE`);
    await client.query(sql);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  sembrar()
    .then(() => {
      console.log(`Datos de prueba cargados. Usuarios: admin@kesta.test, moderador@kesta.test, maria@kesta.test, carlos@kesta.test, ana@kesta.test (contrasena ${PASSWORD_SEED})`);
      return pool.end();
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
