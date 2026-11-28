/** Parametros de la sincronizacion con el buscador QQP (qqp.profeco.gob.mx). */
const num = (v: string | undefined, def: number) => (v !== undefined && v !== '' ? Number(v) : def);

export const CONFIG_QQP = {
  urlPrecios: 'https://qqp.profeco.gob.mx/api/precios',
  /** Clave de ciudad del buscador (GET /api/ciudades). 1601 = Morelia. */
  ciudad: { clave: '1601', nombre: 'Morelia', estado: 'Michoacán', centro: { lat: 19.7027, lng: -101.1923 } },
  /** Pausa entre busquedas. El servidor limita a 60 peticiones/min por IP; 4 s deja ~15/min. */
  pausaMs: num(process.env.QQP_PAUSA_MS, 4000),
  timeoutMs: num(process.env.QQP_TIMEOUT_MS, 20000),
  maxIntentos: 3,
  /** Correo del equipo para que Profeco pueda contactarnos en lugar de bloquear la IP. */
  contacto: (process.env.QQP_CONTACTO ?? '').trim(),
  /** Busquedas que siempre deben traer datos: si llegan vacias, la API cambio y la ejecucion se marca fallida. */
  terminosCentinela: ['huevo', 'leche ultrapasteurizada', 'tortilla de maiz'],
  /** Si falla mas de esta fraccion de busquedas no se carga nada. */
  maxFraccionFallida: 0.5,
  /** Radio maximo (km) desde el centro de la ciudad para aceptar una geocodificacion. */
  radioGeocodificacionKm: 30,
  /** Origen registrado por el extractor anterior (src/etl/extraer-profeco-api.ts, ya retirado). */
  origenLegado: 'Profeco QQP API - Morelia',
  origen: 'qqp.profeco.gob.mx/api/precios',
};

export function userAgent(): string {
  const contacto = CONFIG_QQP.contacto ? `; contacto: ${CONFIG_QQP.contacto}` : '';
  return `KestaETL/1.0 (proyecto academico, Instituto Tecnologico de Morelia${contacto})`;
}
