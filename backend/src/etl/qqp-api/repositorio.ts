import { PoolClient } from 'pg';
import { normalizarTexto } from '../transformar';
import { PresentacionCatalogo, UbicacionExistente } from './emparejar';
import { MarcaConocida } from './texto';

/** Consultas de la sincronizacion QQP. Todas corren dentro de la transaccion de carga. */

export async function obtenerFuenteProfeco(client: PoolClient): Promise<number> {
  const r = await client.query(
    `SELECT id FROM fuentes
     WHERE LOWER(TRIM(nombre)) IN ('profeco', 'profeco qqp') AND LOWER(TRIM(tipo)) = 'profeco'`
  );
  if (r.rows.length > 1) throw new Error('Existen fuentes Profeco duplicadas');
  if (r.rows.length === 1) return r.rows[0].id;
  const nueva = await client.query(`INSERT INTO fuentes (nombre, tipo) VALUES ('Profeco', 'profeco') RETURNING id`);
  return nueva.rows[0].id;
}

export async function cargarMarcas(client: PoolClient): Promise<MarcaConocida[]> {
  const r = await client.query('SELECT id, nombre FROM marcas');
  return r.rows.map((x) => ({ id: x.id, nombre: x.nombre }));
}

/** nombre normalizado -> ids (mas de uno = producto ambiguo). */
export async function cargarProductos(client: PoolClient): Promise<Map<string, number[]>> {
  const r = await client.query('SELECT id, nombre FROM productos');
  const m = new Map<string, number[]>();
  for (const x of r.rows) {
    const k = normalizarTexto(x.nombre);
    m.set(k, [...(m.get(k) ?? []), x.id]);
  }
  return m;
}

export async function presentacionesDeProducto(client: PoolClient, productoId: number): Promise<PresentacionCatalogo[]> {
  const r = await client.query(
    `SELECT pr.id, pr.marca_id, m.nombre AS marca, pr.descripcion, pr.cantidad, u.abreviatura
     FROM presentaciones pr
     JOIN marcas m ON m.id = pr.marca_id
     JOIN unidades u ON u.id = pr.unidad_id
     WHERE pr.producto_id = $1
     ORDER BY pr.id`,
    [productoId]
  );
  return r.rows.map((x) => {
    const abrev = String(x.abreviatura).trim().toLowerCase();
    const factor = abrev === 'kg' || abrev === 'l' ? 1000 : 1;
    return {
      id: x.id,
      marcaId: x.marca_id,
      marcaNombre: x.marca,
      descripcion: x.descripcion,
      cantidad: Number(x.cantidad) * factor,
      unidad: abrev === 'kg' ? 'g' : abrev === 'l' ? 'ml' : abrev,
    };
  });
}

