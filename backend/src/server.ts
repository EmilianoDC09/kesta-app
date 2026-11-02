import { crearApp } from './app';
import { config } from './config';
import { pool } from './db';

const app = crearApp();
const server = app.listen(config.port, () => {
  console.log(`Kesta API escuchando en http://localhost:${config.port}/api/v1`);
});

const cerrar = () => {
  server.close(() => pool.end().then(() => process.exit(0)));
};
process.on('SIGTERM', cerrar);
process.on('SIGINT', cerrar);
