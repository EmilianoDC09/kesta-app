import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { query, queryOne, transaccion } from '../db';
import { AppError, conflicto, idParam, noEncontrado, parse, prohibido } from '../errors';
import { requiereAuth } from '../middleware/auth';
import { limiteEscrituraComunidad } from '../middleware/limites';
import { envoltura, paginacionSchema, paginar } from '../pagination';
import { evaluarAlertasEnSegundoPlano } from '../services/alertas';

export const reportes = Router();
export const reportesError = Router();
reportes.use(requiereAuth);
reportesError.use(requiereAuth);

const reportarSchema = z.object({
  presentacionId: z.number().int().positive(),
  ubicacionId: z.number().int().positive(),
  precio: z.number().positive().max(100_000),
  observadoEn: z.coerce.date().optional(),
  fotoId: z.string().optional(), // COM-01 (fotos) no esta implementado; se acepta y se ignora
});

// COM-02: el reporte entra como precio 'Pendiente' y se publica al verificarse (COM-05) o aprobarse (MOD-02).
reportes.post('/', limiteEscrituraComunidad, async (req, res) => {
  const b = parse(reportarSchema, req.body);
  const uid = req.usuario!.id;
  const ahora = Date.now();
  const observado = b.observadoEn ?? new Date(ahora);
  if (observado.getTime() > ahora + 5 * 60_000) throw new AppError(422, 'validacion', 'observadoEn no puede estar en el futuro');
  if (observado.getTime() < ahora - 48 * 3_600_000) throw new AppError(422, 'validacion', 'Solo se aceptan precios observados en las ultimas 48 horas');

  const ub = await queryOne<{ id: number; comercio_id: number; tipo: string; estado: string; creado_por: number | null }>(
    `SELECT u.id, u.comercio_id, c.tipo, u.estado_verificacion AS estado, u.creado_por FROM ubicaciones_comercio u JOIN comercios c ON c.id = u.comercio_id WHERE u.id = $1`,
    [b.ubicacionId],
  );
  const visible = ub && ((ub.tipo === 'Formal' && ub.estado !== 'Rechazada') || (ub.tipo === 'Informal' && (ub.estado === 'Verificada' || ub.creado_por === uid)));
  if (!visible) throw new AppError(422, 'validacion', 'ubicacionId no existe o aun no esta disponible');
  if (!(await queryOne('SELECT 1 FROM presentaciones WHERE id = $1', [b.presentacionId]))) throw new AppError(422, 'validacion', 'presentacionId no existe');

  const fuente = await queryOne<{ id: number }>(`SELECT id FROM fuentes WHERE tipo = 'comunidad' ORDER BY id LIMIT 1`);
  if (!fuente) throw new AppError(500, 'configuracion', 'Falta una fuente de tipo comunidad en la tabla fuentes');

  const dup = await queryOne(
    `SELECT 1 FROM precios p JOIN fuentes f ON f.id = p.fuente_id
     WHERE p.usuario_id = $1 AND p.presentacion_id = $2 AND p.ubicacion_id = $3 AND f.tipo = 'comunidad' AND p.estado_verificacion <> 'Rechazado' AND p.fecha_obtencion > now() - interval '24 hours'`,
    [uid, b.presentacionId, b.ubicacionId],
  );
  if (dup) throw conflicto('Ya reportaste este producto en esta ubicacion en las ultimas 24 horas');

  // Precio atipico frente a lo publicado en 30 dias: se manda directo a moderacion ademas de quedar abierto a votos.
  const ref = await queryOne<{ med: number | null; n: number }>(
    `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY precio)::float8 AS med, count(*)::int AS n FROM precios
     WHERE presentacion_id = $1 AND estado_verificacion = 'Activo' AND fecha_obtencion > now() - interval '30 days'`,
    [b.presentacionId],
  );
  const atipico = !!ref && ref.n >= 3 && ref.med !== null && (b.precio < ref.med * 0.4 || b.precio > ref.med * 2.5);

  const nuevo = await transaccion(async (c) => {
    const p = (await c.query(
      `INSERT INTO precios (presentacion_id, comercio_id, ubicacion_id, fuente_id, usuario_id, precio, fecha_obtencion, estado_verificacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pendiente') RETURNING id`,
      [b.presentacionId, ub!.comercio_id, ub!.id, fuente.id, uid, b.precio, observado.toISOString()],
    )).rows[0];
    if (atipico) await c.query(`INSERT INTO cola_moderacion (tipo, precio_id, reportado_por, motivo) VALUES ('reporte_precio', $1, $2, 'precio_atipico')`, [p.id, uid]);
    return p.id as number;
  });
  res.status(201).json({ reporteId: nuevo, estado: 'pendiente', enModeracion: atipico, confirmacionesRequeridas: config.verificacion.confirmaciones });
});

