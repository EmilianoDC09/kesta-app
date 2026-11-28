import { normalizarPresentacion, PresentacionNormalizada } from '../unidades';
import { coincideDireccion, firma, MarcaConocida, palabrasDeProducto, separarMarca, textoParaUnidades } from './texto';

/** Presentacion del catalogo con la cantidad ya llevada a g / ml / pza / rollo / manojo. */
export interface PresentacionCatalogo {
  id: number;
  marcaId: number;
  marcaNombre: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string;
}

export type DecisionPresentacion =
  | { tipo: 'existente'; presentacionId: number }
  | { tipo: 'crear'; marcaId: number; descripcion: string; cantidad: number; unidad: PresentacionNormalizada['unidad'] }
  | { tipo: 'externo'; motivo: string };

export const MOTIVOS = {
  ambigua: 'Presentacion ambigua en el catalogo',
  marca: 'Marca no registrada en Kesta',
  descripcion: 'Descripcion incompleta',
  unidad: 'Presentacion pendiente de normalizacion',
  similar: 'Presentacion similar en el catalogo (revisar)',
  asociacion: 'Marca sin asociacion previa con el producto',
  cantidad: 'Cantidad incompatible con el catalogo',
} as const;

const cacheFirmas = new WeakMap<PresentacionCatalogo, Map<string, string>>();
function firmaDe(p: PresentacionCatalogo, ignorar: string[]): string {
  const clave = ignorar.join(' ');
  let porClave = cacheFirmas.get(p);
  if (!porClave) cacheFirmas.set(p, (porClave = new Map()));
  let f = porClave.get(clave);
  if (f === undefined) {
    f = firma(`${p.marcaNombre} ${p.descripcion ?? ''}`, ignorar);
    porClave.set(clave, f);
  }
  return f;
}

/**
 * Decide a que presentacion corresponde el texto de la API (sin el tipo de producto al inicio).
 *
 * 1. Coincidencia exacta de firma con "marca + descripcion" de una presentacion del producto.
 * 2. Si no hay, se crea una presentacion nueva solo si la marca ya tiene presentaciones de ese producto, la
 *    cantidad se puede normalizar y no existe ya una presentacion de esa marca con la misma cantidad. Ese ultimo caso suele ser la misma
 *    presentacion escrita distinto ("GRUESO" contra "Grano Grueso") o una variedad nueva ("Negro" contra
 *    "Negro. Queretaro"); en lugar de duplicar o mezclar, se manda a revision.
 */
export function decidirPresentacion(
  resto: string,
  presentaciones: PresentacionCatalogo[],
  marcas: MarcaConocida[],
  nombreProducto = ''
): DecisionPresentacion {
  const ignorar = palabrasDeProducto(nombreProducto);
  const f = firma(resto, ignorar);
  const exactas = presentaciones.filter((p) => firmaDe(p, ignorar) === f);
  if (exactas.length === 1) return { tipo: 'existente', presentacionId: exactas[0].id };
  if (exactas.length > 1) return { tipo: 'externo', motivo: MOTIVOS.ambigua };

  const sep = separarMarca(resto, marcas);
  if (!sep.marca) return { tipo: 'externo', motivo: MOTIVOS.marca };
  // Igual que la carga del CSV: solo se crean tamanos o variedades nuevas de pares producto-marca conocidos.
  // Evita que una marca corta ("San") capture por prefijo el texto de otra ("SAN MARCOS").
  if (!presentaciones.some((p) => p.marcaId === sep.marca!.id)) return { tipo: 'externo', motivo: MOTIVOS.asociacion };
  if (!sep.descripcion) return { tipo: 'externo', motivo: MOTIVOS.descripcion };

  const unidad = normalizarPresentacion(textoParaUnidades(sep.descripcion));
  if (!unidad) return { tipo: 'externo', motivo: MOTIVOS.unidad };

  const similares = presentaciones.filter(
    (p) => p.marcaId === sep.marca!.id && p.unidad === unidad.unidad && Math.abs(p.cantidad - unidad.cantidad) < 0.005
  );
  if (similares.length > 0) return { tipo: 'externo', motivo: MOTIVOS.similar };

  // DECIMAL(10,2): no se guarda una cantidad que perderia precision.
  if (unidad.cantidad > 99_999_999.99 || Math.abs(unidad.cantidad * 100 - Math.round(unidad.cantidad * 100)) > 1e-6) {
    return { tipo: 'externo', motivo: MOTIVOS.cantidad };
  }

  return {
    tipo: 'crear',
    marcaId: sep.marca.id,
    descripcion: sep.descripcion,
    cantidad: unidad.cantidad,
    unidad: unidad.unidad,
  };
}

export interface UbicacionExistente {
  id: number;
  direccion: string | null;
  tieneCoordenadas: boolean;
}

export type DecisionUbicacion =
  | { tipo: 'existente'; ubicacionId: number; tieneCoordenadas: boolean }
  | { tipo: 'nueva' }
  | { tipo: 'ambigua' };

/**
 * Empareja la sucursal de la API con las ubicaciones del comercio. Prefiere la que tiene coordenadas: la carga
 * anterior por API creo duplicados sin coordenadas de sucursales que ya venian del CSV con su punto.
 */
