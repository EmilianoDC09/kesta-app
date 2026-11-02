import { query } from '../db';
import { enviarPush } from './push';
import { estaDesactualizado, preciosVigentesCercanos } from './precios';

export interface ResumenEvaluacion {
  alertasEvaluadas: number;
  notificacionesEnviadas: number;
}

/**
 * Compara los precios vigentes con las alertas activas y notifica las que se cumplen.
 * - Si no se pasan presentaciones, evalua todas las alertas activas.
 * - Se notifica una sola vez por precio: ultimo_precio_notificado evita repetir hasta que el precio
 *   baje mas o la alerta se "rearme" (el precio vuelve a quedar por encima del objetivo).
 * - Se ignoran precios desactualizados y reportes aun pendientes de verificar.
 */
export async function evaluarAlertas(presentacionIds?: number[]): Promise<ResumenEvaluacion> {
  const alertas = await query<{
    id: number; usuario_id: number; presentacion_id: number; precio_objetivo: number; radio_km: number;
    lat: number; lng: number; ultimo_precio_notificado: number | null; producto: string;
  }>(
    `SELECT a.id, a.usuario_id, a.presentacion_id, a.precio_objetivo, a.radio_km, a.ultimo_precio_notificado,
            ST_Y(a.centro::geometry) AS lat, ST_X(a.centro::geometry) AS lng, pr.nombre AS producto
     FROM alertas_precio a
     JOIN presentaciones pres ON pres.id = a.presentacion_id
     JOIN productos pr ON pr.id = pres.producto_id
     WHERE a.activa ${presentacionIds?.length ? 'AND a.presentacion_id = ANY($1::int[])' : ''}`,
    presentacionIds?.length ? [presentacionIds] : [],
  );

  let enviadas = 0;
  for (const a of alertas) {
    const precios = (await preciosVigentesCercanos({ presentacionIds: [a.presentacion_id], lat: a.lat, lng: a.lng, radioKm: a.radio_km }))
      .filter((p) => !estaDesactualizado(p.fuente, p.fecha_obtencion));
    const mejor = precios[0]; // ya vienen ordenados por precio
    if (!mejor || mejor.precio > a.precio_objetivo) {
      if (a.ultimo_precio_notificado !== null) await query('UPDATE alertas_precio SET ultimo_precio_notificado = NULL WHERE id = $1', [a.id]);
      continue;
    }
    if (a.ultimo_precio_notificado !== null && mejor.precio >= a.ultimo_precio_notificado) continue;

    const titulo = `Bajo el precio de ${a.producto}`;
    const cuerpo = `Ahora a $${mejor.precio.toFixed(2)} en ${mejor.comercio} (${(Math.round(mejor.distancia_km * 10) / 10).toFixed(1)} km)`;
    await query('INSERT INTO notificaciones (usuario_id, alerta_id, titulo, cuerpo) VALUES ($1, $2, $3, $4)', [a.usuario_id, a.id, titulo, cuerpo]);
    await query('UPDATE alertas_precio SET ultimo_precio_notificado = $2 WHERE id = $1', [a.id, mejor.precio]);

    const disp = await query<{ fcm_token: string }>('SELECT fcm_token FROM dispositivos WHERE usuario_id = $1', [a.usuario_id]);
    if (disp.length) {
      try {
        const r = await enviarPush(disp.map((d) => d.fcm_token), titulo, cuerpo, { alertaId: String(a.id), presentacionId: String(a.presentacion_id) });
        if (r.tokensInvalidos.length) await query('DELETE FROM dispositivos WHERE fcm_token = ANY($1::text[])', [r.tokensInvalidos]);
      } catch (e) {
        console.error('Fallo el envio push (la notificacion quedo registrada)', e);
      }
    }
    enviadas++;
  }
  return { alertasEvaluadas: alertas.length, notificacionesEnviadas: enviadas };
}

/** Se llama despues de publicar precios nuevos. Nunca debe romper la peticion que lo origino. */
export function evaluarAlertasEnSegundoPlano(presentacionIds: number[]) {
  evaluarAlertas(presentacionIds).catch((e) => console.error('Error evaluando alertas', e));
}
