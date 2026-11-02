import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../src/app';
import { config } from '../src/config';
import { pool } from '../src/db';
import { PASSWORD_SEED, sembrar } from '../src/scripts/seed';

const app = crearApp();
const api = '/api/v1';
const CENTRO = { lat: 19.7027, lng: -101.1925 };

async function login(correo: string) {
  const r = await request(app).post(`${api}/auth/login`).send({ correo, contrasena: PASSWORD_SEED });
  expect(r.status).toBe(200);
  return { token: r.body.accessToken as string, refresh: r.body.refreshToken as string, id: r.body.usuario.id as number };
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

let maria: Awaited<ReturnType<typeof login>>;
let carlos: Awaited<ReturnType<typeof login>>;
let ana: Awaited<ReturnType<typeof login>>;
let moderador: Awaited<ReturnType<typeof login>>;
let admin: Awaited<ReturnType<typeof login>>;

beforeAll(async () => {
  await sembrar();
  maria = await login('maria@kesta.test');
  carlos = await login('carlos@kesta.test');
  ana = await login('ana@kesta.test');
  moderador = await login('moderador@kesta.test');
  admin = await login('admin@kesta.test');
});
afterAll(async () => {
  await pool.end();
});

describe('sistema y catalogo', () => {
  it('health responde ok', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
  });

  it('lista ciudades piloto', async () => {
    const r = await request(app).get(`${api}/ciudades`);
    expect(r.body.datos[0]).toMatchObject({ nombre: 'Morelia' });
    expect(r.body.datos[0].centro.lat).toBeCloseTo(19.7027, 3);
  });

  it('busca productos sin importar acentos y devuelve presentaciones', async () => {
    const r = await request(app).get(`${api}/productos`).query({ q: 'jítomate' });
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(1);
    expect(r.body.datos[0].presentaciones[0]).toMatchObject({ cantidad: 1, unidad: 'kg' });
  });

  it('producto inexistente da 404 y id invalido 400', async () => {
    expect((await request(app).get(`${api}/productos/9999`)).status).toBe(404);
    expect((await request(app).get(`${api}/productos/abc`)).status).toBe(400);
  });
});

describe('auth', () => {
  it('registra, rechaza correo duplicado y valida contrasena', async () => {
    const ok = await request(app).post(`${api}/auth/registro`).send({ nombre: 'Nuevo Usuario', correo: 'NUEVO@kesta.test', contrasena: 'una-clave-larga', ciudadId: 1 });
    expect(ok.status).toBe(201);
    expect(ok.body.usuario.correo).toBe('nuevo@kesta.test');
    expect(ok.body.usuario.rol).toBe('usuario');
    const dup = await request(app).post(`${api}/auth/registro`).send({ nombre: 'Otro', correo: 'nuevo@kesta.test', contrasena: 'una-clave-larga' });
    expect(dup.status).toBe(409);
    const corta = await request(app).post(`${api}/auth/registro`).send({ nombre: 'Otro', correo: 'otro@kesta.test', contrasena: '123' });
    expect(corta.status).toBe(422);
  });

  it('login falla con credenciales malas y perfil exige token', async () => {
    const r = await request(app).post(`${api}/auth/login`).send({ correo: 'maria@kesta.test', contrasena: 'incorrecta' });
    expect(r.status).toBe(401);
    expect((await request(app).get(`${api}/usuarios/perfil`)).status).toBe(401);
    const p = await request(app).get(`${api}/usuarios/perfil`).set(bearer(maria.token));
    expect(p.body).toMatchObject({ nombre: 'Maria Lopez', rol: 'usuario', ciudad: 'Morelia' });
  });

  it('rota el refresh token y detecta reutilizacion', async () => {
    const l = await login('ana@kesta.test');
    const r1 = await request(app).post(`${api}/auth/renovar`).send({ refreshToken: l.refresh });
    expect(r1.status).toBe(200);
    const reuso = await request(app).post(`${api}/auth/renovar`).send({ refreshToken: l.refresh });
    expect(reuso.status).toBe(401);
    expect(reuso.body.error.codigo).toBe('token_reutilizado');
    // el token nuevo tambien quedo revocado por seguridad
    const r2 = await request(app).post(`${api}/auth/renovar`).send({ refreshToken: r1.body.refreshToken });
    expect(r2.status).toBe(401);
  });
});