export function decidirUbicacion(
  sucursal: { direccion: string; cp?: string | null },
  ubicaciones: UbicacionExistente[]
): DecisionUbicacion {
  const coinciden = ubicaciones.filter((u) => coincideDireccion(sucursal, u.direccion)).sort((a, b) => a.id - b.id);
  const conPunto = coinciden.filter((u) => u.tieneCoordenadas);
  if (conPunto.length === 1) return { tipo: 'existente', ubicacionId: conPunto[0].id, tieneCoordenadas: true };
  if (conPunto.length > 1) return { tipo: 'ambigua' };
  if (coinciden.length > 0) return { tipo: 'existente', ubicacionId: coinciden[0].id, tieneCoordenadas: false };
  return { tipo: 'nueva' };
}

// --------------------------------------------------------------------------------------------
// Carne por corte
// --------------------------------------------------------------------------------------------
// Profeco dejo de agrupar la carne por animal ("CARNE RES") y ahora cada corte es un tipo ("BISTEC DEL 7",
// "CHULETA", "PECHUGA"). Varios cortes no dicen el animal en el tipo (CHULETA puede ser de res o de cerdo), asi que
// no se adivina: el corte se compara contra las presentaciones de todos los productos de carne del catalogo y la
// presentacion que coincide decide el producto.

export interface CandidatoCorte {
  productoId: number;
  productoNombre: string;
  presentaciones: PresentacionCatalogo[];
}

export type DecisionCorte =
  | { tipo: 'existente'; productoId: number; presentacionId: number }
  | { tipo: 'externo'; motivo: string };

export const MOTIVOS_CORTE = {
  sinPresentacion: 'Corte sin presentacion en el catalogo',
  ambiguo: 'Corte ambiguo entre presentaciones (revisar)',
} as const;

/** Palabras de enlace que el buscador agrega o quita sin cambiar el corte ("MOLIDA DE RES" = "Molida"). */
const ENLACE = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'o', 'y']);
const CANTIDAD = /\d+(?:[.,]\d+)?\s*(?:kilogramos?|kilos?|kg|gramos?|gr|g|mililitros?|ml|litros?|lts?|l)\b\.?/gi;

function palabrasCorte(texto: string, ignorar: Set<string>): Set<string> {
  return new Set(
    firma((texto ?? '').replace(CANTIDAD, ' '))
      .split(' ')
      .filter((v) => v && !ENLACE.has(v) && !ignorar.has(v))
  );
}

function iguales(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function jaccard(a: Set<string>, b: Set<string>) {
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

/**
 * 1. Misma marca y misma cantidad (1 kg a granel, paquete de 500 g...).
 * 2. Coincidencia exacta de palabras con la descripcion del buscador; si no, con tipo + descripcion
 *    ("BISTEC DE ESPALDILLA, S/M, 1 KG. GRANEL" solo dice el corte en el tipo).
 * 3. Si no hay exacta, la mas parecida (Jaccard >= 0.6) y con ventaja clara (>= 0.15) sobre la segunda.
 *    Empates o parecidos debiles van a revision: "FILETE" se parece igual a "Filete Limpio" (res) que a
 *    "Pechuga. Filete" (pollo).
 */
export function decidirCorte(
  tipo: string,
  resto: string,
  candidatos: CandidatoCorte[],
  marcas: MarcaConocida[]
): DecisionCorte {
  const sep = separarMarca(resto, marcas);
  if (!sep.marca) return { tipo: 'externo', motivo: MOTIVOS.marca };
  // Solo la cantidad ("1 KG.", "PAQUETE 500 GR."): el resto del texto trae numeros que no son cantidades
  // ("MOLIDA ... 90-10") y que unidades.ts rechaza como rangos.
  const cantidad = (sep.descripcion || resto).match(new RegExp(CANTIDAD.source, 'i'));
  const unidad = cantidad ? normalizarPresentacion(cantidad[0]) : null;
  if (!unidad) return { tipo: 'externo', motivo: MOTIVOS.unidad };

  const pool = candidatos.flatMap((c) =>
    c.presentaciones
      .filter((p) => p.marcaId === sep.marca!.id && p.unidad === unidad.unidad && Math.abs(p.cantidad - unidad.cantidad) < 0.005)
      .map((p) => {
        const ignorar = new Set(palabrasDeProducto(c.productoNombre));
        return {
          productoId: c.productoId,
          presentacionId: p.id,
          ignorar,
          palabras: palabrasCorte(p.descripcion ?? '', ignorar),
        };
      })
  );
  if (pool.length === 0) return { tipo: 'externo', motivo: MOTIVOS_CORTE.sinPresentacion };

  const elegir = (xs: typeof pool): DecisionCorte | null =>
    xs.length === 1 ? { tipo: 'existente', productoId: xs[0].productoId, presentacionId: xs[0].presentacionId } : null;

  for (const texto of [sep.descripcion, `${tipo} ${sep.descripcion}`]) {
    const exactas = pool.filter((p) => iguales(palabrasCorte(texto, p.ignorar), p.palabras));
    if (exactas.length > 1) return { tipo: 'externo', motivo: MOTIVOS_CORTE.ambiguo };
    const d = elegir(exactas);
    if (d) return d;
  }

  const puntajes = pool
    .map((p) => ({ p, s: jaccard(palabrasCorte(`${tipo} ${sep.descripcion}`, p.ignorar), p.palabras) }))
    .sort((a, b) => b.s - a.s);
  const [primero, segundo] = puntajes;
  if (primero.s >= 0.6 && primero.s - (segundo?.s ?? 0) >= 0.15) {
    return { tipo: 'existente', productoId: primero.p.productoId, presentacionId: primero.p.presentacionId };
  }
  return { tipo: 'externo', motivo: MOTIVOS_CORTE.ambiguo };
}
