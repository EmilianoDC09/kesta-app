import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { query, queryOne, transaccion } from '../db';
import { AppError, conflicto, parse } from '../errors';
import { firmarAcceso, requiereAuth } from '../middleware/auth';
import { limiteAuth } from '../middleware/limites';

export const auth = Router();

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

async function emitirTokens(usuarioId: number, rol: 'usuario' | 'moderador' | 'admin') {
  const refresh = crypto.randomBytes(48).toString('base64url');
  const expira = new Date(Date.now() + config.jwtRefreshDias * 86_400_000);
  await query('INSERT INTO refresh_tokens (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)', [usuarioId, sha256(refresh), expira.toISOString()]);
  return {
    accessToken: firmarAcceso({ id: usuarioId, rol }),
    refreshToken: refresh,
    expiraEnSegundos: config.jwtAccessMinutos * 60,
  };
}

const registroSchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  correo: z.string().trim().toLowerCase().email().max(255),
  contrasena: z.string().min(8, 'minimo 8 caracteres').max(128),
  ciudadId: z.number().int().positive().optional(),
});

// AUT-01
auth.post('/registro', limiteAuth, async (req, res) => {
  const b = parse(registroSchema, req.body);
  if (b.ciudadId) {
    const c = await queryOne('SELECT id FROM ciudades WHERE id = $1 AND activa', [b.ciudadId]);
    if (!c) throw new AppError(422, 'validacion', 'ciudadId no corresponde a una ciudad activa');
  }
  const hash = await bcrypt.hash(b.contrasena, 10);
  const u = await queryOne<{ id: number; nombre: string; email: string; rol: 'usuario' }>(
    `INSERT INTO usuarios (nombre, email, password_hash, rol, ciudad_id) VALUES ($1, $2, $3, 'usuario', $4)
     ON CONFLICT (email) DO NOTHING RETURNING id, nombre, email, rol`,
    [b.nombre, b.correo, hash, b.ciudadId ?? null],
  );
  if (!u) throw conflicto('Ya existe una cuenta con ese correo');
  const tokens = await emitirTokens(u.id, u.rol);
  res.status(201).json({ usuario: { id: u.id, nombre: u.nombre, correo: u.email, rol: u.rol, ciudadId: b.ciudadId ?? null }, ...tokens });
});

const loginSchema = z.object({ correo: z.string().trim().toLowerCase().email(), contrasena: z.string().min(1) });

// AUT-02
auth.post('/login', limiteAuth, async (req, res) => {
  const b = parse(loginSchema, req.body);
  const u = await queryOne<{ id: number; nombre: string; email: string; password_hash: string; rol: 'usuario' | 'moderador' | 'admin'; estado: string; ciudad_id: number | null }>(
    'SELECT id, nombre, email, password_hash, rol, estado, ciudad_id FROM usuarios WHERE email = $1',
    [b.correo],
  );
  // Mismo mensaje para correo inexistente y contrasena incorrecta: no revelar cuentas existentes.
  const ok = u ? await bcrypt.compare(b.contrasena, u.password_hash) : await bcrypt.compare(b.contrasena, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid.');
  if (!u || !ok) throw new AppError(401, 'credenciales_invalidas', 'Correo o contrasena incorrectos');
  if (u.estado !== 'activo') throw new AppError(403, 'cuenta_suspendida', 'La cuenta esta suspendida');
  const tokens = await emitirTokens(u.id, u.rol);
  res.json({ usuario: { id: u.id, nombre: u.nombre, correo: u.email, rol: u.rol, ciudadId: u.ciudad_id }, ...tokens });
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });

// AUT-03: rota el refresh token. Reusar uno ya revocado se trata como robo y revoca todas las sesiones del usuario.
auth.post('/renovar', limiteAuth, async (req, res) => {
  const { refreshToken } = parse(refreshSchema, req.body);
  const hash = sha256(refreshToken);
  const previo = await queryOne<{ usuario_id: number; revocado: boolean }>('SELECT usuario_id, revocado FROM refresh_tokens WHERE token_hash = $1', [hash]);
  if (!previo) throw new AppError(401, 'token_invalido', 'Token de renovacion invalido');
  if (previo.revocado) {
    await query('UPDATE refresh_tokens SET revocado = TRUE WHERE usuario_id = $1', [previo.usuario_id]);
    throw new AppError(401, 'token_reutilizado', 'Sesion invalidada por seguridad; inicia sesion de nuevo');
  }
  const u = await transaccion(async (c) => {
    // El UPDATE condicional es atomico: dos renovaciones simultaneas con el mismo token no pueden ganar las dos.
    const r = (await c.query(
      'UPDATE refresh_tokens SET revocado = TRUE WHERE token_hash = $1 AND NOT revocado AND expira_en > $2 RETURNING usuario_id',
      [hash, new Date().toISOString()],
    )).rows[0];
    if (!r) throw new AppError(401, 'token_expirado', 'El token de renovacion expiro o ya fue usado');
    const usr = (await c.query('SELECT id, rol, estado FROM usuarios WHERE id = $1', [r.usuario_id])).rows[0];
    if (!usr || usr.estado !== 'activo') throw new AppError(403, 'cuenta_suspendida', 'La cuenta esta suspendida');
    return usr as { id: number; rol: 'usuario' | 'moderador' | 'admin' };
  });
  res.json(await emitirTokens(u.id, u.rol));
});

const logoutSchema = z.object({ refreshToken: z.string().min(10), dispositivoId: z.number().int().positive().optional() });

// AUT-04
auth.post('/logout', requiereAuth, async (req, res) => {
  const b = parse(logoutSchema, req.body);
  await query('UPDATE refresh_tokens SET revocado = TRUE WHERE token_hash = $1 AND usuario_id = $2', [sha256(b.refreshToken), req.usuario!.id]);
  if (b.dispositivoId) await query('DELETE FROM dispositivos WHERE id = $1 AND usuario_id = $2', [b.dispositivoId, req.usuario!.id]);
  res.status(204).end();
});

// AUT-05 (montado tambien en /usuarios/perfil)
export const perfil = Router();
perfil.get('/perfil', requiereAuth, async (req, res) => {
  const u = await queryOne(
    `SELECT u.id, u.nombre, u.email AS correo, u.rol, u.ciudad_id AS "ciudadId", c.nombre AS ciudad, u.radio_busqueda_km AS "radioBusquedaKm",
            u.fecha_registro AS "fechaRegistro"
     FROM usuarios u LEFT JOIN ciudades c ON c.id = u.ciudad_id WHERE u.id = $1`,
    [req.usuario!.id],
  );
  if (!u) throw new AppError(401, 'no_autenticado', 'El usuario ya no existe');
  res.json(u);
});

