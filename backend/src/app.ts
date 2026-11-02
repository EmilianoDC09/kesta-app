import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { pool } from './db';
import { AppError } from './errors';
import { limiteGeneral } from './middleware/limites';
import { adminAlertas, alertas, dispositivos, notificaciones } from './routes/alertas';
import { auth, perfil } from './routes/auth';
import { canastas } from './routes/canastas';
import { catalogo } from './routes/catalogo';
import { comercios } from './routes/comercios';
import { reportes, reportesError } from './routes/comunidad';
import { moderacion } from './routes/moderacion';
import { precios } from './routes/precios';

export function crearApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ estado: 'ok' });
    } catch {
      res.status(503).json({ estado: 'sin_base_de_datos' });
    }
  });

  const v1 = express.Router();
  v1.use(limiteGeneral);
  v1.use('/auth', auth);
  v1.use('/usuarios', perfil);
  v1.use('/', catalogo); // /ciudades, /categorias, /marcas, /productos
  v1.use('/comercios', comercios);
  v1.use('/precios', precios);
  v1.use('/precios', reportesError);
  v1.use('/canastas', canastas);
  v1.use('/reportes-precio', reportes);
  v1.use('/dispositivos', dispositivos);
  v1.use('/alertas', alertas);
  v1.use('/notificaciones', notificaciones);
  v1.use('/admin/moderacion', moderacion);
  v1.use('/admin/alertas', adminAlertas);
  app.use('/api/v1', v1);

  app.use((_req, res) => {
    res.status(404).json({ error: { codigo: 'ruta_no_encontrada', mensaje: 'Ruta no encontrada' } });
  });

  // Manejo central de errores
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: { codigo: err.codigo, mensaje: err.message, ...(err.detalles ? { detalles: err.detalles } : {}) } });
      return;
    }
    if (err instanceof ZodError) {
      res.status(422).json({ error: { codigo: 'validacion', mensaje: 'Datos de entrada invalidos' } });
      return;
    }
    const e = err as { type?: string; status?: number };
    if (e?.type === 'entity.parse.failed') {
      res.status(400).json({ error: { codigo: 'json_invalido', mensaje: 'El cuerpo no es un JSON valido' } });
      return;
    }
    if (e?.type === 'entity.too.large') {
      res.status(413).json({ error: { codigo: 'cuerpo_muy_grande', mensaje: 'El cuerpo de la peticion es demasiado grande' } });
      return;
    }
    console.error(err);
    res.status(500).json({ error: { codigo: 'error_interno', mensaje: 'Error interno del servidor' } });
  });

  return app;
}