describe('comercios y precios', () => {
  it('cercanos incluye verificados y oculta el comercio informal pendiente', async () => {
    const r = await request(app).get(`${api}/comercios/cercanos`).query({ ...CENTRO, radioKm: 5 });
    const nombres = r.body.datos.map((d: any) => d.nombre);
    expect(nombres).toContain('Chedraui');
    expect(nombres).toContain('Tianguis del Pedregal');
    expect(nombres).not.toContain('Tianguis Nuevo (sin verificar)');
    expect(r.body.datos[0].nombre).toBe('Chedraui'); // ordenado por distancia
    const soloInf = await request(app).get(`${api}/comercios/cercanos`).query({ ...CENTRO, radioKm: 5, tipo: 'informal' });
    expect(soloInf.body.datos.every((d: any) => d.tipo === 'informal')).toBe(true);
    expect((await request(app).get(`${api}/comercios/7`)).status).toBe(404);
  });

  it('precios vigentes por zona con fuente y desactualizacion', async () => {
    const r = await request(app).get(`${api}/precios`).query({ presentacionId: 4, ...CENTRO, radioKm: 10 });
    const aurrera = r.body.datos.find((d: any) => d.comercio.nombre === 'Bodega Aurrera');
    expect(aurrera.fuente).toBe('profeco');
    expect(aurrera.desactualizado).toBe(true);
    const tianguis = r.body.datos.find((d: any) => d.comercio.nombre === 'Tianguis del Pedregal');
    expect(tianguis.precio).toBe(52);
    expect(tianguis.desactualizado).toBe(false);
    const soloCom = await request(app).get(`${api}/precios`).query({ presentacionId: 4, ...CENTRO, radioKm: 10, fuente: 'comunidad' });
    expect(soloCom.body.datos.every((d: any) => d.fuente === 'comunidad')).toBe(true);
  });

  it('compara formal vs informal con medianas y ahorro', async () => {
    const r = await request(app).get(`${api}/precios/comparacion`).query({ presentacionId: 1, ...CENTRO, radioKm: 10 });
    expect(r.status).toBe(200);
    expect(r.body.formal).toMatchObject({ minimo: 43.9, maximo: 46.2, muestras: 3, mediana: 45.5 });
    expect(r.body.informal).toMatchObject({ minimo: 40, maximo: 41.5, muestras: 2, mediana: 40.75 });
    expect(r.body.ahorroPotencial).toMatchObject({ canalMasBarato: 'informal', diferencia: 4.75 });
  });

  it('historial agrega por periodo', async () => {
    const r = await request(app).get(`${api}/precios/historial`).query({ presentacionId: 3, granularidad: 'semana' });
    expect(r.status).toBe(200);
    expect(r.body.serie.length).toBeGreaterThanOrEqual(4);
    const bad = await request(app).get(`${api}/precios/historial`).query({ presentacionId: 3, desde: '2020-01-01', hasta: '2026-01-01' });
    expect(bad.status).toBe(422);
  });

  it('ofertas: solo precios bajo la mediana de la zona', async () => {
    const r = await request(app).get(`${api}/precios/ofertas`).query({ ...CENTRO, radioKm: 10, descuentoMinimoPct: 15 });
    expect(r.status).toBe(200);
    expect(r.body.datos.length).toBeGreaterThan(0);
    expect(r.body.datos.every((o: any) => o.descuentoPct >= 15)).toBe(true);
  });
});

