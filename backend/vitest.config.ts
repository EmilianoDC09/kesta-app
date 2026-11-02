import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/kesta_test',
      JWT_SECRET: 'secreto-de-pruebas',
      VERIFICACION_CONFIRMACIONES: '2',
      VERIFICACION_REFUTACIONES: '2',
      GOOGLE_MAPS_API_KEY: 'clave-de-pruebas',
    },
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
