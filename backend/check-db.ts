import { pool } from './src/db';

pool
  .query(`SELECT current_database() AS base,
                 inet_server_port() AS puerto,
                 (SELECT system_identifier FROM pg_control_system()) AS id_instancia,
                 (SELECT count(*) FROM usuarios) AS usuarios,
                 (SELECT max(id) FROM usuarios) AS ultimo_id`)
  .then((r) => { console.log(r.rows[0]); return pool.end(); })
  .catch((e) => { console.error(e.message); process.exit(1); });