describe('comunidad: reportes y verificacion', () => {
  let reporteId: number;

  it('un reporte nuevo queda pendiente y no se publica', async () => {
    const r = await request(app).post(`${api}/reportes-precio`).set(bearer(maria.token)).send({ presentacionId: 3, ubicacionId: 2, precio: 24.5 });
    expect(r.status).toBe(201);
    expect(r.body.estado).toBe('pendiente');
    reporteId = r.body.reporteId;
    const publicados = await request(app).get(`${api}/precios`).query({ presentacionId: 3, ...CENTRO, radioKm: 10, fuente: 'comunidad' });
    expect(publicados.body.datos).toHaveLength(0);
    const conPend = await request(app).get(`${api}/precios`).query({ presentacionId: 3, ...CENTRO, radioKm: 10, fuente: 'comunidad', soloVerificados: 'false' });
    expect(conPend.body.datos[0].estadoVerificacion).toBe('Pendiente');
  });

  it('rechaza el duplicado del mismo usuario en 24 h y ubicaciones no visibles', async () => {
    const dup = await request(app).post(`${api}/reportes-precio`).set(bearer(maria.token)).send({ presentacionId: 3, ubicacionId: 2, precio: 24.5 });
    expect(dup.status).toBe(409);
    const oculta = await request(app).post(`${api}/reportes-precio`).set(bearer(maria.token)).send({ presentacionId: 3, ubicacionId: 7, precio: 20 });
    expect(oculta.status).toBe(422);
    expect((await request(app).post(`${api}/reportes-precio`).send({ presentacionId: 3, ubicacionId: 2, precio: 20 })).status).toBe(401);
  });

  it('no puedes verificar tu propio reporte ni votar dos veces', async () => {
    const propio = await request(app).post(`${api}/reportes-precio/${reporteId}/verificaciones`).set(bearer(maria.token)).send({ voto: 'confirma' });
    expect(propio.status).toBe(403);
    const v1 = await request(app).post(`${api}/reportes-precio/${reporteId}/verificaciones`).set(bearer(carlos.token)).send({ voto: 'confirma' });
    expect(v1.body).toMatchObject({ estado: 'pendiente', confirmaciones: 1 });
    const dup = await request(app).post(`${api}/reportes-precio/${reporteId}/verificaciones`).set(bearer(carlos.token)).send({ voto: 'confirma' });
    expect(dup.status).toBe(409);
  });

  it('listado de pendientes excluye propios y ya votados', async () => {
    const r = await request(app).get(`${api}/reportes-precio/pendientes`).set(bearer(carlos.token)).query({ ...CENTRO, radioKm: 5 });
    const ids = r.body.datos.map((d: any) => d.reporteId);
    expect(ids).not.toContain(reporteId); // ya voto
  });

  it('al llegar al umbral se publica y dispara alertas', async () => {
    const v2 = await request(app).post(`${api}/reportes-precio/${reporteId}/verificaciones`).set(bearer(ana.token)).send({ voto: 'confirma' });
    expect(v2.status).toBe(201);
    expect(v2.body.estado).toBe('aprobado');
    const publicados = await request(app).get(`${api}/precios`).query({ presentacionId: 3, ...CENTRO, radioKm: 10, fuente: 'comunidad' });
    expect(publicados.body.datos[0]).toMatchObject({ precio: 24.5, estadoVerificacion: 'Activo' });
    const tarde = await request(app).post(`${api}/reportes-precio/${reporteId}/verificaciones`).set(bearer(moderador.token)).send({ voto: 'refuta' });
    expect(tarde.status).toBe(409);
    const mios = await request(app).get(`${api}/reportes-precio/mios`).set(bearer(maria.token)).query({ estado: 'aprobado' });
    expect(mios.body.datos[0]).toMatchObject({ reporteId, estado: 'aprobado', confirmaciones: 2 });
  });

  it('refutaciones suficientes mandan el reporte a moderacion', async () => {
    // El reporte pendiente del seed es de Carlos (pres. 2, tianguis del Pedregal)
    const lista = await request(app).get(`${api}/reportes-precio/pendientes`).set(bearer(maria.token)).query({ ...CENTRO, radioKm: 5 });
    const id = lista.body.datos.find((d: any) => d.precio === 24).reporteId;
    await request(app).post(`${api}/reportes-precio/${id}/verificaciones`).set(bearer(maria.token)).send({ voto: 'refuta', precioObservado: 28 });
    const r = await request(app).post(`${api}/reportes-precio/${id}/verificaciones`).set(bearer(ana.token)).send({ voto: 'refuta' });
    expect(r.body.estado).toBe('en_moderacion');
    const cola = await request(app).get(`${api}/admin/moderacion`).set(bearer(moderador.token)).query({ tipo: 'reporte_precio' });
    expect(cola.body.datos[0].precio).toMatchObject({ precioId: id, refutaciones: 2 });
  });

  it('un precio muy atipico va a moderacion y un voto confirma con otro precio es invalido', async () => {
    const r = await request(app).post(`${api}/reportes-precio`).set(bearer(ana.token)).send({ presentacionId: 1, ubicacionId: 6, precio: 5 });
    expect(r.body.enModeracion).toBe(true);
    const mal = await request(app).post(`${api}/reportes-precio/${r.body.reporteId}/verificaciones`).set(bearer(maria.token)).send({ voto: 'confirma', precioObservado: 6 });
    expect(mal.status).toBe(422);
  });

  it('reporte de dato erroneo entra a la cola una sola vez por usuario', async () => {
    const a = await request(app).post(`${api}/precios/1/reportes-error`).set(bearer(maria.token)).send({ motivo: 'precio_desactualizado' });
    expect(a.status).toBe(201);
    const b = await request(app).post(`${api}/precios/1/reportes-error`).set(bearer(maria.token)).send({ motivo: 'precio_desactualizado' });
    expect(b.status).toBe(409);
  });
});

