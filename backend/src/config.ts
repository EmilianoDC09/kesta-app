import 'dotenv/config';

const num = (v: string | undefined, def: number) => (v !== undefined && v !== '' ? Number(v) : def);

export const config = {
  port: num(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/kesta_bd',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-no-usar-en-produccion',
  jwtAccessMinutos: num(process.env.JWT_ACCESS_MINUTOS, 15),
  jwtRefreshDias: num(process.env.JWT_REFRESH_DIAS, 30),
  verificacion: {
    confirmaciones: num(process.env.VERIFICACION_CONFIRMACIONES, 2),
    refutaciones: num(process.env.VERIFICACION_REFUTACIONES, 2),
  },
  // Dias tras los cuales un precio de cada tipo de fuente se marca como desactualizado
  vigenciaDias: {
    profeco: num(process.env.VIGENCIA_DIAS_PROFECO, 60),
    scraping: num(process.env.VIGENCIA_DIAS_SCRAPING, 7),
    comunidad: num(process.env.VIGENCIA_DIAS_COMUNIDAD, 14),
  } as Record<string, number>,
  fcmServiceAccount: process.env.FCM_SERVICE_ACCOUNT ?? '',
  // Google Maps Platform (EXT-01). La clave vive solo aqui (entorno del servidor); jamas se envia a la app ni se registra en logs.
  googleMaps: {
    apiKey: (process.env.GOOGLE_MAPS_API_KEY ?? '').trim(),
    timeoutMs: num(process.env.GEOCODING_TIMEOUT_MS, 3000),
  },
  esProduccion: process.env.NODE_ENV === 'production',
};

if (config.esProduccion && config.jwtSecret.startsWith('dev-secret')) {
  throw new Error('JWT_SECRET debe definirse en produccion');
}
