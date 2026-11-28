import { describe, expect, it } from 'vitest';
import {
  coincideDireccion,
  direccionCompleta,
  extraerCP,
  firma,
  quitarTipo,
  separarMarca,
  textoParaUnidades,
} from '../../src/etl/qqp-api/texto';

// Textos reales del buscador QQP (Morelia, noviembre 2026) y del CSV de datos abiertos.

describe('firma', () => {
  it('ignora orden, puntuacion, acentos y mayusculas', () => {
    expect(firma('LALA. ENTERA, CAJA 1 LT.')).toBe(firma('Lala Caja 1 Lt. Entera'));
    expect(firma('ALPURA. LIGHT, PARCIALMENTE DESCREMADA. CAJA 1 LT.')).toBe(
      firma('Alpura Caja 1 Lt. Parcialmente Descremada. Light')
    );
    expect(firma('TEHUACÁN')).toBe(firma('tehuacan'));
  });

  it('trata "C/18" y "CON 18" como lo mismo', () => {
    expect(firma('BACHOCO, PAQUETE CON 18 ROJO')).toBe(firma('Bachoco Paquete C/18 Rojo'));
    expect(firma('TEHUACÁN, PAQUETE C/30. BLANCO')).toBe(firma('Tehuacan Paquete con 30 Blanco'));
  });

  it('ignora palabras repetidas', () => {
    expect(firma('LALA. SEMIDESCREMADA. REDUCIDA EN GRASA, CAJA 1 LT. SEMIDESCREMADA')).toBe(
      firma('Lala Caja 1 Lt. Semidescremada. Reducida en Grasa')
    );
  });

  it('distingue variedades y tamanos', () => {
    expect(firma('LALA. ENTERA, CAJA 1 LT.')).not.toBe(firma('Lala Caja 1 Lt. Parcialmente Descremada. Light'));
    expect(firma('VERDE VALLE, BOLSA 900 GR. NEGRO')).not.toBe(firma('Verde Valle Bolsa 900 Gr. Negro. Jamapa'));
    expect(firma('SOS, BOLSA 907 GR.')).not.toBe(firma('Sos Bolsa 1 Kg.'));
  });

  it('separa marcas escritas con guion o guion bajo igual', () => {
    expect(firma('1-2-3, BOTELLA 1 LT. VEGETAL')).toBe(firma('1_2_3 Botella 1 Lt. Vegetal'));
  });
});

describe('quitarTipo', () => {
  it('quita el tipo aunque contenga punto', () => {
    expect(
      quitarTipo('POLLO ROSTIZADO. TRADICIONAL, S/M, PIEZA (CHAROLA O BOLSA)', 'POLLO ROSTIZADO. TRADICIONAL')
    ).toBe('S/M, PIEZA (CHAROLA O BOLSA)');
  });

  it('devuelve null si el texto no empieza con el tipo o no queda nada', () => {
    expect(quitarTipo('ARROZ, SOS, BOLSA 1 KG.', 'FRIJOL')).toBeNull();
    expect(quitarTipo('HUEVO', 'HUEVO')).toBeNull();
  });

  it('compara sin acentos', () => {
    expect(quitarTipo('ATÚN, FRESH LABEL, LATA 140 GR.', 'ATUN')).toBe('FRESH LABEL, LATA 140 GR.');
  });
});

describe('separarMarca', () => {
  const marcas = [
    { id: 1, nombre: 'Alpura' },
    { id: 2, nombre: 'Alpura. Clásica' },
    { id: 3, nombre: 'San Juan' },
  ];

  it('prefiere la marca conocida mas larga', () => {
    const s = separarMarca('ALPURA. CLÁSICA, PARCIALMENTE DESCREMADA. CAJA 1 LT. AZUL', marcas);
    expect(s.marca?.id).toBe(2);
    expect(s.descripcion).toBe('PARCIALMENTE DESCREMADA. CAJA 1 LT. AZUL');
  });

  it('separa marcas pegadas al punto', () => {
    const s = separarMarca('ALPURA.VAQUITAS, SEMIDESCREMADA. CAJA 200 ML.', marcas);
    expect(s.marca?.id).toBe(1);
    expect(s.descripcion).toBe('VAQUITAS, SEMIDESCREMADA. CAJA 200 ML.');
  });

  it('sin marca conocida toma el texto hasta el primer punto o coma', () => {
    const s = separarMarca('SAN MARCOS, ENTERA. CAJA 1 LT.', marcas);
    expect(s.marca).toBeNull();
    expect(s.textoMarca).toBe('SAN MARCOS');
    expect(s.descripcion).toBe('ENTERA. CAJA 1 LT.');
  });
});