describe('moderacion', () => {
  it('solo moderadores y admins acceden', async () => {
    expect((await request(app).get(`${api}/admin/moderacion`).set(bearer(maria.token))).status).toBe(403);
    expect((await request(app).get(`${api}/admin/moderacion`)).status).toBe(401);
  });

  it('aprobar un comercio informal lo hace visible', async () => {
    const cola = await request(app).get(`${api}/admin/moderacion`).set(bearer(moderador.token)).query({ tipo: 'comercio' });
    const item = cola.body.datos[0];
    expect(item.comercio.ubicacionId).toBe(7);
    const r = await request(app).put(`${api}/admin/moderacion/${item.id}`).set(bearer(moderador.token)).send({ decision: 'aprobar', motivo: 'Existe' });
    expect(r.body.estado).toBe('aprobado');
    expect((await request(app).put(`${api}/admin/moderacion/${item.id}`).set(bearer(moderador.token)).send({ decision: 'aprobar' })).status).toBe(409);
    const visible = await request(app).get(`${api}/comercios/cercanos`).query({ ...CENTRO, radioKm: 5, tipo: 'informal' });
    expect(visible.body.datos.map((d: any) => d.nombre)).toContain('Tianguis Nuevo (sin verificar)');
  });

  it('rechazar un reporte lo deja fuera de los precios vigentes', async () => {
    const cola = await request(app).get(`${api}/admin/moderacion`).set(bearer(moderador.token)).query({ tipo: 'reporte_precio' });
    const atipico = cola.body.datos.find((d: any) => d.precio.precio === 5);
    await request(app).put(`${api}/admin/moderacion/${atipico.id}`).set(bearer(moderador.token)).send({ decision: 'rechazar', motivo: 'Error de captura' });
    const r = await request(app).get(`${api}/precios`).query({ presentacionId: 1, ...CENTRO, radioKm: 10, soloVerificados: 'false' });
    expect(r.body.datos.map((d: any) => d.precio)).not.toContain(5);
  });
});

