import { z } from 'zod';
import { CONFIG_QQP, userAgent } from './config';

/**
 * Cliente del endpoint publico que usa el buscador de qqp.profeco.gob.mx.
 * El endpoint responde sin credenciales; no se envian las que trae el JavaScript del sitio.
 * No esta documentado: cualquier cambio de forma se detecta con el esquema y falla de forma explicita.
 */

export const esquemaObservacion = z.object({
  producto: z.string().min(1),
  tipo_producto: z.string().min(1),
  precio: z.coerce.number(),
  fecha_observacion: z.string(),
  cadena_comercial: z.string().default(''),
  establecimiento: z.string().default(''),
  direccion: z.string().default(''),
  colonia: z.string().nullish(),
  cp: z.union([z.string(), z.number()]).nullish().transform((v) => (v == null ? null : String(v).trim() || null)),
  municipio: z.string().nullish(),
  entidad: z.string().nullish(),
});

export type ObservacionQQP = z.infer<typeof esquemaObservacion>;

const esquemaRespuesta = z.object({
  success: z.literal(true),
  data: z.object({ productos: z.array(z.unknown()) }),
});

export interface ResultadoBusqueda {
  termino: string;
  /** Observaciones que pasaron el esquema. */
  observaciones: ObservacionQQP[];
  /** Elementos que no cumplen el esquema (se registran como descartes). */
  invalidas: { dato: unknown; error: string }[];
}

export class ErrorQQP extends Error {
  constructor(message: string, readonly reintentable: boolean) {
    super(message);
    this.name = 'ErrorQQP';
  }
}

type Fetch = typeof fetch;
const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface OpcionesCliente {
  fetch?: Fetch;
  esperar?: (ms: number) => Promise<void>;
  maxIntentos?: number;
}

async function unaPeticion(termino: string, f: Fetch): Promise<ResultadoBusqueda> {
  const url = new URL(CONFIG_QQP.urlPrecios);
  url.searchParams.set('clave_ciudad', CONFIG_QQP.ciudad.clave);
  url.searchParams.set('busqueda', termino);

  let r: Response;
  try {
    r = await f(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': userAgent() },
      signal: AbortSignal.timeout(CONFIG_QQP.timeoutMs),
    });
  } catch (e) {
    throw new ErrorQQP(`Sin respuesta de Profeco (${(e as Error).name})`, true);
  }

  if (r.status === 429 || r.status >= 500) {
    const espera = Number(r.headers.get('retry-after'));
    const err = new ErrorQQP(`HTTP ${r.status}`, true) as ErrorQQP & { esperaMs?: number };
    if (Number.isFinite(espera) && espera > 0) err.esperaMs = Math.min(espera, 120) * 1000;
    throw err;
  }
  if (!r.ok) throw new ErrorQQP(`HTTP ${r.status}`, false);

  let cuerpo: unknown;
  try {
    cuerpo = await r.json();
  } catch {
    throw new ErrorQQP('La respuesta no es JSON (posible cambio del sitio)', false);
  }
  const base = esquemaRespuesta.safeParse(cuerpo);
  if (!base.success) throw new ErrorQQP('Respuesta con forma inesperada (posible cambio de la API)', false);

  const observaciones: ObservacionQQP[] = [];
  const invalidas: ResultadoBusqueda['invalidas'] = [];
  for (const dato of base.data.data.productos) {
    const o = esquemaObservacion.safeParse(dato);
    if (o.success) observaciones.push(o.data);
    else invalidas.push({ dato, error: o.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  }
  return { termino, observaciones, invalidas };
}

/** Busca un termino con reintentos ante 429, 5xx o fallas de red. */
export async function buscar(termino: string, opciones: OpcionesCliente = {}): Promise<ResultadoBusqueda> {
  const f = opciones.fetch ?? fetch;
  const dormir = opciones.esperar ?? esperar;
  const max = opciones.maxIntentos ?? CONFIG_QQP.maxIntentos;

  for (let intento = 1; ; intento++) {
    try {
      return await unaPeticion(termino, f);
    } catch (e) {
      const err = e as ErrorQQP & { esperaMs?: number };
      if (!(err instanceof ErrorQQP) || !err.reintentable || intento >= max) throw err;
      await dormir(err.esperaMs ?? 30_000 * intento);
    }
  }
}
