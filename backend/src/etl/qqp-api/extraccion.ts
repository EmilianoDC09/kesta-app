import fs from 'node:fs';
import path from 'node:path';
import { buscar, ObservacionQQP, OpcionesCliente } from './cliente';
import { CONFIG_QQP } from './config';

export interface ResultadoTermino {
  termino: string;
  ok: boolean;
  observaciones: number;
  error?: string;
}

export interface Extraccion {
  version: 1;
  obtenidoEn: string;
  ciudad: string;
  terminos: ResultadoTermino[];
  observaciones: ObservacionQQP[];
  invalidas: { termino: string; dato: unknown; error: string }[];
}

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Consulta los terminos uno por uno, con pausa entre ellos. Una busqueda fallida no detiene las demas. */
export async function extraer(
  terminos: string[],
  opciones: OpcionesCliente & { pausaMs?: number; alAvanzar?: (r: ResultadoTermino) => void } = {}
): Promise<Extraccion> {
  const pausa = opciones.pausaMs ?? CONFIG_QQP.pausaMs;
  const dormir = opciones.esperar ?? esperar;
  const out: Extraccion = {
    version: 1,
    obtenidoEn: new Date().toISOString(),
    ciudad: CONFIG_QQP.ciudad.clave,
    terminos: [],
    observaciones: [],
    invalidas: [],
  };

  for (let i = 0; i < terminos.length; i++) {
    const termino = terminos[i];
    let r: ResultadoTermino;
    try {
      const res = await buscar(termino, opciones);
      out.observaciones.push(...res.observaciones);
      out.invalidas.push(...res.invalidas.map((x) => ({ termino, ...x })));
      r = { termino, ok: true, observaciones: res.observaciones.length };
    } catch (e) {
      r = { termino, ok: false, observaciones: 0, error: (e as Error).message };
    }
    out.terminos.push(r);
    opciones.alAvanzar?.(r);
    if (i < terminos.length - 1) await dormir(pausa);
  }
  return out;
}

export interface Evaluacion {
  cargar: boolean;
  parcial: boolean;
  problemas: string[];
}

/** Decide si la extraccion es confiable para cargarse. */
export function evaluarExtraccion(e: Extraccion): Evaluacion {
  const problemas: string[] = [];
  const total = e.terminos.length;
  const fallidos = e.terminos.filter((t) => !t.ok);

  if (total === 0) return { cargar: false, parcial: false, problemas: ['No hubo terminos de busqueda'] };
  if (fallidos.length / total > CONFIG_QQP.maxFraccionFallida) {
    problemas.push(`Fallaron ${fallidos.length} de ${total} busquedas`);
  }
  for (const c of CONFIG_QQP.terminosCentinela) {
    const t = e.terminos.find((x) => x.termino === c);
    if (t?.ok && t.observaciones === 0) problemas.push(`La busqueda centinela "${c}" llego vacia (posible cambio de la API)`);
  }
  if (e.observaciones.length === 0) problemas.push('Profeco no devolvio observaciones');

  return { cargar: problemas.length === 0, parcial: fallidos.length > 0, problemas };
}

/** Respaldo crudo de cada extraccion en datos/qqp-api/ (ignorado por git): auditoria y reproceso sin red. */
export function guardarRespaldo(e: Extraccion, dir = path.resolve(process.cwd(), 'datos', 'qqp-api')): string {
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `qqp_${e.ciudad}_${e.obtenidoEn.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(archivo, JSON.stringify(e, null, 2), 'utf8');
  return archivo;
}

export function leerRespaldo(archivo: string): Extraccion {
  const e = JSON.parse(fs.readFileSync(archivo, 'utf8')) as Extraccion;
  if (e.version !== 1 || !Array.isArray(e.observaciones) || !Array.isArray(e.terminos)) {
    throw new Error(`Respaldo con formato desconocido: ${archivo}`);
  }
  return e;
}
