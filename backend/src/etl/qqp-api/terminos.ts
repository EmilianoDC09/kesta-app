import { productosCanasta } from '../canasta';
import { normalizarTexto } from '../transformar';
import { CORTES } from './cortes';

/**
 * Terminos de busqueda: el nombre canonico de cada producto de mapeo-canasta.json.
 * El buscador compara por prefijo del tipo de producto y sin acentos ("pan" devuelve PAN DE CAJA, PANTALLAS...),
 * asi que el nombre completo es el termino mas preciso. Si un termino es prefijo de otro, el largo sobra.
 * `extra` agrega las busquedas de carne por corte (cortesQQP en mapeo-canasta.json).
 */
export function terminosBusqueda(canonicos: string[] = productosCanasta, extra: string[] = CORTES.busquedas): string[] {
  const unicos = [...new Set([...canonicos, ...extra].map(normalizarTexto).filter(Boolean))].sort();
  return unicos.filter((t) => !unicos.some((otro) => otro !== t && t.startsWith(otro)));
}
