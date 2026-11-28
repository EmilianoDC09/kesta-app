import { describe, expect, it } from 'vitest';
import { decidirPresentacion, decidirUbicacion, MOTIVOS, PresentacionCatalogo } from '../../src/etl/qqp-api/emparejar';

// Marcas y presentaciones tal como las dejo la carga del CSV (datos/catalogo_profeco.json).
const marcas = [
  { id: 1, nombre: 'Lala' },
  { id: 2, nombre: 'Alpura' },
  { id: 3, nombre: 'Alpura. Clásica' },
  { id: 4, nombre: 'Alpura. Vaquitas' },
  { id: 5, nombre: 'Sos' },
  { id: 6, nombre: 'San Juan' },
  { id: 7, nombre: 'Bachoco' },
  { id: 8, nombre: '1_2_3' },
  { id: 9, nombre: 'Great Value' },
];
const nombre = (id: number) => marcas.find((m) => m.id === id)!.nombre;
const p = (id: number, marcaId: number, descripcion: string, cantidad: number, unidad: string): PresentacionCatalogo => ({
  id, marcaId, marcaNombre: nombre(marcaId), descripcion, cantidad, unidad,
});

const leche = [
  p(1, 1, 'Caja 1 Lt. Entera', 1000, 'ml'),
  p(2, 1, 'Caja 1 Lt. Parcialmente Descremada. Light. Baja en Grasa', 1000, 'ml'),
  p(3, 1, 'Caja 1 Lt. Semidescremada. Reducida en Grasa', 1000, 'ml'),
  p(4, 2, 'Caja 1 Lt. Parcialmente Descremada. Light', 1000, 'ml'),
  p(5, 2, 'Caja 1 Lt. Parcialmente Descremada. Semi', 1000, 'ml'),
  p(6, 3, 'Caja 1 Lt. Parcialmente Descremada. Azul', 1000, 'ml'),
  p(7, 3, 'Caja 200 Ml. Parcialmente Descremada', 200, 'ml'),
  p(8, 4, 'Caja 200 Ml. Semidescremada. Chocopower. Sabor Chocolate', 200, 'ml'),
];
const arroz = [
  p(10, 5, 'Bolsa 907 Gr. Super Extra. Grano Grueso', 907, 'g'),
  p(11, 5, 'Bolsa 1 Kg. Super Extra. Integral', 1000, 'g'),
];
const huevo = [p(12, 6, 'Paquete C/12 Blanco', 12, 'pza'), p(13, 7, 'Paquete C/18 Rojo', 18, 'pza')];
const aceite = [p(14, 8, 'Botella 1 Lt. Vegetal', 1000, 'ml')];
const frijol = [p(15, 9, 'Bolsa 900 Gr. Negro', 900, 'g')];

