import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../errors';

export interface UsuarioToken {
  id: number;
  rol: 'usuario' | 'moderador' | 'admin';
}

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: UsuarioToken;
  }
}

export function firmarAcceso(u: UsuarioToken): string {
  return jwt.sign({ rol: u.rol }, config.jwtSecret, {
    subject: String(u.id),
    expiresIn: `${config.jwtAccessMinutos}m`,
  });
}

export function requiereAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) throw new AppError(401, 'no_autenticado', 'Falta el token de acceso');
  try {
    const p = jwt.verify(h.slice(7), config.jwtSecret) as jwt.JwtPayload;
    req.usuario = { id: Number(p.sub), rol: p.rol };
    next();
  } catch {
    throw new AppError(401, 'token_invalido', 'Token invalido o expirado');
  }
}

/** moderador y admin pasan los filtros de 'moderador'; solo admin pasa 'admin'. */
export function requiereRol(...roles: UsuarioToken['rol'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      throw new AppError(403, 'prohibido', 'No tienes permiso para esta accion');
    }
    next();
  };
}
