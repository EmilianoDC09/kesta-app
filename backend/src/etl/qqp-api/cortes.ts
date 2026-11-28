import fs from 'node:fs';
import path from 'node:path';
import { obtenerProductoCanonico } from '../canasta';
import { normalizarTexto } from '../transformar';

/** Configuracion de carne por corte (seccion "cortesQQP" de mapeo-canasta.json). */
export interface ConfigCortes {
  productos: string[];
  busquedas: string[];
  tipos: Set<string>;
  /** Tipos que llegan por las busquedas de carne pero no son carne (p. ej. ENTEROGERMINA por "entero"). */
  noSonCortes: Set<string>;
}

export function leerCortes(
  archivo = path.resolve(process.cwd(), 'src', 'etl', 'mapeo-canasta.json')
): ConfigCortes {
  const mapeo = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const c = mapeo.cortesQQP;
  if (!c) return { productos: [], busquedas: [], tipos: new Set(), noSonCortes: new Set() };
  const tipos = new Set<string>((c.tipos ?? []).map(normalizarTexto));
  // Un tipo no puede ser a la vez alias de un producto: no sabriamos por cual camino emparejarlo.
  for (const t of tipos) {
    if (obtenerProductoCanonico(t)) throw new Error(`cortesQQP: el tipo "${t}" ya es alias de un producto`);
  }
  for (const p of c.productos ?? []) {
    if (!obtenerProductoCanonico(p)) throw new Error(`cortesQQP: el producto "${p}" no esta en el mapeo`);
  }
  return {
    productos: c.productos ?? [],
    busquedas: (c.busquedas ?? []).map(normalizarTexto),
    tipos,
    noSonCortes: new Set<string>((c.noSonCortes ?? []).map(normalizarTexto)),
  };
}

export const CORTES = leerCortes();

export function esCorte(tipo: string, config: ConfigCortes = CORTES): boolean {
  return config.tipos.has(normalizarTexto(tipo));
}

/** Tipo que llego por una busqueda de carne pero no esta en la lista: posible corte nuevo de Profeco. */
export function pareceCorteNuevo(tipo: string, config: ConfigCortes = CORTES): boolean {
  const t = normalizarTexto(tipo);
  return !config.tipos.has(t) && !config.noSonCortes.has(t) && config.busquedas.some((b) => t.startsWith(b));
}
