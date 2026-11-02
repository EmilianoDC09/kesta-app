import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { AppError, noEncontrado, parse } from '../errors';
import { mediana, preciosVigentesCercanos, presentarPrecio, redondear } from '../services/precios';

export const precios = Router();

const geoSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radioKm: z.coerce.number().positive().max(50).default(5),
});

async function exigirPresentacion(id: number) {
  const p = await queryOne(
    `SELECT pres.id, pr.nombre AS producto, m.nombre AS marca, pres.cantidad, u.abreviatura AS unidad
     FROM presentaciones pres JOIN productos pr ON pr.id = pres.producto_id
     JOIN marcas m ON m.id = pres.marca_id JOIN unidades u ON u.id = pres.unidad_id WHERE pres.id = $1`,
    [id],
  );
  if (!p) throw noEncontrado('Presentacion');
  return p;
}

const booleano = z.enum(['true', 'false']).transform((v) => v === 'true');

// PRE-01
const preciosSchema = geoSchema.extend({
  presentacionId: z.coerce.number().int().positive(),
  fuente: z.enum(['todas', 'profeco', 'scraping', 'comunidad']).default('todas'),
  soloVerificados: booleano.default('true'),
});

precios.get('/', async (req, res) => {
  const f = parse(preciosSchema, req.query);
  const presentacion = await exigirPresentacion(f.presentacionId);
  const filas = await preciosVigentesCercanos({ presentacionIds: [f.presentacionId], lat: f.lat, lng: f.lng, radioKm: f.radioKm, fuente: f.fuente, soloVerificados: f.soloVerificados });
  res.json({ presentacion, datos: filas.map(presentarPrecio), total: filas.length });
});

// PRE-02: resumen por canal. Se usan medianas porque un solo precio atipico distorsiona el promedio.
const comparacionSchema = geoSchema.extend({ presentacionId: z.coerce.number().int().positive() });

precios.get('/comparacion', async (req, res) => {
  const f = parse(comparacionSchema, req.query);
  const presentacion = await exigirPresentacion(f.presentacionId);
  const filas = await preciosVigentesCercanos({ presentacionIds: [f.presentacionId], lat: f.lat, lng: f.lng, radioKm: f.radioKm });

  const resumen = (canal: 'Formal' | 'Informal') => {
    const v = filas.filter((x) => x.canal === canal);
    if (v.length === 0) return null;
    const ps = v.map((x) => x.precio);
    const barato = v[0]; // la consulta ya ordena por precio ascendente
    return {
      minimo: Math.min(...ps),
      mediana: redondear(mediana(ps)),
      maximo: Math.max(...ps),
      muestras: v.length,
      desactualizados: v.filter((x) => presentarPrecio(x).desactualizado).length,
      masBarato: presentarPrecio(barato),
    };
  };
  const formal = resumen('Formal');
  const informal = resumen('Informal');

  let ahorro: null | { canalMasBarato: string; diferencia: number; porcentaje: number; base: string } = null;
  if (formal && informal) {
    const [barato, caro] = formal.mediana <= informal.mediana ? [['formal', formal], ['informal', informal]] as const : [['informal', informal], ['formal', formal]] as const;
    const dif = redondear(caro[1].mediana - barato[1].mediana);
    ahorro = { canalMasBarato: barato[0], diferencia: dif, porcentaje: redondear((dif / caro[1].mediana) * 100), base: 'mediana' };
  }
  res.json({
    presentacion,
    radioKm: f.radioKm,
    formal,
    informal,
    ahorroPotencial: ahorro,
    advertencia: !formal || !informal ? 'Falta informacion de uno de los canales en esta zona; la comparacion no es concluyente' : null,
  });
});

// PRE-03
const historialSchema = z.object({
  presentacionId: z.coerce.number().int().positive(),
  ubicacionId: z.coerce.number().int().positive().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  granularidad: z.enum(['dia', 'semana', 'mes']).default('semana'),
});