export async function crearPresentacion(
  client: PoolClient,
  productoId: number,
  d: { marcaId: number; descripcion: string; cantidad: number; unidad: string },
  ejecucionId: number
): Promise<number | null> {
  const u = await client.query('SELECT id FROM unidades WHERE LOWER(TRIM(abreviatura)) = $1', [d.unidad]);
  if (u.rows.length !== 1) return null;
  const r = await client.query(
    `INSERT INTO presentaciones (producto_id, marca_id, cantidad, unidad_id, descripcion, creada_por_ejecucion)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [productoId, d.marcaId, d.cantidad, u.rows[0].id, d.descripcion, ejecucionId]
  );
  return r.rows[0].id;
}

export async function buscarComercio(client: PoolClient, nombre: string): Promise<number[]> {
  const r = await client.query(
    `SELECT id FROM comercios
     WHERE LOWER(unaccent(TRIM(regexp_replace(nombre, '[[:space:]]+', ' ', 'g')))) = $1`,
    [normalizarTexto(nombre)]
  );
  return r.rows.map((x) => x.id);
}

/** Como la carga del CSV: un comercio desconocido se registra como Formal. */
export async function crearComercio(client: PoolClient, nombre: string): Promise<number> {
  const r = await client.query(`INSERT INTO comercios (nombre, tipo) VALUES ($1, 'Formal') RETURNING id`, [nombre]);
  return r.rows[0].id;
}

export async function ubicacionesDeComercio(client: PoolClient, comercioId: number): Promise<UbicacionExistente[]> {
  const r = await client.query(
    `SELECT id, direccion, ubicacion IS NOT NULL AS con_punto
     FROM ubicaciones_comercio
     WHERE comercio_id = $1 AND estado_verificacion <> 'Rechazada'`,
    [comercioId]
  );
  return r.rows.map((x) => ({ id: x.id, direccion: x.direccion, tieneCoordenadas: x.con_punto }));
}

export async function crearUbicacion(
  client: PoolClient,
  d: { comercioId: number; direccion: string; referencia: string; punto: { lat: number; lng: number } | null },
  ejecucionId: number
): Promise<number> {
  const r = await client.query(
    `INSERT INTO ubicaciones_comercio (comercio_id, direccion, ubicacion, estado_verificacion, referencia, creada_por_ejecucion)
     VALUES (
       $1, $2,
       CASE WHEN $3::float8 IS NOT NULL THEN ST_SetSRID(ST_MakePoint($4::float8, $3::float8), 4326)::geography END,
       'Pendiente', $5, $6
     )
     RETURNING id`,
    [d.comercioId, d.direccion, d.punto?.lat ?? null, d.punto?.lng ?? null, d.referencia || null, ejecucionId]
  );
  return r.rows[0].id;
}

export async function asignarPunto(client: PoolClient, ubicacionId: number, punto: { lat: number; lng: number }) {
  await client.query(
    `UPDATE ubicaciones_comercio
     SET ubicacion = ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography
     WHERE id = $1 AND ubicacion IS NULL`,
    [ubicacionId, punto.lat, punto.lng]
  );
}

export async function existePrecio(client: PoolClient, clave: string): Promise<boolean> {
  const r = await client.query('SELECT 1 FROM precios WHERE clave_origen = $1', [clave]);
  return r.rows.length > 0;
}

export async function insertarPrecio(
  client: PoolClient,
  d: {
    presentacionId: number;
    comercioId: number;
    ubicacionId: number;
    fuenteId: number;
    precio: number;
    fecha: string;
    clave: string;
    ejecucionId: number;
  }
): Promise<boolean> {
  const r = await client.query(
    `INSERT INTO precios (presentacion_id, comercio_id, ubicacion_id, fuente_id, precio, fecha_obtencion,
                          estado_verificacion, clave_origen, ejecucion_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'Activo', $7, $8)
     ON CONFLICT (clave_origen) DO NOTHING
     RETURNING id`,
    [d.presentacionId, d.comercioId, d.ubicacionId, d.fuenteId, d.precio, d.fecha, d.clave, d.ejecucionId]
  );
  return r.rows.length === 1;
}

export interface DatosExterno {
  ejecucionId: number;
  fuenteId: number;
  clave: string;
  tipo: string;
  textoMarca: string | null;
  resto: string | null;
  precio: number;
  fecha: string;
  comercio: string;
  sucursal: string;
  direccion: string;
  motivo: string;
  original: unknown;
}

/** Devuelve false si la observacion ya estaba pendiente de una ejecucion anterior. */
export async function guardarExterno(client: PoolClient, d: DatosExterno): Promise<boolean> {
  const r = await client.query(
    `INSERT INTO productos_externos (ejecucion_id, fuente_id, clave_origen, producto, marca, presentacion, categoria,
                                     precio, fecha_obtencion, comercio, sucursal, direccion, motivo, datos_originales)
     VALUES ($1, $2, $3, $4, $5, $6, $4, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (clave_origen) DO NOTHING
     RETURNING id`,
    [
      d.ejecucionId, d.fuenteId, d.clave, d.tipo, d.textoMarca, d.resto, d.precio, d.fecha,
      d.comercio, d.sucursal, d.direccion, d.motivo, JSON.stringify(d.original),
    ]
  );
  return r.rows.length === 1;
}

export async function marcarExternoVinculado(client: PoolClient, clave: string, presentacionId: number) {
  await client.query(
    `UPDATE productos_externos
     SET estado = 'vinculado', presentacion_id = $2, vinculado_en = NOW()
     WHERE clave_origen = $1 AND estado = 'pendiente'`,
    [clave, presentacionId]
  );
}

/** Las observaciones invalidas reaparecen mientras sigan en la ventana del buscador: se registran una vez. */
export async function existeDescarte(client: PoolClient, clave: string): Promise<boolean> {
  const r = await client.query('SELECT 1 FROM descartes_ingesta WHERE clave_origen = $1 LIMIT 1', [clave]);
  return r.rows.length > 0;
}

export async function guardarDescarte(
  client: PoolClient,
  d: { ejecucionId: number; clave: string | null; motivo: string; original: unknown }
) {
  await client.query(
    `INSERT INTO descartes_ingesta (ejecucion_id, clave_origen, motivo, datos_originales) VALUES ($1, $2, $3, $4)`,
    [d.ejecucionId, d.clave, d.motivo, JSON.stringify(d.original)]
  );
}
