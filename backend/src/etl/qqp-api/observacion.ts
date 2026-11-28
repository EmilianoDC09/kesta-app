import { createHash } from 'node:crypto';
import { normalizarFecha, normalizarTexto } from '../transformar';
import { ObservacionQQP } from './cliente';
import { CONFIG_QQP } from './config';

/**
 * Huella de una observacion del buscador. Solo usa campos crudos de la API (no el resultado del emparejamiento),
 * para que mejorar el emparejamiento no cambie las claves ni duplique precios ya cargados.
 */
export function claveObservacion(o: ObservacionQQP): string {
  const datos = [
    'profeco-qqp-api',
    normalizarTexto(o.tipo_producto),
    normalizarTexto(o.producto),
    normalizarTexto(o.cadena_comercial),
    normalizarTexto(o.establecimiento),
    normalizarTexto(o.direccion),
    o.cp ?? '',
    o.fecha_observacion.trim(),
    o.precio,
  ];
  return createHash('sha256').update(JSON.stringify(datos)).digest('hex');
}

export type Validacion = { valida: true; fecha: string } | { valida: false; motivo: string };

export function validarObservacion(o: ObservacionQQP): Validacion {
  const municipio = normalizarTexto(o.municipio ?? '');
  if (municipio && municipio !== normalizarTexto(CONFIG_QQP.ciudad.nombre)) {
    return { valida: false, motivo: 'Fuera de ciudad piloto' };
  }
  if (!Number.isFinite(o.precio) || o.precio <= 0) return { valida: false, motivo: 'Precio invalido' };
  const fecha = normalizarFecha(o.fecha_observacion ?? '');
  if (!fecha) return { valida: false, motivo: 'Fecha invalida' };
  // Una fecha futura indica un error de captura o de zona horaria; no se publica como precio vigente.
  const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  if (fecha > manana) return { valida: false, motivo: 'Fecha futura' };
  return { valida: true, fecha };
}
