import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const mensaje = { error: { codigo: 'demasiadas_solicitudes', mensaje: 'Demasiadas solicitudes, intenta mas tarde' } };

export const limiteGeneral = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false, message: mensaje });

export const limiteAuth = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: mensaje });

/** Limite por usuario (no por IP) para escrituras de la comunidad: reportes, verificaciones, altas de comercios. */
export const limiteEscrituraComunidad = rateLimit({
  windowMs: 60 * 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensaje,
  keyGenerator: (req: Request) => `u${req.usuario?.id ?? 'anon'}`,
  validate: false,
});
