import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../db';

/** Aplica en orden los .sql de db/migrations que aun no estan registrados. Cada migracion corre en una transaccion. */
export async function migrar(): Promise<string[]> {
  const dir = path.resolve(__dirname, '../../db/migrations');
  const client = await pool.connect();
  const aplicadas: string[] = [];
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const hechas = new Set((await client.query('SELECT nombre FROM schema_migrations')).rows.map((r) => r.nombre));
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      if (hechas.has(f)) continue;
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [f]);
        await client.query('COMMIT');
        aplicadas.push(f);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Fallo la migracion ${f}: ${(e as Error).message}`);
      }
    }
  } finally {
    client.release();
  }
  return aplicadas;
}

if (require.main === module) {
  migrar()
    .then((a) => {
      console.log(a.length ? `Migraciones aplicadas: ${a.join(', ')}` : 'Base de datos al dia');
      return pool.end();
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