precios.get('/historial', async (req, res) => {
  const f = parse(historialSchema, req.query);
  await exigirPresentacion(f.presentacionId);
  const hasta = f.hasta ?? new Date();
  const desde = f.desde ?? new Date(hasta.getTime() - 90 * 86_400_000);
  if (desde >= hasta) throw new AppError(422, 'validacion', 'desde debe ser anterior a hasta');
  if (hasta.getTime() - desde.getTime() > 365 * 86_400_000) throw new AppError(422, 'validacion', 'El rango maximo es de 365 dias');
  const trunc = { dia: 'day', semana: 'week', mes: 'month' }[f.granularidad];

  const params: unknown[] = [f.presentacionId, desde.toISOString(), hasta.toISOString(), trunc];
  let filtroUbic = '';
  if (f.ubicacionId) {
    params.push(f.ubicacionId);
    filtroUbic = `AND (p.ubicacion_id = $5 OR (p.ubicacion_id IS NULL AND p.comercio_id = (SELECT comercio_id FROM ubicaciones_comercio WHERE id = $5)))`;
  }
  const filas = await query(
    `SELECT date_trunc($4, p.fecha_obtencion) AS periodo, round(avg(p.precio), 2) AS promedio, min(p.precio) AS minimo, max(p.precio) AS maximo, count(*)::int AS muestras
     FROM precios p
     WHERE p.presentacion_id = $1 AND p.estado_verificacion = 'Activo' AND p.fecha_obtencion >= $2 AND p.fecha_obtencion <= $3 ${filtroUbic}
     GROUP BY 1 ORDER BY 1`,
    params,
  );
  res.json({
    presentacionId: f.presentacionId,
    granularidad: f.granularidad,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    serie: filas.map((r) => ({ periodo: (r.periodo as Date).toISOString(), promedio: Number(r.promedio), minimo: r.minimo, maximo: r.maximo, muestras: r.muestras })),
  });
});

// PRE-04: precios por debajo de la mediana del area
const ofertasSchema = geoSchema.extend({
  categoriaId: z.coerce.number().int().positive().optional(),
  descuentoMinimoPct: z.coerce.number().min(1).max(90).default(10),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

precios.get('/ofertas', async (req, res) => {
  const f = parse(ofertasSchema, req.query);
  const params: unknown[] = [];
  let filtro = '';
  if (f.categoriaId) {
    params.push(f.categoriaId);
    filtro = `WHERE pr.categoria_id = $1`;
  }
  const ids = (await query<{ id: number }>(`SELECT pres.id FROM presentaciones pres JOIN productos pr ON pr.id = pres.producto_id ${filtro}`, params)).map((r) => r.id);
  const filas = await preciosVigentesCercanos({ presentacionIds: ids, lat: f.lat, lng: f.lng, radioKm: f.radioKm });

  const porPres = new Map<number, typeof filas>();
  for (const x of filas) porPres.set(x.presentacion_id, [...(porPres.get(x.presentacion_id) ?? []), x]);

  const ofertas: Array<{ item: typeof filas[number]; med: number; desc: number }> = [];
  for (const lista of porPres.values()) {
    if (lista.length < 2) continue; // sin al menos dos precios no hay con que comparar
    const med = mediana(lista.map((x) => x.precio));
    for (const item of lista) {
      const desc = ((med - item.precio) / med) * 100;
      if (desc >= f.descuentoMinimoPct && !presentarPrecio(item).desactualizado) ofertas.push({ item, med, desc });
    }
  }
  ofertas.sort((a, b) => b.desc - a.desc);
  const top = ofertas.slice(0, f.limite);
  const info = top.length
    ? await query(
        `SELECT pres.id, pr.nombre AS producto, m.nombre AS marca, pres.cantidad, u.abreviatura AS unidad
         FROM presentaciones pres JOIN productos pr ON pr.id = pres.producto_id JOIN marcas m ON m.id = pres.marca_id JOIN unidades u ON u.id = pres.unidad_id
         WHERE pres.id = ANY($1::int[])`,
        [top.map((o) => o.item.presentacion_id)],
      )
    : [];
  const mapa = new Map(info.map((i) => [i.id, i]));
  res.json({
    datos: top.map((o) => ({ presentacion: mapa.get(o.item.presentacion_id), ...presentarPrecio(o.item), medianaZona: redondear(o.med), descuentoPct: redondear(o.desc) })),
    total: top.length,
  });
});