describe('canastas', () => {
  let canastaId: number;

  it('CRUD basico y aislamiento entre usuarios', async () => {
    const c = await request(app).post(`${api}/canastas`).set(bearer(maria.token)).send({ nombre: 'Despensa semanal' });
    expect(c.status).toBe(201);
    canastaId = c.body.id;
    const a1 = await request(app).post(`${api}/canastas/${canastaId}/items`).set(bearer(maria.token)).send({ presentacionId: 1, cantidad: 2 });
    expect(a1.status).toBe(201);
    const a2 = await request(app).post(`${api}/canastas/${canastaId}/items`).set(bearer(maria.token)).send({ presentacionId: 1, cantidad: 1 });
    expect(a2.status).toBe(200);
    expect(a2.body.cantidad).toBe(3); // suma si ya existia
    await request(app).post(`${api}/canastas/${canastaId}/items`).set(bearer(maria.token)).send({ presentacionId: 2, cantidad: 3 });
    await request(app).post(`${api}/canastas/${canastaId}/items`).set(bearer(maria.token)).send({ presentacionId: 4, cantidad: 1 });
    expect((await request(app).get(`${api}/canastas/${canastaId}`).set(bearer(carlos.token))).status).toBe(404);
    const det = await request(app).get(`${api}/canastas/${canastaId}`).set(bearer(maria.token));
    expect(det.body.productos).toHaveLength(3);
    expect(det.body.totalReferencia).toBeGreaterThan(0);
    const lista = await request(app).get(`${api}/canastas`).set(bearer(maria.token));
    expect(lista.body.datos[0].numeroProductos).toBe(3);
    expect((await request(app).post(`${api}/canastas/${canastaId}/items`).set(bearer(maria.token)).send({ presentacionId: 999, cantidad: 1 })).status).toBe(422);
  });

  it('optimiza en una tienda y en varias', async () => {
    const una = await request(app).get(`${api}/canastas/${canastaId}/optimizacion`).set(bearer(maria.token)).query({ ...CENTRO, radioKm: 10 });
    expect(una.status).toBe(200);
    expect(una.body.mejorOpcion.completa).toBe(true);
    // las tiendas informales tienen todos los productos de esta canasta y son las mas baratas
    expect(['Tianguis del Pedregal', 'Mercado Independencia']).toContain(una.body.mejorOpcion.tienda.comercio);
    expect(una.body.ahorroVsOpcionMasCara).toBeGreaterThan(0);

    const multi = await request(app).get(`${api}/canastas/${canastaId}/optimizacion`).set(bearer(maria.token)).query({ ...CENTRO, radioKm: 10, estrategia: 'multi_tienda', maxTiendas: 2 });
    expect(multi.status).toBe(200);
    expect(multi.body.completa).toBe(true);
    expect(multi.body.total).toBeLessThanOrEqual(una.body.mejorOpcion.total);
    expect(multi.body.tiendas.length).toBeLessThanOrEqual(2);
  });

  it('modificar y eliminar', async () => {
    const det = await request(app).get(`${api}/canastas/${canastaId}`).set(bearer(maria.token));
    const itemId = det.body.productos[0].itemId;
    expect((await request(app).put(`${api}/canastas/${canastaId}/items/${itemId}`).set(bearer(maria.token)).send({ cantidad: 5 })).body.cantidad).toBe(5);
    expect((await request(app).put(`${api}/canastas/${canastaId}/items/${itemId}`).set(bearer(maria.token)).send({ cantidad: -1 })).status).toBe(422);
    expect((await request(app).delete(`${api}/canastas/${canastaId}/items/${itemId}`).set(bearer(maria.token))).status).toBe(204);
    expect((await request(app).delete(`${api}/canastas/${canastaId}`).set(bearer(maria.token))).status).toBe(204);
    expect((await request(app).get(`${api}/canastas/${canastaId}`).set(bearer(maria.token))).status).toBe(404);
  });
});

