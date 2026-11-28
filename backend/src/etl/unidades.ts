import { normalizarTexto } from './transformar';

export interface PresentacionNormalizada {
  cantidad: number;
  unidad: 'g' | 'ml' | 'pza' | 'rollo' | 'manojo';
}

export function normalizarPresentacion(
  presentacion: string
): PresentacionNormalizada | null {

  let texto = normalizarTexto(presentacion);

  // Rechazar presentaciones con cantidades alternativas.
  if (/\d+(?:[.,]\d+)?\s+o\s+\d/.test(texto)) {
  return null;
}

// Azucar mascabado: 50 sobres de 4 gramos = 200 gramos.
  if (
    texto ===
      'caja 200 gr. (50 sobres de 4 gr. c/u). mascabado'
) {
  return { cantidad: 200, unidad: 'g' };
}

  // Productos vendidos individualmente.
  if (/^pieza(?:\.|$)/.test(texto)) {
    return { cantidad: 1, unidad: 'pza' };
  }

  // Productos vendidos por manojo.
  if (/^manojo(?:\.|$)/.test(texto)) {
    return { cantidad: 1, unidad: 'manojo' };
  }

  // Paquetes de huevo.
  const paqueteHuevo = texto.match(
    /^paquete\s+c\/\s*(\d+)\s+(?:blanco|rojo)$/
  );

  if (paqueteHuevo) {
    const cantidad = Number(paqueteHuevo[1]);

    return cantidad > 0
      ? { cantidad, unidad: 'pza' }
      : null;
  }

  // Paquetes de papel higienico.
  const paqueteRollos = texto.match(
    /^paquete\s+(\d+)\s+rollos?\b/
  );

  if (paqueteRollos) {
    const cantidad = Number(paqueteRollos[1]);

    return cantidad > 0
      ? { cantidad, unidad: 'rollo' }
      : null;
  }

  // Proporciones de carne y grasa.
  // No representan cantidades del paquete.
  if (texto.includes('molida')) {
    texto = texto.replace(
      /\b(?:80\/20|90\/10)\b/g,
      ''
    );
  }

  // Evitar paquetes multiples y rangos ambiguos.
  if (/\d\s*(?:x|×|\/|-)\s*\d/.test(texto)) {
    return null;
  }

  const patron =
    /(\d+(?:[.,]\d+)?)\s*(kilogramos?|kilos?|kg|gramos?|gr|g|mililitros?|ml|litros?|lts?|l|piezas?|pzas?|unidades?)\b/g;

  const coincidencias = [...texto.matchAll(patron)];

  if (coincidencias.length !== 1) {
    return null;
  }

  const coincidencia = coincidencias[0];
  const cantidadTexto = coincidencia[1];

  // Separadores numericos ambiguos.
  if (/[.,]\d{3}$/.test(cantidadTexto)) {
    return null;
  }

  const cantidad = Number(
    cantidadTexto.replace(',', '.')
  );

  const unidad = coincidencia[2];

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return null;
  }

  switch (unidad) {
    case 'kg':
    case 'kilo':
    case 'kilos':
    case 'kilogramo':
    case 'kilogramos':
      return {
        cantidad: cantidad * 1000,
        unidad: 'g'
      };

    case 'g':
    case 'gr':
    case 'gramo':
    case 'gramos':
      return { cantidad, unidad: 'g' };

    case 'l':
    case 'lt':
    case 'lts':
    case 'litro':
    case 'litros':
      return {
        cantidad: cantidad * 1000,
        unidad: 'ml'
      };

    case 'ml':
    case 'mililitro':
    case 'mililitros':
      return { cantidad, unidad: 'ml' };

    case 'pza':
    case 'pzas':
    case 'pieza':
    case 'piezas':
    case 'unidad':
    case 'unidades':
      return Number.isInteger(cantidad)
        ? { cantidad, unidad: 'pza' }
        : null;

    default:
      return null;
  }
}