import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne, transaccion } from '../db';
import { AppError, idParam, noEncontrado, parse } from '../errors';
import { requiereAuth } from '../middleware/auth';
import { limiteEscrituraComunidad } from '../middleware/limites';
import { envoltura, paginacionSchema, paginar } from '../pagination';
import { direccionInversa } from '../services/geocodificacion';

export const comercios = Router();

// CAT-06: informal solo si esta Verificada; formal si no fue rechazada (regla general del README, decision 3).
const VISIBLE = `((c.tipo = 'Informal' AND u.estado_verificacion = 'Verificada') OR (c.tipo = 'Formal' AND u.estado_verificacion <> 'Rechazada'))`;
// CAT-05: solo ubicaciones verificadas, formales o informales (criterio de aceptacion del entregable).
const SOLO_VERIFICADAS = `u.estado_verificacion = 'Verificada'`;

const cercanosSchema = paginacionSchema.extend({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radioKm: z.coerce.number().positive().max(50).default(3),
  tipo: z.enum(['formal', 'informal']).optional(),
});

// CAT-05
comercios.get('/cercanos', async (req, res) => {
  const f = parse(cercanosSchema, req.query);
  const { limit, offset } = paginar(f);
  const params: unknown[] = [f.lat, f.lng, f.radioKm * 1000];
  let filtroTipo = '';
  if (f.tipo) {
    params.push(f.tipo === 'formal' ? 'Formal' : 'Informal');
    filtroTipo = `AND c.tipo = $${params.length}`;
  }
  params.push(limit, offset);
  const rows = await query(
    `WITH q AS (SELECT ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography AS pt)
     SELECT c.id AS "comercioId", c.nombre, c.tipo, c.subtipo, u.id AS "ubicacionId", u.direccion, u.estado_verificacion AS "estadoVerificacion",
            ST_Y(u.ubicacion::geometry) AS lat, ST_X(u.ubicacion::geometry) AS lng,
            round((ST_Distance(u.ubicacion, q.pt) / 1000.0)::numeric, 2) AS "distanciaKm", count(*) OVER() AS total
     FROM ubicaciones_comercio u JOIN comercios c ON c.id = u.comercio_id CROSS JOIN q
     WHERE ST_DWithin(u.ubicacion, q.pt, $3::float8) AND ${SOLO_VERIFICADAS} ${filtroTipo}
     ORDER BY ST_Distance(u.ubicacion, q.pt), u.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = rows[0] ? Number(rows[0].total) : 0;
  res.json(envoltura(rows.map(({ total: _t, tipo, distanciaKm, ...r }) => ({ ...r, tipo: String(tipo).toLowerCase(), distanciaKm: Number(distanciaKm) })), f, total));
});

// Caja que contiene a Mexico: descarta coordenadas basura (p. ej. 0,0 cuando el GPS del cliente no respondio)
// antes de gastar una llamada a Google o llenar la cola de moderacion.
const MEXICO = { latMin: 14, latMax: 33, lngMin: -119, lngMax: -86 };
const fueraDeMexico = 'La ubicacion debe estar dentro de Mexico';

const informalSchema = z.object({
  nombre: z.string().trim().min(2).max(150),
  tipo: z.enum(['tianguis', 'mercado_publico', 'puesto', 'otro']).default('puesto'),
  mercado: z.string().trim().max(150).optional(),
  lat: z.number().min(MEXICO.latMin, fueraDeMexico).max(MEXICO.latMax, fueraDeMexico),
  lng: z.number().min(MEXICO.lngMin, fueraDeMexico).max(MEXICO.lngMax, fueraDeMexico),
  referencia: z.string().trim().max(300).optional(),
});

const MAX_PENDIENTES = 10;
const SQL_PENDIENTES = `SELECT count(*)::int AS n FROM cola_moderacion WHERE tipo = 'comercio' AND estado = 'pendiente' AND reportado_por = $1`;
const sinCupo = () => new AppError(429, 'demasiadas_solicitudes', 'Tienes demasiados comercios pendientes de revision');

// CAT-07. La direccion la obtiene el servidor con geocodificacion inversa (EXT-01); la app no la envia.
// Si Google no responde, el comercio se guarda con coordenadas y direccion NULL: el alta nunca falla por Google.
comercios.post('/informales', requiereAuth, limiteEscrituraComunidad, async (req, res) => {
  const b = parse(informalSchema, req.body);
  const uid = req.usuario!.id;

  // Primero el tope de pendientes: no se paga una llamada a Google por una peticion que va a rechazarse.
  if ((await queryOne(SQL_PENDIENTES, [uid]))!.n >= MAX_PENDIENTES) throw sinCupo();

  // Fuera de la transaccion: no se retiene una conexion del pool mientras se espera a Google (hasta GEOCODING_TIMEOUT_MS).
  const direccion = await direccionInversa(b.lat, b.lng);

  const out = await transaccion(async (c) => {
    // Se repite dentro de la transaccion por si hubo altas simultaneas mientras se esperaba a Google.
    if ((await c.query(SQL_PENDIENTES, [uid])).rows[0].n >= MAX_PENDIENTES) throw sinCupo();
    const com = (await c.query(`INSERT INTO comercios (nombre, tipo, subtipo) VALUES ($1, 'Informal', $2) RETURNING id`, [b.nombre, b.tipo])).rows[0];
    const ub = (await c.query(
      `INSERT INTO ubicaciones_comercio (comercio_id, direccion, ubicacion, estado_verificacion, mercado, referencia, creado_por)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, 'Pendiente', $5, $6, $7) RETURNING id`,
      [com.id, direccion, b.lat, b.lng, b.mercado ?? null, b.referencia ?? null, uid],
    )).rows[0];
    await c.query(`INSERT INTO cola_moderacion (tipo, ubicacion_comercio_id, reportado_por) VALUES ('comercio', $1, $2)`, [ub.id, uid]);
    return { comercioId: com.id as number, ubicacionId: ub.id as number };
  });
  res.status(201).json({ ...out, direccion, estadoVerificacion: 'Pendiente', mensaje: 'El comercio sera visible para todos cuando un moderador lo apruebe' });
});

// CAT-06 (despues de las rutas fijas para que /cercanos e /informales no se interpreten como id)
comercios.get('/:comercioId', async (req, res) => {
  const id = idParam(req.params.comercioId, 'comercioId');
  const c = await queryOne(`SELECT id, nombre, tipo, subtipo FROM comercios WHERE id = $1`, [id]);
  if (!c) throw noEncontrado('Comercio');
  const ubic = await query(
    `SELECT u.id, u.direccion, u.mercado, u.referencia, u.estado_verificacion AS "estadoVerificacion", u.fecha_verificacion AS "fechaVerificacion",
            ST_Y(u.ubicacion::geometry) AS lat, ST_X(u.ubicacion::geometry) AS lng
     FROM ubicaciones_comercio u JOIN comercios c ON c.id = u.comercio_id WHERE u.comercio_id = $1 AND ${VISIBLE} ORDER BY u.id`,
    [id],
  );
  // Un comercio informal sin ninguna ubicacion verificada todavia no es publico.
  if (c.tipo === 'Informal' && ubic.length === 0) throw noEncontrado('Comercio');
  res.json({ ...c, tipo: c.tipo.toLowerCase(), ubicaciones: ubic });
});
