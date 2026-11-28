/**
 * Utilidades de texto para la sincronizacion con el buscador QQP de Profeco.
 *
 * El buscador devuelve producto, marca y presentacion en un solo texto:
 *   "LECHE ULTRAPASTEURIZADA, LALA. ENTERA, CAJA 1 LT."
 * mientras que los CSV de datos abiertos (de donde salio el catalogo de Kesta) los separan:
 *   producto "Leche Ultrapasteurizada", marca "Lala", presentacion "Caja 1 Lt. Entera".
 *
 * Las palabras son las mismas, solo cambia el orden y la puntuacion. Por eso el emparejamiento no intenta
 * adivinar donde termina la marca: compara la "firma" (bolsa ordenada de palabras) del texto de la API contra
 * la firma de "marca + descripcion" de cada presentacion del catalogo.
 */

const MARCAS_COMBINANTES = /[̀-ͯ]/g;

/** Minusculas y sin acentos, conservando la longitud del texto (cada caracter precompuesto queda en 1). */
function plegar(texto: string): string {
  return texto.normalize('NFD').replace(MARCAS_COMBINANTES, '').toLowerCase();
}

export interface Token {
  valor: string;
  inicio: number;
  fin: number;
}

/** Palabras alfanumericas con su posicion en el texto original. */
export function tokens(texto: string): Token[] {
  const fuente = (texto ?? '').normalize('NFC');
  const out: Token[] = [];
  for (const m of fuente.matchAll(/[\p{L}\p{N}]+/gu)) {
    out.push({ valor: plegar(m[0]), inicio: m.index!, fin: m.index! + m[0].length });
  }
  return out;
}

/** Equivalencias de escritura entre el CSV y el buscador ("Paquete C/18" = "PAQUETE CON 18"). */
function canonizarEscritura(texto: string): string {
  return (texto ?? '').replace(/\bc\s*\/\s*(?=\d)/gi, 'con ');
}

/**
 * Palabras que el buscador omite y el CSV incluye: en frutas y verduras el CSV dice "1 Kg. Granel. Golden" y el
 * buscador "1 KG. GOLDEN". No distinguen presentaciones entre si.
 */
const PALABRAS_IGNORADAS = new Set(['granel']);

/** Palabras del nombre del producto (de 3+ letras): el buscador las repite en la descripcion ("LIMON COLIMA"). */
export function palabrasDeProducto(nombre: string): string[] {
  return tokens(nombre).map((t) => t.valor).filter((v) => v.length >= 3);
}

/**
 * Firma comparable: conjunto ordenado de palabras, sin importar orden, puntuacion ni repeticiones.
 * Es conjunto (no bolsa) porque el buscador a veces repite palabras: "NIÑOS. LATA 360 GR. (ALIMENTO PARA NIÑOS...)"
 * o "SEMIDESCREMADA ... CAJA 1 LT. SEMIDESCREMADA" frente a la descripcion del CSV que las trae una vez.
 * `ignorar` quita palabras de ambos lados por igual (p. ej. las del nombre del producto).
 */
export function firma(texto: string, ignorar: Iterable<string> = []): string {
  const fuera = new Set([...PALABRAS_IGNORADAS, ...ignorar]);
  return [...new Set(tokens(canonizarEscritura(texto)).map((t) => t.valor))]
    .filter((v) => !fuera.has(v))
    .sort()
    .join(' ');
}

/**
 * Quita el tipo de producto del inicio del texto de la API.
 * Se usa tipo_producto (no un split por comas) porque hay tipos con punto: "POLLO ROSTIZADO. TRADICIONAL".
 * Devuelve null si el texto no empieza con el tipo.
 */
export function quitarTipo(producto: string, tipo: string): string | null {
  const p = (producto ?? '').normalize('NFC').trim();
  const t = (tipo ?? '').normalize('NFC').trim();
  if (!t || plegar(p.slice(0, t.length)) !== plegar(t)) return null;
  const resto = p.slice(t.length).replace(/^[\s,.;:]+/, '').trim();
  return resto || null;
}

