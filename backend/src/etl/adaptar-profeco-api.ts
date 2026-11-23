import { obtenerProductoCanonico } from './canasta';
import { normalizarTexto } from './transformar';

export interface ProductoAdaptado {
  productoOriginal: string;
  productoCanonico: string | null;
  presentacion: string | null;
  cantidad: number | null;
  unidad: string | null;
  marca: string | null;
  variedad: string | null;
}

export function adaptarProductoProfeco(
  producto: string,
  tipoProducto?: string
): ProductoAdaptado {
  const partes = producto
    .split(',')
    .map(parte => parte.trim())
    .filter(Boolean);

  const tipo = tipoProducto?.trim() || partes[0] || '';

  const productoCanonico = obtenerProductoCanonico(tipo);

  const marcaOriginal = partes.length > 1
    ? partes[1]
    : '';

  const marca = marcaOriginal
    ? normalizarTexto(marcaOriginal)
    : null;

  const textoCompleto = partes.join(', ');

  const patronPesoVolumen =
    /\b(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|lt|lts|l)\b/i;

  const patronPiezas =
    /\b(\d+)\s*(piezas?|pzas?|pzs?|unidades?)\b/i;

  const patronPaquete =
    /\b(?:paquete|bolsa|caja|empaque)\s+(?:con|de)\s+(\d+)\b/i;

  const patronAbreviado =
    /\b(?:paquete|bolsa|caja|empaque)\s+c\/\s*(\d+)\b/i;

  const patronRollos =
    /\b(?:paquete\s+)?(\d+)\s+rollos?\b/i;

  const patronPiezaIndividual =
    /\bpieza\b/i;

  const patronManojo =
    /\bmanojo\b/i;

  let presentacion: string | null = null;
  let cantidad: number | null = null;
  let unidad: string | null = null;
  let variedad: string | null = null;

  const segmentoPeso = partes.find(parte =>
    patronPesoVolumen.test(parte)
  );

  if (segmentoPeso) {
    const coincidencia = segmentoPeso.match(
      patronPesoVolumen
    );

    if (coincidencia) {
      const valor = Number(
        coincidencia[1].replace(',', '.')
      );

      const unidadOriginal =
        coincidencia[2].toLowerCase();

      if (unidadOriginal === 'kg') {
        cantidad = valor * 1000;
        unidad = 'g';
      } else if (
        unidadOriginal === 'lt' ||
        unidadOriginal === 'lts' ||
        unidadOriginal === 'l'
      ) {
        cantidad = valor * 1000;
        unidad = 'ml';
      } else {
        cantidad = valor;
        unidad = unidadOriginal === 'gr'
          ? 'g'
          : unidadOriginal;
      }

      presentacion = `${cantidad} ${unidad}`;

      const resto = segmentoPeso
        .slice(
          coincidencia.index! +
          coincidencia[0].length
        )
        .replace(/^[.\s-]+/, '')
        .trim();

      variedad = resto
        ? normalizarTexto(resto)
        : null;
    }
  } else {
    const coincidenciaRollos =
      textoCompleto.match(patronRollos);

    const coincidenciaPiezas =
      textoCompleto.match(patronPiezas);

    const coincidenciaAbreviada =
      textoCompleto.match(patronAbreviado);

    const coincidenciaPaquete =
      textoCompleto.match(patronPaquete);

    if (coincidenciaRollos) {
      cantidad = Number(coincidenciaRollos[1]);
      unidad = 'rollo';
    } else if (coincidenciaPiezas) {
      cantidad = Number(coincidenciaPiezas[1]);
      unidad = 'pza';
    } else if (coincidenciaAbreviada) {
      cantidad = Number(coincidenciaAbreviada[1]);
      unidad = 'pza';
    } else if (coincidenciaPaquete) {
      cantidad = Number(coincidenciaPaquete[1]);
      unidad = 'pza';
    } else if (patronPiezaIndividual.test(textoCompleto)) {
      cantidad = 1;
      unidad = 'pza';
    } else if (patronManojo.test(textoCompleto)) {
      cantidad = 1;
      unidad = 'manojo';
    }

    if (
      cantidad !== null &&
      Number.isInteger(cantidad) &&
      cantidad > 0 &&
      unidad !== null
    ) {
      presentacion = `${cantidad} ${unidad}`;
    } else {
      cantidad = null;
      unidad = null;
    }
  }

  return {
    productoOriginal: producto,
    productoCanonico,
    presentacion,
    cantidad,
    unidad,
    marca,
    variedad
  };
}