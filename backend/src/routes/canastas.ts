import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { AppError, conflicto, idParam, noEncontrado, parse } from '../errors';
import { requiereAuth } from '../middleware/auth';
import { optimizarMultiTienda, optimizarUnaTienda } from '../services/optimizador';
import { preciosVigentesCercanos, redondear } from '../services/precios';

export const canastas = Router();
canastas.use(requiereAuth);

const MAX_CANASTAS = 20;
const MAX_ITEMS = 100;

/** Devuelve la canasta solo si es del usuario; si no, 404 (no revela que existe). */
async function canastaPropia(canastaId: number, usuarioId: number) {
  const c = await queryOne<{ id: number; nombre: string; fecha_creacion: Date }>('SELECT id, nombre, fecha_creacion FROM canastas WHERE id = $1 AND usuario_id = $2', [canastaId, usuarioId]);
  if (!c) throw noEncontrado('Canasta');
  return c;
}

const nombreSchema = z.object({ nombre: z.string().trim().min(1).max(100) });

// CAN-01
canastas.post('/', async (req, res) => {
  const b = parse(nombreSchema, req.body);
  const n = (await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM canastas WHERE usuario_id = $1', [req.usuario!.id]))!.n;
  if (n >= MAX_CANASTAS) throw conflicto(`Maximo ${MAX_CANASTAS} canastas por usuario`);
  const c = await queryOne('INSERT INTO canastas (usuario_id, nombre) VALUES ($1, $2) RETURNING id, nombre, fecha_creacion AS "fechaCreacion"', [req.usuario!.id, b.nombre]);
  res.status(201).json(c);
});

// CAN-02
canastas.get('/', async (req, res) => {
  const rows = await query(
    `SELECT c.id, c.nombre, c.fecha_creacion AS "fechaCreacion", count(cp.id)::int AS "numeroProductos"
     FROM canastas c LEFT JOIN canasta_productos cp ON cp.canasta_id = c.id WHERE c.usuario_id = $1 GROUP BY c.id ORDER BY c.fecha_creacion DESC`,
    [req.usuario!.id],
  );
  res.json({ datos: rows });
});

// CAN-03: el precio de referencia es el promedio de los precios vigentes (activos) de todas las ubicaciones, sin filtro geografico.
canastas.get('/:canastaId', async (req, res) => {
  const c = await canastaPropia(idParam(req.params.canastaId, 'canastaId'), req.usuario!.id);
  const items = await query(
    `SELECT cp.id AS "itemId", cp.presentacion_id AS "presentacionId", cp.cantidad, pr.nombre AS producto, m.nombre AS marca,
            pres.cantidad AS contenido, u.abreviatura AS unidad, ref.precio_ref AS "precioReferencia"
     FROM canasta_productos cp
     JOIN presentaciones pres ON pres.id = cp.presentacion_id
     JOIN productos pr ON pr.id = pres.producto_id
     JOIN marcas m ON m.id = pres.marca_id
     JOIN unidades u ON u.id = pres.unidad_id
     LEFT JOIN LATERAL (
       SELECT round(avg(v.precio), 2) AS precio_ref FROM (
         SELECT DISTINCT ON (p.comercio_id, p.ubicacion_id) p.precio FROM precios p
         WHERE p.presentacion_id = cp.presentacion_id AND p.estado_verificacion = 'Activo'
         ORDER BY p.comercio_id, p.ubicacion_id, p.fecha_obtencion DESC) v
     ) ref ON TRUE
     WHERE cp.canasta_id = $1 ORDER BY pr.nombre, cp.id`,
    [c.id],
  );
  const total = items.reduce((s, i) => s + (i.precioReferencia ?? 0) * i.cantidad, 0);
  res.json({
    id: c.id,
    nombre: c.nombre,
    fechaCreacion: c.fecha_creacion,
    productos: items.map((i) => ({ ...i, subtotalReferencia: i.precioReferencia === null ? null : redondear(i.precioReferencia * i.cantidad) })),
    totalReferencia: redondear(total),
    productosSinReferencia: items.filter((i) => i.precioReferencia === null).length,
  });
});

const itemSchema = z.object({ presentacionId: z.number().int().positive(), cantidad: z.number().positive().max(1000) });

// CAN-04: si la presentacion ya esta en la canasta, suma la cantidad
canastas.post('/:canastaId/items', async (req, res) => {
  const c = await canastaPropia(idParam(req.params.canastaId, 'canastaId'), req.usuario!.id);
  const b = parse(itemSchema, req.body);
  if (!(await queryOne('SELECT 1 FROM presentaciones WHERE id = $1', [b.presentacionId]))) throw new AppError(422, 'validacion', 'presentacionId no existe');
  const n = (await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM canasta_productos WHERE canasta_id = $1', [c.id]))!.n;
  const existe = await queryOne('SELECT 1 FROM canasta_productos WHERE canasta_id = $1 AND presentacion_id = $2', [c.id, b.presentacionId]);
  if (!existe && n >= MAX_ITEMS) throw conflicto(`Maximo ${MAX_ITEMS} productos por canasta`);
  const it = await queryOne(
    `INSERT INTO canasta_productos (canasta_id, presentacion_id, cantidad) VALUES ($1, $2, $3)
     ON CONFLICT (canasta_id, presentacion_id) DO UPDATE SET cantidad = canasta_productos.cantidad + EXCLUDED.cantidad
     RETURNING id AS "itemId", presentacion_id AS "presentacionId", cantidad`,
    [c.id, b.presentacionId, b.cantidad],
  );
  res.status(existe ? 200 : 201).json(it);
});

// CAN-05
canastas.put('/:canastaId/items/:itemId', async (req, res) => {
  const c = await canastaPropia(idParam(req.params.canastaId, 'canastaId'), req.usuario!.id);
  const b = parse(z.object({ cantidad: z.number().positive().max(1000) }), req.body);
  const it = await queryOne(
    `UPDATE canasta_productos SET cantidad = $3 WHERE id = $2 AND canasta_id = $1 RETURNING id AS "itemId", presentacion_id AS "presentacionId", cantidad`,
    [c.id, idParam(req.params.itemId, 'itemId'), b.cantidad],
  );
  if (!it) throw noEncontrado('Producto de la canasta');
  res.json(it);
});

// CAN-06
canastas.delete('/:canastaId/items/:itemId', async (req, res) => {
  const c = await canastaPropia(idParam(req.params.canastaId, 'canastaId'), req.usuario!.id);
  const r = await query('DELETE FROM canasta_productos WHERE id = $2 AND canasta_id = $1 RETURNING id', [c.id, idParam(req.params.itemId, 'itemId')]);
  if (r.length === 0) throw noEncontrado('Producto de la canasta');
  res.status(204).end();
});

// CAN-07
canastas.delete('/:canastaId', async (req, res) => {
  const c = await canastaPropia(idParam(req.params.canastaId, 'canastaId'), req.usuario!.id);
  await query('DELETE FROM canastas WHERE id = $1', [c.id]);
  res.status(204).end();
});

// CAN-08
const optSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radioKm: z.coerce.number().positive().max(50).default(5),
  estrategia: z.enum(['una_tienda', 'multi_tienda']).default('una_tienda'),
  maxTiendas: z.coerce.number().int().min(2).max(4).default(2),
});

