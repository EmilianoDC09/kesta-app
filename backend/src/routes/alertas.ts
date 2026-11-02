import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { AppError, conflicto, idParam, noEncontrado, parse } from '../errors';
import { requiereAuth, requiereRol } from '../middleware/auth';
import { envoltura, paginacionSchema, paginar } from '../pagination';
import { evaluarAlertas } from '../services/alertas';

const MAX_ALERTAS = 30;

// ---- Dispositivos (ALE-01, ALE-02): se montan en /dispositivos
export const dispositivos = Router();
dispositivos.use(requiereAuth);

dispositivos.post('/', async (req, res) => {
  const b = parse(z.object({ plataforma: z.enum(['android', 'ios']), fcmToken: z.string().min(20).max(4096) }), req.body);
  // Si el token ya existia (otro usuario uso este telefono antes), pasa al usuario actual.
  const d = await queryOne(
    `INSERT INTO dispositivos (usuario_id, plataforma, fcm_token) VALUES ($1, $2, $3)
     ON CONFLICT (fcm_token) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, plataforma = EXCLUDED.plataforma
     RETURNING id AS "dispositivoId", plataforma`,
    [req.usuario!.id, b.plataforma, b.fcmToken],
  );
  res.status(201).json(d);
});

dispositivos.delete('/:dispositivoId', async (req, res) => {
  const r = await query('DELETE FROM dispositivos WHERE id = $1 AND usuario_id = $2 RETURNING id', [idParam(req.params.dispositivoId, 'dispositivoId'), req.usuario!.id]);
  if (r.length === 0) throw noEncontrado('Dispositivo');
  res.status(204).end();
});

// ---- Alertas (ALE-03..06): se montan en /alertas
export const alertas = Router();
alertas.use(requiereAuth);

const SELECT_ALERTA = `
  SELECT a.id, a.presentacion_id AS "presentacionId", pr.nombre || ' ' || m.nombre AS producto, a.precio_objetivo AS "precioObjetivo",
         json_build_object('lat', ST_Y(a.centro::geometry), 'lng', ST_X(a.centro::geometry)) AS centro,
         a.radio_km AS "radioKm", a.activa, a.fecha_creacion AS "fechaCreacion"
  FROM alertas_precio a JOIN presentaciones pres ON pres.id = a.presentacion_id
  JOIN productos pr ON pr.id = pres.producto_id JOIN marcas m ON m.id = pres.marca_id`;

const crearSchema = z.object({
  presentacionId: z.number().int().positive(),
  precioObjetivo: z.number().positive().max(100_000),
  centro: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  radioKm: z.number().positive().max(50).default(5),
});

alertas.post('/', async (req, res) => {
  const b = parse(crearSchema, req.body);
  if (!(await queryOne('SELECT 1 FROM presentaciones WHERE id = $1', [b.presentacionId]))) throw new AppError(422, 'validacion', 'presentacionId no existe');
  const n = (await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM alertas_precio WHERE usuario_id = $1', [req.usuario!.id]))!.n;
  if (n >= MAX_ALERTAS) throw conflicto(`Maximo ${MAX_ALERTAS} alertas por usuario`);
  const r = await queryOne<{ id: number }>(
    `INSERT INTO alertas_precio (usuario_id, presentacion_id, precio_objetivo, centro, radio_km)
     VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6) RETURNING id`,
    [req.usuario!.id, b.presentacionId, b.precioObjetivo, b.centro.lat, b.centro.lng, b.radioKm],
  );
  res.status(201).json(await queryOne(`${SELECT_ALERTA} WHERE a.id = $1`, [r!.id]));
});

alertas.get('/', async (req, res) => {
  const f = parse(z.object({ activa: z.enum(['true', 'false']).transform((v) => v === 'true').optional() }), req.query);
  const params: unknown[] = [req.usuario!.id];
  let filtro = '';
  if (f.activa !== undefined) {
    params.push(f.activa);
    filtro = `AND a.activa = $2`;
  }
  res.json({ datos: await query(`${SELECT_ALERTA} WHERE a.usuario_id = $1 ${filtro} ORDER BY a.id DESC`, params) });
});

const modificarSchema = z.object({
  precioObjetivo: z.number().positive().max(100_000).optional(),
  radioKm: z.number().positive().max(50).optional(),
  activa: z.boolean().optional(),
});

alertas.put('/:alertaId', async (req, res) => {
  const id = idParam(req.params.alertaId, 'alertaId');
  const b = parse(modificarSchema, req.body);
  // Al cambiar el objetivo o reactivar, se rearma la alerta para que pueda volver a notificar.
  const r = await queryOne(
    `UPDATE alertas_precio SET precio_objetivo = COALESCE($3, precio_objetivo), radio_km = COALESCE($4, radio_km), activa = COALESCE($5, activa),
       ultimo_precio_notificado = CASE WHEN $3::numeric IS NOT NULL OR $5::boolean IS TRUE THEN NULL ELSE ultimo_precio_notificado END
     WHERE id = $1 AND usuario_id = $2 RETURNING id`,
    [id, req.usuario!.id, b.precioObjetivo ?? null, b.radioKm ?? null, b.activa ?? null],
  );
  if (!r) throw noEncontrado('Alerta');
  res.json(await queryOne(`${SELECT_ALERTA} WHERE a.id = $1`, [id]));
});

alertas.delete('/:alertaId', async (req, res) => {
  const r = await query('DELETE FROM alertas_precio WHERE id = $1 AND usuario_id = $2 RETURNING id', [idParam(req.params.alertaId, 'alertaId'), req.usuario!.id]);
  if (r.length === 0) throw noEncontrado('Alerta');
  res.status(204).end();
});

// ---- Notificaciones (ALE-07): se montan en /notificaciones
export const notificaciones = Router();
notificaciones.use(requiereAuth);

notificaciones.get('/', async (req, res) => {
  const f = parse(paginacionSchema, req.query);
  const { limit, offset } = paginar(f);
  const rows = await query(
    `SELECT id, alerta_id AS "alertaId", titulo, cuerpo, fecha_envio AS "fechaEnvio", count(*) OVER() AS total
     FROM notificaciones WHERE usuario_id = $1 ORDER BY fecha_envio DESC, id DESC LIMIT $2 OFFSET $3`,
    [req.usuario!.id, limit, offset],
  );
  const total = rows[0] ? Number(rows[0].total) : 0;
  res.json(envoltura(rows.map(({ total: _t, ...r }) => r), f, total));
});

// ---- ALE-08: se monta en /admin/alertas
export const adminAlertas = Router();
adminAlertas.use(requiereAuth, requiereRol('admin'));
adminAlertas.post('/evaluar', async (req, res) => {
  const b = parse(z.object({ presentacionIds: z.array(z.number().int().positive()).max(200).optional() }), req.body ?? {});
  res.json(await evaluarAlertas(b.presentacionIds));
});
