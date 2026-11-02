import { Router } from 'express';
import { z } from 'zod';
import { query, transaccion } from '../db';
import { conflicto, idParam, noEncontrado, parse } from '../errors';
import { requiereAuth, requiereRol } from '../middleware/auth';
import { envoltura, paginacionSchema, paginar } from '../pagination';
import { evaluarAlertasEnSegundoPlano } from '../services/alertas';

export const moderacion = Router();
moderacion.use(requiereAuth, requiereRol('moderador', 'admin'));

// MOD-01: del mas antiguo al mas reciente
moderacion.get('/', async (req, res) => {
  const f = parse(paginacionSchema.extend({
    tipo: z.enum(['reporte_precio', 'comercio', 'reporte_error']).optional(),
    estado: z.enum(['pendiente', 'aprobado', 'rechazado']).default('pendiente'),
  }), req.query);
  const { limit, offset } = paginar(f);
  const params: unknown[] = [f.estado];
  let filtro = '';
  if (f.tipo) {
    params.push(f.tipo);
    filtro = `AND q.tipo = $${params.length}`;
  }
  params.push(limit, offset);
  const rows = await query(
    `SELECT q.id, q.tipo, q.estado, q.motivo, q.comentario, q.creado_en AS "creadoEn", ur.nombre AS "reportadoPor",
      CASE WHEN q.precio_id IS NOT NULL THEN json_build_object(
        'precioId', p.id, 'precio', p.precio, 'estado', p.estado_verificacion, 'fecha', p.fecha_obtencion,
        'producto', pr.nombre || ' ' || m.nombre, 'comercio', c.nombre, 'ubicacionId', p.ubicacion_id,
        'confirmaciones', (SELECT count(*)::int FROM verificaciones_precio v WHERE v.precio_id = p.id AND v.resultado = 'confirma'),
        'refutaciones', (SELECT count(*)::int FROM verificaciones_precio v WHERE v.precio_id = p.id AND v.resultado = 'refuta')) END AS precio,
      CASE WHEN q.ubicacion_comercio_id IS NOT NULL THEN json_build_object(
        'ubicacionId', u.id, 'comercio', cu.nombre, 'tipo', cu.subtipo, 'direccion', u.direccion, 'mercado', u.mercado, 'referencia', u.referencia,
        'lat', ST_Y(u.ubicacion::geometry), 'lng', ST_X(u.ubicacion::geometry)) END AS comercio,
      count(*) OVER() AS total
     FROM cola_moderacion q
     LEFT JOIN usuarios ur ON ur.id = q.reportado_por
     LEFT JOIN precios p ON p.id = q.precio_id
     LEFT JOIN presentaciones pres ON pres.id = p.presentacion_id LEFT JOIN productos pr ON pr.id = pres.producto_id
     LEFT JOIN marcas m ON m.id = pres.marca_id LEFT JOIN comercios c ON c.id = p.comercio_id
     LEFT JOIN ubicaciones_comercio u ON u.id = q.ubicacion_comercio_id LEFT JOIN comercios cu ON cu.id = u.comercio_id
     WHERE q.estado = $1 ${filtro} ORDER BY q.creado_en ASC, q.id ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = rows[0] ? Number(rows[0].total) : 0;
  res.json(envoltura(rows.map(({ total: _t, ...r }) => r), f, total));
});

// MOD-02
const resolverSchema = z.object({ decision: z.enum(['aprobar', 'rechazar']), motivo: z.string().trim().max(300).optional() });

moderacion.put('/:itemId', async (req, res) => {
  const id = idParam(req.params.itemId, 'itemId');
  const b = parse(resolverSchema, req.body);
  const aprobar = b.decision === 'aprobar';

  const out = await transaccion(async (c) => {
    const it = (await c.query(`SELECT id, tipo, estado, precio_id, ubicacion_comercio_id FROM cola_moderacion WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!it) throw noEncontrado('Elemento de moderacion');
    if (it.estado !== 'pendiente') throw conflicto('Este elemento ya fue resuelto');

    let presentacionPublicada: number | null = null;
    if (it.tipo === 'reporte_precio') {
      const r = (await c.query(`UPDATE precios SET estado_verificacion = $2 WHERE id = $1 RETURNING presentacion_id`, [it.precio_id, aprobar ? 'Activo' : 'Rechazado'])).rows[0];
      if (aprobar) presentacionPublicada = r.presentacion_id;
    } else if (it.tipo === 'comercio') {
      await c.query(
        `UPDATE ubicaciones_comercio SET estado_verificacion = $2, fecha_verificacion = CURRENT_TIMESTAMP WHERE id = $1`,
        [it.ubicacion_comercio_id, aprobar ? 'Verificada' : 'Rechazada'],
      );
    } else if (it.tipo === 'reporte_error' && aprobar) {
      // El error es real: el precio deja de ser vigente (el anterior vuelve a serlo). Los snapshots no se borran.
      await c.query(`UPDATE precios SET estado_verificacion = 'Rechazado' WHERE id = $1`, [it.precio_id]);
    }
    await c.query(
      `UPDATE cola_moderacion SET estado = $2, resuelto_por = $3, resuelto_en = CURRENT_TIMESTAMP, motivo_resolucion = $4 WHERE id = $1`,
      [id, aprobar ? 'aprobado' : 'rechazado', req.usuario!.id, b.motivo ?? null],
    );
    return presentacionPublicada;
  });
  if (out !== null) evaluarAlertasEnSegundoPlano([out]);
  res.json({ id, estado: aprobar ? 'aprobado' : 'rechazado' });
});
