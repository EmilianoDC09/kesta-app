import { config } from '../config';

/**
 * EXT-01: geocodificacion inversa con Google Maps Platform (Geocoding API).
 *
 * Contrato: NUNCA lanza. Devuelve la direccion legible o null si no se pudo obtener (sin clave configurada,
 * timeout, red caida, HTTP != 200, status != OK de Google, sin resultados). Quien llama decide que hacer con null.
 * La clave viaja solo en la peticion servidor -> Google; no se registra en logs (solo status y tipo de error).
 */
const URL_GEOCODING = 'https://maps.googleapis.com/maps/api/geocode/json';
const MAX_DIRECCION = 300;

interface RespuestaGeocoding {
  status: string;
  results?: { formatted_address?: string; types?: string[] }[];
}

let avisoSinClave = false;

export async function direccionInversa(lat: number, lng: number): Promise<string | null> {
  const { apiKey, timeoutMs } = config.googleMaps;
  if (!apiKey) {
    if (!avisoSinClave) {
      avisoSinClave = true;
      console.warn('[geocodificacion] GOOGLE_MAPS_API_KEY no esta configurada: los comercios nuevos se guardan sin direccion');
    }
    return null;
  }
  try {
    const params = new URLSearchParams({ latlng: `${lat},${lng}`, language: 'es', key: apiKey });
    const r = await fetch(`${URL_GEOCODING}?${params}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) {
      console.warn(`[geocodificacion] Google respondio HTTP ${r.status}`);
      return null;
    }
    const j = (await r.json()) as RespuestaGeocoding;
    // Google responde 200 aun en error: el resultado real viene en `status`.
    if (j.status === 'ZERO_RESULTS') return null;
    if (j.status !== 'OK') {
      console.warn(`[geocodificacion] Google devolvio status ${j.status}`); // REQUEST_DENIED, OVER_QUERY_LIMIT, etc.
      return null;
    }
    // Se descartan los "plus codes" (p. ej. "GGJ5+2P Morelia"): no son una direccion legible.
    const hit = j.results?.find((x) => x.formatted_address && !x.types?.includes('plus_code'));
    return hit?.formatted_address?.trim().slice(0, MAX_DIRECCION) || null;
  } catch (e) {
    console.warn(`[geocodificacion] fallo la llamada a Google: ${(e as Error).name}`);
    return null;
  }
}

/**
 * Geocodificacion directa (direccion -> coordenadas) para sucursales que llegan de Profeco sin punto.
 * Mismo contrato que direccionInversa: NUNCA lanza; devuelve null si no hay un resultado confiable.
 *
 * Se rechazan los resultados APPROXIMATE (p. ej. solo la ciudad o la colonia) y los que caen fuera del radio dado
 * alrededor del centro de la ciudad: un punto equivocado es peor que no tener punto, porque la sucursal apareceria
 * en busquedas cercanas donde no esta.
 */
interface RespuestaGeocodingDirecta {
  status: string;
  results?: { geometry?: { location?: { lat: number; lng: number }; location_type?: string } }[];
}

export interface OpcionesGeocodificacion {
  ciudad: string;
  estado: string;
  centro: { lat: number; lng: number };
  radioKm: number;
}

function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export async function coordenadasDeDireccion(
  direccion: string,
  o: OpcionesGeocodificacion
): Promise<{ lat: number; lng: number } | null> {
  const { apiKey, timeoutMs } = config.googleMaps;
  if (!apiKey || !direccion.trim()) return null;
  try {
    const params = new URLSearchParams({
      address: `${direccion}, ${o.ciudad}, ${o.estado}, México`,
      components: 'country:MX',
      language: 'es',
      key: apiKey,
    });
    const r = await fetch(`${URL_GEOCODING}?${params}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) {
      console.warn(`[geocodificacion] Google respondio HTTP ${r.status}`);
      return null;
    }
    const j = (await r.json()) as RespuestaGeocodingDirecta;
    if (j.status === 'ZERO_RESULTS') return null;
    if (j.status !== 'OK') {
      console.warn(`[geocodificacion] Google devolvio status ${j.status}`);
      return null;
    }
    const g = j.results?.[0]?.geometry;
    if (!g?.location || g.location_type === 'APPROXIMATE') return null;
    if (distanciaKm(o.centro, g.location) > o.radioKm) return null;
    return { lat: g.location.lat, lng: g.location.lng };
  } catch (e) {
    console.warn(`[geocodificacion] fallo la llamada a Google: ${(e as Error).name}`);
    return null;
  }
}