describe('decidirPresentacion: coincidencias con el catalogo', () => {
  it.each([
    ['LALA. ENTERA, CAJA 1 LT.', leche, 1],
    ['LALA. LIGHT. BAJA EN GRASA, PARCIALMENTE DESCREMADA. CAJA 1 LT.', leche, 2],
    ['LALA. SEMIDESCREMADA. REDUCIDA EN GRASA, CAJA 1 LT. SEMIDESCREMADA', leche, 3],
    ['ALPURA. LIGHT, PARCIALMENTE DESCREMADA. CAJA 1 LT.', leche, 4],
    ['ALPURA. SEMI, PARCIALMENTE DESCREMADA. CAJA 1 LT.', leche, 5],
    ['ALPURA. CLÁSICA, PARCIALMENTE DESCREMADA. CAJA 1 LT. AZUL', leche, 6],
    ['ALPURA. CLÁSICA, PARCIALMENTE DESCREMADA. CAJA 200 ML.', leche, 7],
    ['ALPURA.VAQUITAS, SEMIDESCREMADA. CAJA 200 ML. CHOCOPOWER. SABOR CHOCOLATE', leche, 8],
    ['SAN JUAN, PAQUETE CON 12 BLANCO', huevo, 12],
    ['BACHOCO, PAQUETE CON 18 ROJO', huevo, 13],
    ['1-2-3, BOTELLA 1 LT. VEGETAL', aceite, 14],
  ])('%s', (texto, catalogo, id) => {
    expect(decidirPresentacion(texto, catalogo, marcas)).toEqual({ tipo: 'existente', presentacionId: id });
  });

  it('no mezcla variedades del mismo tamano (entera, light, semi)', () => {
    const ids = [
      'LALA. ENTERA, CAJA 1 LT.',
      'LALA. LIGHT. BAJA EN GRASA, PARCIALMENTE DESCREMADA. CAJA 1 LT.',
      'LALA. SEMIDESCREMADA. REDUCIDA EN GRASA, CAJA 1 LT. SEMIDESCREMADA',
    ].map((t) => (decidirPresentacion(t, leche, marcas) as { presentacionId: number }).presentacionId);
    expect(new Set(ids).size).toBe(3);
  });

  it('dos presentaciones con la misma firma son ambiguas', () => {
    const duplicado = [...aceite, p(99, 8, 'Vegetal, Botella 1 Lt.', 1000, 'ml')];
    expect(decidirPresentacion('1-2-3, BOTELLA 1 LT. VEGETAL', duplicado, marcas)).toEqual({
      tipo: 'externo', motivo: MOTIVOS.ambigua,
    });
  });
});

describe('decidirPresentacion: sin coincidencia exacta', () => {
  it('crea un tamano nuevo de un par producto-marca conocido', () => {
    expect(decidirPresentacion('SOS, BOLSA 500 GR. SUPER EXTRA. GRANO GRUESO', arroz, marcas)).toEqual({
      tipo: 'crear', marcaId: 5, descripcion: 'BOLSA 500 GR. SUPER EXTRA. GRANO GRUESO', cantidad: 500, unidad: 'g',
    });
    expect(decidirPresentacion('SAN JUAN, PAQUETE CON 30 BLANCO', huevo, marcas)).toMatchObject({
      tipo: 'crear', marcaId: 6, cantidad: 30, unidad: 'pza',
    });
  });

  it('manda a revision si ya hay una presentacion de esa marca y cantidad escrita distinto', () => {
    // "GRUESO" contra "Grano Grueso": probablemente la misma.
    expect(decidirPresentacion('SOS, BOLSA 907 GR. SUPER EXTRA. GRUESO', arroz, marcas)).toEqual({
      tipo: 'externo', motivo: MOTIVOS.similar,
    });
    // "Negro. Queretaro" contra "Negro": probablemente otra variedad. Tampoco se adivina.
    expect(decidirPresentacion('GREAT VALUE, BOLSA 900 GR. NEGRO. QUERÉTARO', frijol, marcas)).toEqual({
      tipo: 'externo', motivo: MOTIVOS.similar,
    });
  });

  it('una marca que no existe no se captura por prefijo de otra', () => {
    expect(decidirPresentacion('SAN MARCOS, ENTERA. CAJA 1 LT.', leche, marcas)).toEqual({
      tipo: 'externo', motivo: MOTIVOS.marca,
    });
  });

  it('no asocia una marca conocida a un producto en el que nunca aparecio', () => {
    expect(decidirPresentacion('GREAT VALUE, ENVASE O CAJA 1 LT. ENTERA', leche, marcas)).toEqual({
      tipo: 'externo', motivo: MOTIVOS.asociacion,
    });
  });

  it('rechaza presentaciones sin cantidad interpretable', () => {
    expect(decidirPresentacion('SOS, BOLSA SUPER EXTRA', arroz, marcas)).toEqual({ tipo: 'externo', motivo: MOTIVOS.unidad });
  });
});