const ESTADOS: Record<string, string> = { pendiente: 'Pendiente', aprobado: 'Activo', rechazado: 'Rechazado' };

// COM-03 (antes de /:reporteId)
reportes.get('/mios', async (req, res) => {
  const f = parse(paginacionSchema.extend({ estado: z.enum(['pendiente', 'aprobado', 'rechazado']).optional() }), req.query);
  const { limit, offset } = paginar(f);
  const params: unknown[] = [req.usuario!.id];
  let filtro = '';
  if (f.estado) {
    params.push(ESTADOS[f.estado]);
    filtro = `AND p.estado_verificacion = $${params.length}`;
  }
  params.push(limit, offset);
  const rows = await query(
    `SELECT p.id AS "reporteId", p.precio, p.estado_verificacion AS estado, p.fecha_obtencion AS "observadoEn",
            pr.nombre AS producto, m.nombre AS marca, c.nombre AS comercio, p.ubicacion_id AS "ubicacionId",
            (SELECT count(*)::int FROM verificaciones_precio v WHERE v.precio_id = p.id AND v.resultado = 'confirma') AS confirmaciones,
            (SELECT count(*)::int FROM verificaciones_precio v WHERE v.precio_id = p.id AND v.resultado = 'refuta') AS refutaciones,
            count(*) OVER() AS total
     FROM precios p JOIN fuentes f ON f.id = p.fuente_id AND f.tipo = 'comunidad'
     JOIN presentaciones pres ON pres.id = p.presentacion_id JOIN productos pr ON pr.id = pres.producto_id
     JOIN marcas m ON m.id = pres.marca_id JOIN comercios c ON c.id = p.comercio_id
     WHERE p.usuario_id = $1 ${filtro} ORDER BY p.fecha_obtencion DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = rows[0] ? Number(rows[0].total) : 0;
  const inv = Object.fromEntries(Object.entries(ESTADOS).map(([k, v]) => [v, k]));
  res.json(envoltura(rows.map(({ total: _t, estado, ...r }) => ({ ...r, estado: inv[estado] })), f, total));
});

// COM-04
reportes.get('/pendientes', async (req, res) => {
  const f = parse(z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radioKm: z.coerce.number().positive().max(20).default(2),
    limite: z.coerce.number().int().min(1).max(50).default(20),
  }), req.query);
  const rows = await query(
    `WITH q AS (SELECT ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography AS pt)
     SELECT p.id AS "reporteId", p.precio, p.fecha_obtencion AS "observadoEn", pres.id AS "presentacionId", pr.nombre AS producto, m.nombre AS marca,
            c.nombre AS comercio, u.id AS "ubicacionId", u.direccion, round((ST_Distance(u.ubicacion, q.pt) / 1000.0)::numeric, 2)::float8 AS "distanciaKm",
            (SELECT count(*)::int FROM verificaciones_precio v WHERE v.precio_id = p.id AND v.resultado = 'confirma') AS confirmaciones,
            (SELECT count(*)::int FROM verificaciones_precio v WHERE v.precio_id = p.id AND v.resultado = 'refuta') AS refutaciones
     FROM precios p
     JOIN fuentes f ON f.id = p.fuente_id AND f.tipo = 'comunidad'
     JOIN ubicaciones_comercio u ON u.id = p.ubicacion_id
     JOIN comercios c ON c.id = p.comercio_id
     JOIN presentaciones pres ON pres.id = p.presentacion_id JOIN productos pr ON pr.id = pres.producto_id JOIN marcas m ON m.id = pres.marca_id
     CROSS JOIN q
     WHERE p.estado_verificacion = 'Pendiente' AND p.usuario_id <> $1
       AND u.estado_verificacion = 'Verificada'
       AND ST_DWithin(u.ubicacion, q.pt, $4::float8)
       AND NOT EXISTS (SELECT 1 FROM verificaciones_precio v WHERE v.precio_id = p.id AND v.usuario_id = $1)
     ORDER BY p.fecha_obtencion DESC LIMIT $5`,
    [req.usuario!.id, f.lat, f.lng, f.radioKm * 1000, f.limite],
  );
  res.json({ datos: rows, total: rows.length });
});

const votoSchema = z.object({
  voto: z.enum(['confirma', 'refuta']),
  precioObservado: z.number().positive().max(100_000).optional(),
  comentario: z.string().trim().max(300).optional(),
});

// COM-05
reportes.post('/:reporteId/verificaciones', limiteEscrituraComunidad, async (req, res) => {
  const id = idParam(req.params.reporteId, 'reporteId');
  const b = parse(votoSchema, req.body);
  const uid = req.usuario!.id;

  const out = await transaccion(async (c) => {
    const p = (await c.query(
      `SELECT p.id, p.usuario_id, p.precio, p.presentacion_id, p.estado_verificacion AS estado, f.tipo AS fuente
       FROM precios p JOIN fuentes f ON f.id = p.fuente_id WHERE p.id = $1 FOR UPDATE OF p`,
      [id],
    )).rows[0];
    if (!p || p.fuente !== 'comunidad') throw noEncontrado('Reporte');
    if (p.estado !== 'Pendiente') throw conflicto('Este reporte ya fue resuelto');
    if (p.usuario_id === uid) throw prohibido('No puedes verificar tu propio reporte');
    if (b.voto === 'confirma' && b.precioObservado !== undefined && Math.abs(b.precioObservado - p.precio) > 0.001) {
      throw new AppError(422, 'validacion', 'Si viste otro precio, usa voto "refuta" con precioObservado');
    }
    const v = (await c.query(
      `INSERT INTO verificaciones_precio (precio_id, usuario_id, resultado, precio_observado, comentario) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (precio_id, usuario_id) DO NOTHING RETURNING id`,
      [id, uid, b.voto, b.precioObservado ?? null, b.comentario ?? null],
    )).rows[0];
    if (!v) throw conflicto('Ya votaste este reporte');
    await c.query(
      `INSERT INTO reputacion_usuarios (usuario_id, verificaciones_realizadas) VALUES ($1, 1)
       ON CONFLICT (usuario_id) DO UPDATE SET verificaciones_realizadas = reputacion_usuarios.verificaciones_realizadas + 1`,
      [uid],
    );
    const cnt = (await c.query(
      `SELECT count(*) FILTER (WHERE resultado = 'confirma')::int AS conf, count(*) FILTER (WHERE resultado = 'refuta')::int AS ref FROM verificaciones_precio WHERE precio_id = $1`,
      [id],
    )).rows[0];

    let estado = 'pendiente';
    if (cnt.conf >= config.verificacion.confirmaciones) {
      await c.query(`UPDATE precios SET estado_verificacion = 'Activo' WHERE id = $1`, [id]);
      estado = 'aprobado';
    } else if (cnt.ref >= config.verificacion.refutaciones) {
      await c.query(
        `INSERT INTO cola_moderacion (tipo, precio_id, reportado_por, motivo) VALUES ('reporte_precio', $1, $2, 'refutado_por_comunidad') ON CONFLICT (precio_id) WHERE tipo = 'reporte_precio' AND estado = 'pendiente' DO NOTHING`,
        [id, uid],
      );
      estado = 'en_moderacion';
    }
    return { estado, confirmaciones: cnt.conf as number, refutaciones: cnt.ref as number, presentacionId: p.presentacion_id as number };
  });
  if (out.estado === 'aprobado') evaluarAlertasEnSegundoPlano([out.presentacionId]);
  res.status(201).json({ reporteId: id, estado: out.estado, confirmaciones: out.confirmaciones, refutaciones: out.refutaciones });
});

// COM-06: se monta en /precios
const errorSchema = z.object({
  motivo: z.enum(['precio_desactualizado', 'precio_incorrecto', 'producto_incorrecto', 'otro']),
  comentario: z.string().trim().max(300).optional(),
});

reportesError.post('/:precioId/reportes-error', limiteEscrituraComunidad, async (req, res) => {
  const id = idParam(req.params.precioId, 'precioId');
  const b = parse(errorSchema, req.body);
  if (!(await queryOne('SELECT 1 FROM precios WHERE id = $1', [id]))) throw noEncontrado('Precio');
  const r = await queryOne(
    `INSERT INTO cola_moderacion (tipo, precio_id, reportado_por, motivo, comentario) VALUES ('reporte_error', $1, $2, $3, $4)
     ON CONFLICT (precio_id, reportado_por) WHERE tipo = 'reporte_error' AND estado = 'pendiente' DO NOTHING RETURNING id`,
    [id, req.usuario!.id, b.motivo, b.comentario ?? null],
  );
  if (!r) throw conflicto('Ya reportaste un error en este precio y esta pendiente de revision');
  res.status(201).json({ elementoModeracionId: r.id, estado: 'pendiente' });
});