describe('alertas y notificaciones', () => {
  it('registra dispositivo, crea alerta y notifica una sola vez', async () => {
    const d = await request(app).post(`${api}/dispositivos`).set(bearer(maria.token)).send({ plataforma: 'android', fcmToken: 'token-de-prueba-0123456789abcdef' });
    expect(d.status).toBe(201);

    // Leche: el mejor precio vigente en la zona es 24.50 (reporte comunitario aprobado en el Pedregal)
    const a = await request(app).post(`${api}/alertas`).set(bearer(maria.token)).send({ presentacionId: 3, precioObjetivo: 25, centro: CENTRO, radioKm: 5 });
    expect(a.status).toBe(201);
    expect(a.body.precioObjetivo).toBe(25);

    const e1 = await request(app).post(`${api}/admin/alertas/evaluar`).set(bearer(admin.token)).send({});
    expect(e1.body.notificacionesEnviadas).toBe(1);
    const e2 = await request(app).post(`${api}/admin/alertas/evaluar`).set(bearer(admin.token)).send({});
    expect(e2.body.notificacionesEnviadas).toBe(0); // no repite

    const n = await request(app).get(`${api}/notificaciones`).set(bearer(maria.token));
    expect(n.body.total).toBe(1);
    expect(n.body.datos[0].cuerpo).toContain('24.50');
    expect((await request(app).post(`${api}/admin/alertas/evaluar`).set(bearer(maria.token)).send({})).status).toBe(403);
  });

  it('modificar, pausar y eliminar una alerta propia', async () => {
    const lista = await request(app).get(`${api}/alertas`).set(bearer(maria.token));
    const id = lista.body.datos[0].id;
    const m = await request(app).put(`${api}/alertas/${id}`).set(bearer(maria.token)).send({ precioObjetivo: 20, activa: false });
    expect(m.body).toMatchObject({ precioObjetivo: 20, activa: false });
    expect((await request(app).put(`${api}/alertas/${id}`).set(bearer(carlos.token)).send({ activa: true })).status).toBe(404);
    expect((await request(app).delete(`${api}/alertas/${id}`).set(bearer(maria.token))).status).toBe(204);
  });
});