export interface MarcaConocida {
  id: number;
  nombre: string;
}

export interface MarcaSeparada {
  marca: MarcaConocida | null;
  /** Texto de la marca tal como viene en la API (aunque no exista en Kesta). */
  textoMarca: string;
  /** Lo que queda despues de la marca: la descripcion de la presentacion. */
  descripcion: string;
}

/**
 * Separa la marca del resto del texto. Prefiere la marca conocida mas larga cuyas palabras sean prefijo del texto
 * ("Alpura. Clasica" gana a "Alpura"). Si ninguna coincide, toma el texto hasta el primer punto o coma.
 */
export function separarMarca(resto: string, marcas: MarcaConocida[]): MarcaSeparada {
  const tk = tokens(canonizarEscritura(resto));
  const original = canonizarEscritura(resto);
  let mejor: { marca: MarcaConocida; n: number } | null = null;

  for (const marca of marcas) {
    const tm = tokens(marca.nombre).map((t) => t.valor);
    if (tm.length === 0 || tm.length >= tk.length) continue;
    if (tm.every((v, i) => tk[i].valor === v) && (!mejor || tm.length > mejor.n)) {
      mejor = { marca, n: tm.length };
    }
  }

  if (mejor) {
    const fin = tk[mejor.n - 1].fin;
    return {
      marca: mejor.marca,
      textoMarca: original.slice(0, fin).trim(),
      descripcion: limpiarInicio(original.slice(fin)),
    };
  }

  const corte = original.search(/[.,]/);
  return corte > 0
    ? { marca: null, textoMarca: original.slice(0, corte).trim(), descripcion: limpiarInicio(original.slice(corte)) }
    : { marca: null, textoMarca: original.trim(), descripcion: '' };
}

function limpiarInicio(texto: string): string {
  return texto.replace(/^[\s,.;:-]+/, '').trim();
}

/** Texto apto para unidades.ts: "PAQUETE CON 18. BLANCO" -> "PAQUETE C/18 BLANCO". */
export function textoParaUnidades(descripcion: string): string {
  return descripcion
    .replace(/\bcon\s+(\d+)\s*\.?/gi, 'C/$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --------------------------------------------------------------------------------------------
// Direcciones
// --------------------------------------------------------------------------------------------

/** Codigo postal en las direcciones del CSV: "... Col. Centro. Cp. 58000" o "Cp.58350". */
export function extraerCP(direccion: string | null): string | null {
  const m = (direccion ?? '').match(/\bc\.?\s*p\.?\s*(\d{5})\b/i);
  return m ? m[1] : null;
}

/**
 * La API recorta la direccion (~55 caracteres): "ARTILLEROS DE 47 NO. 1520, ENTRE ENRIQUE RAMIREZ Y CURT".
 * Coincide si sus palabras son prefijo de las de la direccion completa del CSV; la ultima puede venir cortada.
 * Si ambas tienen codigo postal, debe ser el mismo.
 */
export function coincideDireccion(
  api: { direccion: string; cp?: string | null },
  existente: string | null
): boolean {
  if (!existente) return false;
  const a = tokens(api.direccion).map((t) => t.valor);
  const b = tokens(existente).map((t) => t.valor);
  if (a.length < 2 || a.length > b.length) return false;

  const cpExistente = extraerCP(existente);
  if (api.cp && cpExistente && api.cp !== cpExistente) return false;

  const ultima = a.length - 1;
  for (let i = 0; i < ultima; i++) if (a[i] !== b[i]) return false;
  return b[ultima].startsWith(a[ultima]);
}

/** Direccion completa para geocodificar o guardar: "CALLE 123, COLONIA, CP 58000". */
export function direccionCompleta(direccion: string, colonia?: string | null, cp?: string | null): string {
  return [direccion.trim(), colonia?.trim() ? `Col. ${colonia.trim()}` : '', cp?.trim() ? `Cp. ${cp.trim()}` : '']
    .filter(Boolean)
    .join('. ');
}
