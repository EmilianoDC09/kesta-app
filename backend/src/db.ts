import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.databaseUrl });

// pg devuelve DECIMAL como string; los precios y cantidades de la API son numeros.
import { types } from 'pg';
types.setTypeParser(1700, (v) => parseFloat(v));
// TIMESTAMP sin zona: la base guarda UTC (CURRENT_TIMESTAMP en una sesion UTC); se serializa como ISO UTC.
types.setTypeParser(1114, (v) => new Date(v.replace(' ', 'T') + 'Z'));

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query<T>(text, params);
  return r.rows;
}

export async function queryOne<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function transaccion<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Fija la zona horaria de cada conexion a UTC para que los TIMESTAMP sin zona sean consistentes.
pool.on('connect', (c) => {
  c.query("SET TIME ZONE 'UTC'");
});
