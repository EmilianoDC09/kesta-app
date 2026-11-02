import { ZodError, ZodTypeAny, z } from 'zod';

export class AppError extends Error {
  constructor(public status: number, public codigo: string, mensaje: string, public detalles?: unknown) {
    super(mensaje);
  }
}

export const noEncontrado = (what = 'Recurso') => new AppError(404, 'no_encontrado', `${what} no encontrado`);
export const prohibido = (msg = 'No tienes permiso para esta accion') => new AppError(403, 'prohibido', msg);
export const conflicto = (msg: string) => new AppError(409, 'conflicto', msg);

/** Valida y convierte datos de entrada con zod; lanza 422 si no cumplen. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new AppError(422, 'validacion', 'Datos de entrada invalidos', formatearZod(r.error));
  }
  return r.data;
}

function formatearZod(e: ZodError) {
  return e.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
}

export function idParam(v: unknown, nombre = 'id'): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(400, 'parametro_invalido', `${nombre} debe ser un entero positivo`);
  return n;
}