describe('CAT-05, CAT-07 y EXT-01: comercios cercanos y geocodificacion inversa', () => {
  const DIRECCION_GOOGLE = 'Calle Falsa 123, Centro, 58000 Morelia, Mich., Mexico';
  const respuestaGoogle = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
  const googleOk = () => respuestaGoogle({ status: 'OK', results: [{ formatted_address: DIRECCION_GOOGLE, types: ['street_address'] }] });
  const informal = (extra: object = {}) => ({ nombre: 'Puesto Dona Lupa', tipo: 'puesto', mercado: 'Tianguis dominical', lat: 19.7031, lng: -101.1921, referencia: 'Junto a la entrada norte', ...extra });
  const alta = (token: string, cuerpo: object) => request(app).post(`${api}/comercios/informales`).set(bearer(token)).send(cuerpo);
  const cercanos = (q: object = {}) => request(app).get(`${api}/comercios/cercanos`).query({ ...CENTRO, radioKm: 5, ...q });
  const ubicacionEnBd = async (id: number) => (await pool.query('SELECT direccion, estado_verificacion FROM ubicaciones_comercio WHERE id = $1', [id])).rows[0];

  const claveOriginal = config.googleMaps.apiKey;
  const timeoutOriginal = config.googleMaps.timeoutMs;
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    config.googleMaps.apiKey = claveOriginal;
    config.googleMaps.timeoutMs = timeoutOriginal;
  });

  it('flujo completo: alta Pendiente con direccion de Google, oculta hasta MOD-02, luego visible y ordenada por distancia', async () => {
    const fetchMock = vi.fn(async () => googleOk());
    vi.stubGlobal('fetch', fetchMock);

    const r = await alta(maria.token, informal());
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estadoVerificacion: 'Pendiente', direccion: DIRECCION_GOOGLE });
    expect(JSON.stringify(r.body)).not.toContain(config.googleMaps.apiKey); // la clave nunca sale del servidor
    expect(await ubicacionEnBd(r.body.ubicacionId)).toMatchObject({ direccion: DIRECCION_GOOGLE, estado_verificacion: 'Pendiente' });

    // La llamada a Google usa coordenadas, idioma y la clave del entorno
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/geocode/json');
    expect(url.searchParams.get('latlng')).toBe('19.7031,-101.1921');
    expect(url.searchParams.get('language')).toBe('es');
    expect(url.searchParams.get('key')).toBe(config.googleMaps.apiKey);

    // Pendiente: no aparece para el publico
    expect((await cercanos()).body.datos.map((d: any) => d.nombre)).not.toContain('Puesto Dona Lupa');
    expect((await request(app).get(`${api}/comercios/${r.body.comercioId}`)).status).toBe(404);

    // El moderador la ve con su direccion y la aprueba
    const cola = await request(app).get(`${api}/admin/moderacion`).set(bearer(moderador.token)).query({ tipo: 'comercio' });
    const item = cola.body.datos.find((i: any) => i.comercio.ubicacionId === r.body.ubicacionId);
    expect(item.comercio).toMatchObject({ direccion: DIRECCION_GOOGLE, mercado: 'Tianguis dominical' });
    expect((await request(app).put(`${api}/admin/moderacion/${item.id}`).set(bearer(moderador.token)).send({ decision: 'aprobar' })).status).toBe(200);

    // Aprobada: visible y ordenada por distancia
    const lista = (await cercanos()).body.datos;
    const nombres = lista.map((d: any) => d.nombre);
    expect(nombres.indexOf('Puesto Dona Lupa')).toBe(1); // Chedraui esta a 0 km; Mercado Independencia a ~0.4 km
    const dist = lista.map((d: any) => d.distanciaKm);
    expect([...dist].sort((a, b) => a - b)).toEqual(dist);
    expect(lista[1]).toMatchObject({ direccion: DIRECCION_GOOGLE, estadoVerificacion: 'Verificada', tipo: 'informal' });
    // El radio se respeta
    expect((await cercanos({ radioKm: 0.03 })).body.datos.map((d: any) => d.nombre)).toEqual(['Chedraui']);
  });

  it.each([
    ['red caida', () => Promise.reject(new TypeError('fetch failed'))],
    ['HTTP 500', async () => respuestaGoogle({}, 500)],
    ['REQUEST_DENIED', async () => respuestaGoogle({ status: 'REQUEST_DENIED', error_message: 'API key invalida' })],
    ['OVER_QUERY_LIMIT', async () => respuestaGoogle({ status: 'OVER_QUERY_LIMIT' })],
    ['ZERO_RESULTS', async () => respuestaGoogle({ status: 'ZERO_RESULTS', results: [] })],
    ['solo plus code (no es direccion legible)', async () => respuestaGoogle({ status: 'OK', results: [{ formatted_address: 'GGJ5+2P Morelia', types: ['plus_code'] }] })],
    ['respuesta que no es JSON', async () => new Response('<html>gateway</html>', { status: 200 })],
  ])('si Google falla (%s), CAT-07 guarda el comercio con coordenadas y sin direccion', async (_caso, impl) => {
    vi.stubGlobal('fetch', vi.fn(impl));
    const r = await alta(carlos.token, informal({ nombre: `Puesto sin direccion ${_caso}` }));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estadoVerificacion: 'Pendiente', direccion: null });
    const fila = (await pool.query(`SELECT direccion, estado_verificacion, ST_Y(ubicacion::geometry) AS lat, ST_X(ubicacion::geometry) AS lng FROM ubicaciones_comercio WHERE id = $1`, [r.body.ubicacionId])).rows[0];
    expect(fila).toMatchObject({ direccion: null, estado_verificacion: 'Pendiente' });
    expect(fila.lat).toBeCloseTo(19.7031, 4);
    expect(fila.lng).toBeCloseTo(-101.1921, 4);
    const enCola = await pool.query(`SELECT 1 FROM cola_moderacion WHERE ubicacion_comercio_id = $1 AND estado = 'pendiente'`, [r.body.ubicacionId]);
    expect(enCola.rowCount).toBe(1);
  });

  it('si Google no contesta a tiempo, el alta termina cuando vence el timeout y no falla', async () => {
    config.googleMaps.timeoutMs = 50;
    // Peticion colgada que solo termina cuando la senal de aborto se dispara
    vi.stubGlobal('fetch', vi.fn((_u: unknown, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(init.signal!.reason)))));
    const t0 = Date.now();
    const r = await alta(carlos.token, informal({ nombre: 'Puesto con Google colgado' }));
    expect(r.status).toBe(201);
    expect(r.body.direccion).toBeNull();
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('sin GOOGLE_MAPS_API_KEY no se llama a Google y el alta funciona', async () => {
    config.googleMaps.apiKey = '';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await alta(maria.token, informal({ nombre: 'Puesto sin clave' }));
    expect(r.status).toBe(201);
    expect(r.body.direccion).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('coordenadas fuera de Mexico (p. ej. 0,0) se rechazan sin llamar a Google', async () => {
    const fetchMock = vi.fn(async () => googleOk());
    vi.stubGlobal('fetch', fetchMock);
    const r = await alta(maria.token, informal({ lat: 0, lng: 0 }));
    expect(r.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await alta(maria.token, { ...informal(), lat: 'x' })).status).toBe(422);
    expect((await request(app).post(`${api}/comercios/informales`).send(informal())).status).toBe(401);
  });

  it('el tope de 10 pendientes por usuario se aplica antes de pagar una llamada a Google', async () => {
    const fetchMock = vi.fn(async () => googleOk());
    vi.stubGlobal('fetch', fetchMock);
    for (let i = 0; i < 10; i++) expect((await alta(ana.token, informal({ nombre: `Puesto ${i}` }))).status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(10);
    const r = await alta(ana.token, informal({ nombre: 'Puesto 11' }));
    expect(r.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('CAT-05 devuelve solo ubicaciones Verificadas (formales pendientes o rechazadas no aparecen)', async () => {
    const mk = async (nombre: string, estado: string, lng: number) => {
      const c = (await pool.query(`INSERT INTO comercios (nombre, tipo, subtipo) VALUES ($1, 'Formal', 'supermercado') RETURNING id`, [nombre])).rows[0];
      await pool.query(`INSERT INTO ubicaciones_comercio (comercio_id, direccion, ubicacion, estado_verificacion) VALUES ($1, 'x', ST_SetSRID(ST_MakePoint($2, 19.7027), 4326)::geography, $3)`, [c.id, lng, estado]);
    };
    await mk('Formal Pendiente', 'Pendiente', -101.1920);
    await mk('Formal Rechazada', 'Rechazada', -101.1919);
    await mk('Formal Verificada', 'Verificada', -101.1918);
    const nombres = (await cercanos({ tipo: 'formal' })).body.datos.map((d: any) => d.nombre);
    expect(nombres).toContain('Formal Verificada');
    expect(nombres).not.toContain('Formal Pendiente');
    expect(nombres).not.toContain('Formal Rechazada');
  });

  it('el predicado espacial de CAT-05 puede resolverse con el indice GIST', async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL enable_seqscan = off'); // con 10 filas el planificador preferiria un seq scan; aqui solo se comprueba que el indice sirve
      const plan = (await c.query(`EXPLAIN SELECT 1 FROM ubicaciones_comercio u WHERE ST_DWithin(u.ubicacion, ST_SetSRID(ST_MakePoint(-101.1925, 19.7027), 4326)::geography, 3000)`)).rows.map((r) => r['QUERY PLAN']).join('\n');
      expect(plan).toContain('idx_ubicaciones_geo');
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  });
});
