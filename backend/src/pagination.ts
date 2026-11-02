import { z } from 'zod';

export const paginacionSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export function paginar(p: { pagina: number; limite: number }) {
  return { limit: p.limite, offset: (p.pagina - 1) * p.limite };
}

export function envoltura<T>(datos: T[], p: { pagina: number; limite: number }, total: number) {
  return { datos, pagina: p.pagina, limite: p.limite, total };
}