canastas.get('/:canastaId/optimizacion', async (req, res) => {
  const c = await canastaPropia(idParam(req.params.canastaId, 'canastaId'), req.usuario!.id);
  const f = parse(optSchema, req.query);
  const items = (await query(
    `SELECT cp.presentacion_id AS "presentacionId", cp.cantidad, pr.nombre || ' ' || m.nombre || ' ' || pres.cantidad::text || u.abreviatura AS etiqueta
     FROM canasta_productos cp JOIN presentaciones pres ON pres.id = cp.presentacion_id JOIN productos pr ON pr.id = pres.producto_id
     JOIN marcas m ON m.id = pres.marca_id JOIN unidades u ON u.id = pres.unidad_id WHERE cp.canasta_id = $1`,
    [c.id],
  )) as Array<{ presentacionId: number; cantidad: number; etiqueta: string }>;
  if (items.length === 0) throw new AppError(422, 'canasta_vacia', 'La canasta no tiene productos');

  const filas = await preciosVigentesCercanos({ presentacionIds: items.map((i) => i.presentacionId), lat: f.lat, lng: f.lng, radioKm: f.radioKm });
  const una = optimizarUnaTienda(items, filas);
  if (f.estrategia === 'una_tienda') {
    res.json({ canastaId: c.id, estrategia: 'una_tienda', radioKm: f.radioKm, ...una });
    return;
  }
  const multi = optimizarMultiTienda(items, filas, f.maxTiendas);
  const mejorUna = una.mejorOpcion && una.mejorOpcion.completa ? una.mejorOpcion.total : null;
  res.json({
    canastaId: c.id,
    estrategia: 'multi_tienda',
    maxTiendas: f.maxTiendas,
    radioKm: f.radioKm,
    ...multi,
    ahorroVsMejorUnaTienda: multi.completa && mejorUna !== null ? redondear(mejorUna - multi.total) : null,
    ahorroVsOpcionMasCara: una.totalOpcionMasCara !== null && multi.completa ? redondear(una.totalOpcionMasCara - multi.total) : null,
    nota: 'El traslado entre tiendas no esta incluido en el costo; evalua si el ahorro justifica visitar mas de una.',
  });
});