describe('textoParaUnidades', () => {
  it('convierte la escritura del buscador a la que entiende unidades.ts', () => {
    expect(textoParaUnidades('PAQUETE CON 18. BLANCO')).toBe('PAQUETE C/18 BLANCO');
    expect(textoParaUnidades('BOTELLA 850 ML. SOYA')).toBe('BOTELLA 850 ML. SOYA');
  });
});

describe('direcciones', () => {
  const megaCSV =
    'Artilleros de 47 No. 1520. Entre Enrique Ramirez y Curtidores. Col. Chapultepec Oriente. Cp. 58260';

  it('extrae el codigo postal del CSV', () => {
    expect(extraerCP(megaCSV)).toBe('58260');
    expect(extraerCP('Av. Montaña Monarca 1000. Col. Altozano. Cp.58350')).toBe('58350');
    expect(extraerCP('Sin codigo')).toBeNull();
  });

  it('empareja la direccion recortada de la API con la completa del CSV', () => {
    expect(coincideDireccion({ direccion: 'ARTILLEROS DE 47 NO. 1520, ENTRE ENRIQUE RAMIREZ Y CURT', cp: '58260' }, megaCSV)).toBe(true);
    expect(
      coincideDireccion(
        { direccion: 'PERIF. PASEO DE LA REPÚBLICA  3352, ESQ. AV. CAMELINAS', cp: '58270' },
        'Perif. Paseo de la República 3352. Esq. Av. Camelinas. Col. Oculusen. Cp. 58270'
      )
    ).toBe(true);
  });

  it('distingue sucursales de la misma cadena', () => {
    const lorena = { direccion: 'BATALLA DE CASA MATA 1296, ESQ. CALLE TERCERA PRIVADA D', cp: '58260' };
    expect(
      coincideDireccion(lorena, 'Batalla de Casa Mata 1296. Esq. Calle Tercera Privada de Casa Mata. Col. Chapultepec Sur. Cp. 58260')
    ).toBe(true);
    expect(coincideDireccion(lorena, 'Rotarismo 150. Entre Acamapichtli y Huitzilihuitl. Col. Faldas del Punhuato. Cp. 58295')).toBe(false);
    expect(
      coincideDireccion(
        { direccion: 'PERIF. PASEO DE LA REPÚBLICA 495, ENTRE DURANGO Y CARLO', cp: '58210' },
        'Perif. Paseo de la República 3352. Esq. Av. Camelinas. Col. Oculusen. Cp. 58270'
      )
    ).toBe(false);
  });

  it('rechaza si el codigo postal no coincide', () => {
    expect(coincideDireccion({ direccion: 'ARTILLEROS DE 47 NO. 1520', cp: '58000' }, megaCSV)).toBe(false);
  });

  it('una sucursal creada desde la API se reconoce en la siguiente corrida', () => {
    const guardada = direccionCompleta('TORTILLERÍA LA INMACULADA C. DE BUCARELI NO. 50-A', 'MORELIA VALLADOLID', '58190');
    expect(guardada).toBe('TORTILLERÍA LA INMACULADA C. DE BUCARELI NO. 50-A. Col. MORELIA VALLADOLID. Cp. 58190');
    expect(coincideDireccion({ direccion: 'TORTILLERÍA LA INMACULADA C. DE BUCARELI NO. 50-A', cp: '58190' }, guardada)).toBe(true);
  });
});
