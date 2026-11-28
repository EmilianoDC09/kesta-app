import { describe, expect, it, vi } from 'vitest';
import { buscar } from '../../src/etl/qqp-api/cliente';
import { evaluarExtraccion, extraer } from '../../src/etl/qqp-api/extraccion';
import { claveObservacion, validarObservacion } from '../../src/etl/qqp-api/observacion';
import { terminosBusqueda } from '../../src/etl/qqp-api/terminos';
import { productosCanasta } from '../../src/etl/canasta';
import { normalizarTexto } from '../../src/etl/transformar';

const obs = {
  producto: 'LECHE ULTRAPASTEURIZADA, LALA. ENTERA, CAJA 1 LT.',
  tipo_producto: 'LECHE ULTRAPASTEURIZADA',
  precio: 30,
  fecha_observacion: '2026-11-23',
  cadena_comercial: 'CHEDRAUI',
  establecimiento: 'CHEDRAUI SUCURSAL ALTOZANO MORELIA',
  direccion: 'AV. MONTAÑA MONARCA 1000, ENTRE AV. PASEO ALTOZANO Y AV',
  colonia: 'ALTOZANO',
  cp: '58350',
  municipio: 'Morelia',
  entidad: 'Michoacán',
};

const respuesta = (status: number, cuerpo: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', ...headers } });
const ok = (productos: unknown[]) => respuesta(200, { success: true, message: 'Precios obtenidos', data: { productos } });
const sinEspera = vi.fn(async () => undefined);

describe('cliente QQP', () => {
  it('consulta Morelia con el termino y se identifica, sin credenciales', async () => {
    const f = vi.fn(async () => ok([obs]));
    const r = await buscar('leche', { fetch: f as unknown as typeof fetch, esperar: sinEspera });
    expect(r.observaciones).toHaveLength(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://qqp.profeco.gob.mx/api/precios?clave_ciudad=1601&busqueda=leche');
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/^KestaETL\//);
    expect(headers.Authorization).toBeUndefined();
  });

  it('reintenta ante 429 respetando Retry-After', async () => {
    const esperar = vi.fn(async () => undefined);
    const f = vi.fn().mockResolvedValueOnce(respuesta(429, {}, { 'retry-after': '7' })).mockResolvedValueOnce(ok([obs]));
    const r = await buscar('leche', { fetch: f as unknown as typeof fetch, esperar });
    expect(r.observaciones).toHaveLength(1);
    expect(esperar).toHaveBeenCalledWith(7000);
  });

  it('se rinde despues del maximo de intentos', async () => {
    const f = vi.fn(async () => respuesta(503, {}));
    await expect(buscar('leche', { fetch: f as unknown as typeof fetch, esperar: sinEspera, maxIntentos: 3 })).rejects.toThrow('HTTP 503');
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('no reintenta si la forma de la respuesta cambio', async () => {
    const f = vi.fn(async () => respuesta(200, { success: false, message: 'error' }));
    await expect(buscar('leche', { fetch: f as unknown as typeof fetch, esperar: sinEspera })).rejects.toThrow(/forma inesperada/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('separa los elementos que no cumplen el esquema', async () => {
    const f = vi.fn(async () => ok([obs, { producto: 'X' }]));
    const r = await buscar('leche', { fetch: f as unknown as typeof fetch, esperar: sinEspera });
    expect(r.observaciones).toHaveLength(1);
    expect(r.invalidas).toHaveLength(1);
  });
});

describe('extraccion', () => {
  it('una busqueda fallida no detiene las demas', async () => {
    const f = vi.fn().mockResolvedValueOnce(ok([obs])).mockResolvedValueOnce(respuesta(404, {})).mockResolvedValueOnce(ok([obs]));
    const e = await extraer(['a', 'b', 'c'], { fetch: f as unknown as typeof fetch, esperar: sinEspera, pausaMs: 0 });
    expect(e.terminos.map((t) => t.ok)).toEqual([true, false, true]);
    expect(e.observaciones).toHaveLength(2);
  });

  const base = { version: 1 as const, obtenidoEn: '', ciudad: '1601', observaciones: [obs], invalidas: [] };

  it('no carga si falla mas de la mitad de las busquedas', () => {
    const ev = evaluarExtraccion({
      ...base,
      terminos: [
        { termino: 'a', ok: false, observaciones: 0 },
        { termino: 'b', ok: false, observaciones: 0 },
        { termino: 'c', ok: true, observaciones: 1 },
      ],
    });
    expect(ev.cargar).toBe(false);
  });

  it('no carga si una busqueda centinela llega vacia', () => {
    const ev = evaluarExtraccion({ ...base, terminos: [{ termino: 'huevo', ok: true, observaciones: 0 }, { termino: 'arroz', ok: true, observaciones: 5 }] });
    expect(ev.cargar).toBe(false);
    expect(ev.problemas[0]).toMatch(/centinela "huevo"/);
  });

  it('carga parcial si fallan pocas', () => {
    const ev = evaluarExtraccion({
      ...base,
      terminos: [
        { termino: 'a', ok: true, observaciones: 3 },
        { termino: 'b', ok: true, observaciones: 3 },
        { termino: 'c', ok: false, observaciones: 0 },
      ],
    });
    expect(ev).toMatchObject({ cargar: true, parcial: true });
  });
});

describe('terminos de busqueda', () => {
  it('cubren todos los productos de la canasta', () => {
    const terminos = terminosBusqueda();
    for (const c of productosCanasta) {
      expect(terminos.some((t) => normalizarTexto(c).startsWith(t)), c).toBe(true);
    }
  });

  it('incluyen las busquedas de carne por corte', () => {
    const terminos = terminosBusqueda();
    for (const t of ['bistec', 'chuleta', 'pechuga', 'carne molida']) expect(terminos).toContain(t);
  });

  it('quitan los terminos cubiertos por un prefijo', () => {
    expect(terminosBusqueda(['Leche', 'Leche en Polvo', 'Atún'], [])).toEqual(['atun', 'leche']);
  });
});

describe('observaciones', () => {
  it('la huella depende solo de los datos crudos', () => {
    expect(claveObservacion(obs)).toBe(claveObservacion({ ...obs }));
    expect(claveObservacion(obs)).not.toBe(claveObservacion({ ...obs, precio: 31 }));
    expect(claveObservacion(obs)).not.toBe(claveObservacion({ ...obs, fecha_observacion: '2026-11-20' }));
  });

  it('valida ciudad, precio y fecha', () => {
    expect(validarObservacion(obs)).toEqual({ valida: true, fecha: '2026-11-23' });
    expect(validarObservacion({ ...obs, municipio: 'Uruapan' })).toMatchObject({ valida: false, motivo: 'Fuera de ciudad piloto' });
    expect(validarObservacion({ ...obs, precio: 0 })).toMatchObject({ valida: false, motivo: 'Precio invalido' });
    expect(validarObservacion({ ...obs, fecha_observacion: '23/11/2026' })).toMatchObject({ valida: false });
    expect(validarObservacion({ ...obs, fecha_observacion: '2099-01-01' })).toMatchObject({ valida: false, motivo: 'Fecha futura' });
  });
});
