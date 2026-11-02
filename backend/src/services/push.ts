import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * Envio por FCM HTTP v1. Si FCM_SERVICE_ACCOUNT no esta configurado, solo se registra en consola
 * (la notificacion igual queda guardada en la tabla notificaciones). NO esta probado contra Firebase real.
 */
interface CuentaServicio {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cuenta: CuentaServicio | null | undefined;
let tokenCache: { valor: string; expira: number } | null = null;

function cargarCuenta(): CuentaServicio | null {
  if (cuenta !== undefined) return cuenta;
  const raw = config.fcmServiceAccount.trim();
  if (!raw) return (cuenta = null);
  try {
    cuenta = JSON.parse(raw.startsWith('{') ? raw : fs.readFileSync(raw, 'utf8'));
  } catch (e) {
    console.error('FCM_SERVICE_ACCOUNT invalido; las notificaciones push quedan deshabilitadas', e);
    cuenta = null;
  }
  return cuenta ?? null;
}

async function tokenOAuth(c: CuentaServicio): Promise<string> {
  if (tokenCache && tokenCache.expira > Date.now() + 60_000) return tokenCache.valor;
  const ahora = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 },
    c.private_key,
    { algorithm: 'RS256' },
  );
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!r.ok) throw new Error(`OAuth FCM fallo: ${r.status}`);
  const j: any = await r.json();
  tokenCache = { valor: j.access_token, expira: Date.now() + j.expires_in * 1000 };
  return tokenCache.valor;
}

export interface ResultadoPush {
  enviados: number;
  tokensInvalidos: string[];
}

export async function enviarPush(tokens: string[], titulo: string, cuerpo: string, data: Record<string, string> = {}): Promise<ResultadoPush> {
  const c = cargarCuenta();
  if (!c) {
    if (!config.esProduccion) console.log(`[push deshabilitado] ${tokens.length} dispositivo(s): ${titulo} - ${cuerpo}`);
    return { enviados: 0, tokensInvalidos: [] };
  }
  const bearer = await tokenOAuth(c);
  const out: ResultadoPush = { enviados: 0, tokensInvalidos: [] };
  for (const token of tokens) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token, notification: { title: titulo, body: cuerpo }, data } }),
    });
    if (r.ok) out.enviados++;
    else if (r.status === 404 || r.status === 400) out.tokensInvalidos.push(token);
    else console.error(`FCM respondio ${r.status}`);
  }
  return out;
}