describe('decidirUbicacion', () => {
  const csv = 'Artilleros de 47 No. 1520. Entre Enrique Ramirez y Curtidores. Col. Chapultepec Oriente. Cp. 58260';
  const api = { direccion: 'ARTILLEROS DE 47 NO. 1520, ENTRE ENRIQUE RAMIREZ Y CURT', cp: '58260' };

  it('prefiere la sucursal con coordenadas sobre un duplicado sin punto', () => {
    const r = decidirUbicacion(api, [
      { id: 40, direccion: 'ARTILLEROS DE 47 NO. 1520, ENTRE ENRIQUE RAMIREZ Y CURT', tieneCoordenadas: false },
      { id: 3, direccion: csv, tieneCoordenadas: true },
    ]);
    expect(r).toEqual({ tipo: 'existente', ubicacionId: 3, tieneCoordenadas: true });
  });

  it('usa una sucursal sin punto si es la unica que coincide', () => {
    expect(decidirUbicacion(api, [{ id: 40, direccion: csv, tieneCoordenadas: false }])).toEqual({
      tipo: 'existente', ubicacionId: 40, tieneCoordenadas: false,
    });
  });

  it('marca ambigua si coinciden dos sucursales con punto', () => {
    expect(
      decidirUbicacion(api, [
        { id: 3, direccion: csv, tieneCoordenadas: true },
        { id: 4, direccion: csv, tieneCoordenadas: true },
      ])
    ).toEqual({ tipo: 'ambigua' });
  });

  it('pide crear la sucursal si ninguna coincide', () => {
    expect(decidirUbicacion(api, [{ id: 9, direccion: 'Solidaridad 350. Cp. 58070', tieneCoordenadas: true }])).toEqual({ tipo: 'nueva' });
  });
});

describe('decidirPresentacion: frutas y verduras a granel', () => {
  const s = { id: 20, nombre: 'S/M' };
  const conSM = [...marcas, s];
  const q = (id: number, descripcion: string): PresentacionCatalogo => ({
    id, marcaId: 20, marcaNombre: 'S/M', descripcion, cantidad: 1000, unidad: 'g',
  });
  const manzana = [
    q(30, '1 Kg. Granel. Gala'),
    q(31, '1 Kg. Granel. Golden'),
    q(32, '1 Kg. Granel. Golden Delicious'),
    q(33, '1 Kg. Granel. Royal Gala'),
    q(34, '1 Kg. Granel. Red Delicious/roja/roja Mediana/roja Americana'),
  ];
  const limon = [q(40, '1 Kg. Granel. Agrio con Semilla o Colima'), q(41, '1 Kg. Granel. Agrio Sin Semilla o Persa')];
  const cebolla = [q(50, '1 Kg. Granel. Blanca Sin Rabo'), q(51, '1 Kg. Granel. Blanca Sin Rabo. en Malla')];

  it.each([
    ['S/M, 1 KG. GOLDEN', manzana, 'Manzana', 31],
    ['S/M, 1 KG. ROYAL GALA', manzana, 'Manzana', 33],
    ['S/M, 1 KG. RED DELICIOUS/MANZANA ROJA/ MANZANA ROJA MEDIANA/ MANZANA ROJA AMERICANA/', manzana, 'Manzana', 34],
    ['S/M, 1 KG. AGRIO CON SEMILLA O LIMON COLIMA', limon, 'Limón', 40],
    ['S/M, 1 KG. AGRIO SIN SEMILLA O LIMON PERSA', limon, 'Limón', 41],
    ['S/M, 1 KG. BLANCA SIN RABO', cebolla, 'Cebolla', 50],
    ['S/M, 1 KG. EN MALLA. BLANCA SIN RABO', cebolla, 'Cebolla', 51],
  ])('%s', (texto, catalogo, producto, id) => {
    expect(decidirPresentacion(texto, catalogo, conSM, producto)).toEqual({ tipo: 'existente', presentacionId: id });
  });

  it('ignorar "granel" no junta variedades distintas', () => {
    expect(decidirPresentacion('S/M, 1 KG. GALA', manzana, conSM, 'Manzana')).toEqual({ tipo: 'existente', presentacionId: 30 });
    expect(decidirPresentacion('S/M, 1 KG. AGRIO CON SEMILLA O COLIMA. UPC 4306. EN MALLA', limon, conSM, 'Limón')).toEqual({
      tipo: 'externo', motivo: MOTIVOS.similar,
    });
  });
});
