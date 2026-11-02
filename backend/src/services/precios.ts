import { PoolClient } from 'pg';
import { config } from '../config';
import { pool } from '../db';

export interface PrecioCercano {
  precio_id: number;
  presentacion_id: number;
  precio: number;
  fecha_obtencion: Date;
  estado_verificacion: string;
  comercio_id: number;
  comercio: string;
  canal: 'Formal' | 'Informal';
  fuente: string;
  fuente_nombre: string;
  ubicacion_id: number;
  direccion: string | null;
  ubicacion_estado: string;
  distancia_km: number;
  lat: number;
  lng: number;
}

export interface OpcionesCercanos {
  presentacionIds: number[];
  lat: number;
  lng: number;
  radioKm: number;
  /** Si es false se incluyen reportes comunitarios aun pendientes de verificar. */
  soloVerificados?: boolean;
  fuente?: 'todas' | 'profeco' | 'scraping' | 'comunidad';
  canal?: 'formal' | 'informal';
}

/**
 * Consulta central de la API. Devuelve, por presentacion y ubicacion, el precio vigente (ultima captura)
 * dentro del radio. Reglas:
 *  - Los precios son snapshots: el vigente es el mas reciente por (presentacion, comercio, ubicacion).
 *  - Un precio con ubicacion_id NULL es de cadena (scraping/Profeco) y aplica a todas las ubicaciones del comercio.
 *  - Una ubicacion informal solo es visible si esta 'Verificada'; una formal, si no fue rechazada.
 *  - Si una ubicacion tiene precio de cadena y precio local, gana el mas reciente.
 */
export async function preciosVigentesCercanos(o: OpcionesCercanos, client: Pick<PoolClient, 'query'> = pool): Promise<PrecioCercano[]> {
  if (o.presentacionIds.length === 0) return [];
  const estados = o.soloVerificados === false ? ['Activo', 'Pendiente'] : ['Activo'];
  const params: unknown[] = [o.presentacionIds, o.lat, o.lng, o.radioKm * 1000, estados];
  let filtroFuente = '';
  if (o.fuente && o.fuente !== 'todas') {
    params.push(o.fuente);
    filtroFuente = `AND f.tipo = $${params.length}`;
  }
  let filtroCanal = '';
  if (o.canal) {
    params.push(o.canal === 'formal' ? 'Formal' : 'Informal');
    filtroCanal = `AND c.tipo = $${params.length}`;
  }
  const sql = `
    WITH ult AS (
      SELECT DISTINCT ON (p.presentacion_id, p.comercio_id, p.ubicacion_id) p.*
      FROM precios p
      WHERE p.presentacion_id = ANY($1::int[]) AND p.estado_verificacion = ANY($5::text[])
      ORDER BY p.presentacion_id, p.comercio_id, p.ubicacion_id, p.fecha_obtencion DESC, p.id DESC
    ), q AS (SELECT ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography AS pt),
    por_ubicacion AS (
      SELECT DISTINCT ON (ult.presentacion_id, u.id)
        ult.id AS precio_id, ult.presentacion_id, ult.precio, ult.fecha_obtencion, ult.estado_verificacion,
        c.id AS comercio_id, c.nombre AS comercio, c.tipo AS canal, f.tipo AS fuente, f.nombre AS fuente_nombre,
        u.id AS ubicacion_id, u.direccion, u.estado_verificacion AS ubicacion_estado,
        ST_Distance(u.ubicacion, q.pt) / 1000.0 AS distancia_km,
        ST_Y(u.ubicacion::geometry) AS lat, ST_X(u.ubicacion::geometry) AS lng
      FROM ult
      JOIN comercios c ON c.id = ult.comercio_id
      JOIN fuentes f ON f.id = ult.fuente_id
      JOIN ubicaciones_comercio u ON u.comercio_id = ult.comercio_id AND (ult.ubicacion_id IS NULL OR u.id = ult.ubicacion_id)
      CROSS JOIN q
      WHERE ST_DWithin(u.ubicacion, q.pt, $4::float8)
        AND ((c.tipo = 'Informal' AND u.estado_verificacion = 'Verificada')
          OR (c.tipo = 'Formal' AND u.estado_verificacion <> 'Rechazada'))
        ${filtroFuente} ${filtroCanal}
      ORDER BY ult.presentacion_id, u.id, ult.fecha_obtencion DESC, ult.id DESC
    )
    SELECT * FROM por_ubicacion ORDER BY presentacion_id, precio, distancia_km`;
  const r = await client.query(sql, params);
  return r.rows;
}

export function estaDesactualizado(fuenteTipo: string, fecha: Date, ahora = new Date()): boolean {
  const dias = config.vigenciaDias[fuenteTipo] ?? 14;
  return (ahora.getTime() - fecha.getTime()) / 86_400_000 > dias;
}

export function presentarPrecio(p: PrecioCercano) {
  return {
    precioId: p.precio_id,
    presentacionId: p.presentacion_id,
    precio: p.precio,
    moneda: 'MXN',
    fuente: p.fuente,
    fuenteNombre: p.fuente_nombre,
    fechaCaptura: p.fecha_obtencion.toISOString(),
    estadoVerificacion: p.estado_verificacion,
    desactualizado: estaDesactualizado(p.fuente, p.fecha_obtencion),
    comercio: { id: p.comercio_id, nombre: p.comercio, canal: p.canal.toLowerCase() },
    ubicacion: {
      id: p.ubicacion_id,
      direccion: p.direccion,
      lat: p.lat,
      lng: p.lng,
      distanciaKm: Math.round(p.distancia_km * 100) / 100,
    },
  };
}

export function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export const redondear = (n: number) => Math.round(n * 100) / 100;
