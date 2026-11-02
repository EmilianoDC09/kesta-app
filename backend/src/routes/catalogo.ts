import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { idParam, noEncontrado, parse } from '../errors';
import { envoltura, paginacionSchema, paginar } from '../pagination';

export const catalogo = Router();

// CAT-01
catalogo.get('/ciudades', async (_req, res) => {
  const rows = await query(
    `SELECT id, nombre, estado, ST_Y(centro::geometry) AS lat, ST_X(centro::geometry) AS lng FROM ciudades WHERE activa ORDER BY nombre`,
  );
  res.json({ datos: rows.map((r) => ({ id: r.id, nombre: r.nombre, estado: r.estado, centro: { lat: r.lat, lng: r.lng } })) });
});

// CAT-02
catalogo.get('/categorias', async (_req, res) => {
  res.json({ datos: await query('SELECT id, nombre FROM categorias ORDER BY nombre') });
});

catalogo.get('/marcas', async (_req, res) => {
  res.json({ datos: await query('SELECT id, nombre FROM marcas ORDER BY nombre') });
});

const PRESENTACIONES_JSON = `
  COALESCE((SELECT json_agg(json_build_object(
      'id', pres.id, 'marca', json_build_object('id', m.id, 'nombre', m.nombre),
      'cantidad', pres.cantidad, 'unidad', u.abreviatura) ORDER BY m.nombre, pres.cantidad)
    FROM presentaciones pres
    JOIN marcas m ON m.id = pres.marca_id
    JOIN unidades u ON u.id = pres.unidad_id
    WHERE pres.producto_id = p.id), '[]'::json)`;

const buscarSchema = paginacionSchema.extend({
  q: z.string().trim().max(100).optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  marcaId: z.coerce.number().int().positive().optional(),
});

// CAT-03
catalogo.get('/productos', async (req, res) => {
  const f = parse(buscarSchema, req.query);
  const { limit, offset } = paginar(f);
  const params: unknown[] = [];
  const where: string[] = [];
  if (f.q) {
    params.push(`%${f.q.replace(/[%_\\]/g, '\\$&')}%`);
    where.push(`unaccent(p.nombre) ILIKE unaccent($${params.length})`);
  }
  if (f.categoriaId) {
    params.push(f.categoriaId);
    where.push(`p.categoria_id = $${params.length}`);
  }
  if (f.marcaId) {
    params.push(f.marcaId);
    where.push(`EXISTS (SELECT 1 FROM presentaciones x WHERE x.producto_id = p.id AND x.marca_id = $${params.length})`);
  }
  params.push(limit, offset);
  const rows = await query(
    `SELECT p.id, p.nombre, json_build_object('id', c.id, 'nombre', c.nombre) AS categoria,
            ${PRESENTACIONES_JSON} AS presentaciones, count(*) OVER() AS total
     FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY p.nombre LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = rows[0] ? Number(rows[0].total) : 0;
  res.json(envoltura(rows.map(({ total: _t, ...r }) => r), f, total));
});

// CAT-04
catalogo.get('/productos/:productoId', async (req, res) => {
  const id = idParam(req.params.productoId, 'productoId');
  const p = await queryOne(
    `SELECT p.id, p.nombre, json_build_object('id', c.id, 'nombre', c.nombre) AS categoria, ${PRESENTACIONES_JSON} AS presentaciones
     FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id WHERE p.id = $1`,
    [id],
  );
  if (!p) throw noEncontrado('Producto');
  res.json(p);
});
