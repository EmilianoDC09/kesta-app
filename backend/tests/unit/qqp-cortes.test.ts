import { describe, expect, it } from 'vitest';
import { CORTES, esCorte, pareceCorteNuevo } from '../../src/etl/qqp-api/cortes';
import { CandidatoCorte, decidirCorte, MOTIVOS, MOTIVOS_CORTE, PresentacionCatalogo } from '../../src/etl/qqp-api/emparejar';
import { quitarTipo } from '../../src/etl/qqp-api/texto';

// Presentaciones de carne tal como las dejo el CSV de julio 2026 (catalogo_profeco.json).
const marcas = [
  { id: 1, nombre: 'S/M' },
  { id: 2, nombre: 'Bachoco' },
  { id: 3, nombre: 'Sukarne' },
];
let n = 0;
const p = (descripcion: string, marcaId = 1, cantidad = 1000): PresentacionCatalogo => ({
  id: ++n, marcaId, marcaNombre: marcas.find((m) => m.id === marcaId)!.nombre, descripcion, cantidad, unidad: 'g',
});
const res = [
  p('1 Kg. Granel. Bistec Corte Delgado o Bistec'),
  p('1 Kg. Granel. Bistec para el Asador'),
  p('1 Kg. Granel. Bistec del 0'),
  p('1 Kg. Granel. Bistec del 0 para el Asador'),
  p('1 Kg. Granel. Bistec/chuleta del 0'),
  p('1 Kg. Granel. Bistec de Espaldilla'),
  p('1 Kg. Granel. Chuleta o Chuleta Costilla o Chuletón'),
  p('1 Kg. Granel. Falda o para Deshebrar o Deshebrada'),
  p('1 Kg. Granel. Falda para Cocer o Guisar'),
  p('1 Kg. Granel. Filete Limpio'),
  p('1 Kg. Granel. Milanesa o de Corte Delgado o de Pulpa Blanca'),
  p('1 Kg. Granel. Molida'),
  p('1 Kg. Granel. Molida Especial 80/20'),
  p('1 Kg. Granel. Molida Top Sirlion 90/10 o de Sirlion 90/10'),
  p('Paquete 500 Gr. Hígado Rebanado', 3, 500),
];
const cerdo = [
  p('1 Kg. Granel. Chuleta Ahumada o Entrecot Ahumado'),
  p('1 Kg. Granel. Lomo o Caña de Lomo o en Trozo/lomo Sin Hueso'),
  p('1 Kg. Granel. Milanesa o Milanesa de Pierna'),
  p('1 Kg. Granel. Molida o Pulpa Molida'),
  p('1 Kg. Granel. Pierna Entera Sin Hueso o Pernil Sin Hueso'),
  p('1 Kg. Granel. Pierna Entera con Hueso o Pernil con Hueso'),
];
const pollo = [
  p('1 Kg. Granel. Entero', 2),
  p('1 Kg. Granel. Pechuga. Filete'),
  p('1 Kg. Granel. Pierna o Pierna Bate'),
  p('1 Kg. Granel. Pierna con Muslo. Corte Americano'),
];
const candidatos: CandidatoCorte[] = [
  { productoId: 100, productoNombre: 'Carne Res', presentaciones: res },
  { productoId: 200, productoNombre: 'Carne Cerdo', presentaciones: cerdo },
  { productoId: 300, productoNombre: 'Carne Pollo', presentaciones: pollo },
];
const descripcionDe = (id: number) => [...res, ...cerdo, ...pollo].find((x) => x.id === id)!.descripcion;
const decidir = (tipo: string, texto: string) => decidirCorte(tipo, quitarTipo(texto, tipo)!, candidatos, marcas);

describe('decidirCorte: el animal lo decide la presentacion del catalogo', () => {
  it.each([
    ['BISTEC. CORTE DELGADO', 'BISTEC. CORTE DELGADO, S/M, 1 KG. GRANEL. BISTEC DE RES CORTE DELGADO O BISTEC DE RES', 100, 'Bistec Corte Delgado o Bistec'],
    ['BISTEC. CORTE DELGADO', 'BISTEC. CORTE DELGADO, S/M, 1 KG. GRANEL. BISTEC PARA EL ASADOR', 100, 'Bistec para el Asador'],
    ['BISTEC DEL 0', 'BISTEC DEL 0, S/M, 1 KG. GRANEL. BISTEC DEL 0', 100, 'Bistec del 0'],
    ['BISTEC DEL 0', 'BISTEC DEL 0, S/M, 1 KG. GRANEL. BISTEC DEL 0 PARA EL ASADOR', 100, 'Bistec del 0 para el Asador'],
    ['BISTEC DE ESPALDILLA', 'BISTEC DE ESPALDILLA, S/M, 1 KG. GRANEL', 100, 'Bistec de Espaldilla'],
    ['CHULETA', 'CHULETA, S/M, 1 KG. GRANEL. CHULETA AHUMADA O ENTRECOT AHUMADO', 200, 'Chuleta Ahumada'],
    ['CHULETA O CHULETA COSTILLA O CHULETÓN', 'CHULETA O CHULETA COSTILLA O CHULETÓN, S/M, 1 KG. GRANEL. CHULETA, O CHULETA COSTILLA, O CHULETON', 100, 'Chuletón'],
    ['MILANESA', 'MILANESA, S/M, 1 KG. GRANEL. MILANESA O MILANESA DE PIERNA', 200, 'Milanesa de Pierna'],
    ['MILANESA', 'MILANESA, S/M, 1 KG. GRANEL. MILANESA O MILANESA CORTE DELGADO O PULPA BLANCA', 100, 'Pulpa Blanca'],
    ['FALDA', 'FALDA, S/M, 1 KG. GRANEL O PARA DESHEBRAR', 100, 'Deshebrar'],
    ['CARNE MOLIDA', 'CARNE MOLIDA, S/M, 1 KG. GRANEL. O PULPA MOLIDA', 200, 'Molida o Pulpa Molida'],
    ['CARNE MOLIDA', 'CARNE MOLIDA, S/M, 1 KG. GRANEL. MOLIDA DE RES', 100, '1 Kg. Granel. Molida'],
    ['CARNE MOLIDA', 'CARNE MOLIDA, S/M, 1 KG. GRANEL. MOLIDA TOP SIRLION 90-10 O MOLIDA DE SIRLION 90-10', 100, 'Sirlion'],
    ['LOMO', 'LOMO, S/M, 1 KG. GRANEL. LOMO, O CAÑA DE LOMO, O EN TROZO/LOMO DE CERDO SIN HUESO', 200, 'Lomo'],
    ['PIERNA', 'PIERNA, S/M, 1 KG. GRANEL. PIERNA O PIERNA BATE', 300, 'Pierna Bate'],
    ['PIERNA CON MUSLO', 'PIERNA CON MUSLO, S/M, 1 KG. GRANEL. PIERNA CON MUSLO DE POLLO. CORTE AMERICANO', 300, 'Corte Americano'],
    ['PIERNA ENTERA/PERNIL', 'PIERNA ENTERA/PERNIL, S/M, 1 KG. GRANEL CON HUESO', 200, 'con Hueso o Pernil con Hueso'],
    ['PIERNA ENTERA/PERNIL', 'PIERNA ENTERA/PERNIL, S/M, 1 KG. GRANEL. CARNE CERDO. PIERNA ENTERA SIN HUESO, O PERNIL SIN HUESO', 200, 'Sin Hueso o Pernil Sin Hueso'],
    ['ENTERO', 'ENTERO, BACHOCO, 1 KG. GRANEL. ENTERO', 300, 'Entero'],
    ['HIGADO', 'HIGADO, SUKARNE, PAQUETE 500 GR. HÍGADO REBANADO', 100, 'Hígado Rebanado'],
  ])('%s: %s', (tipo, texto, productoId, contiene) => {
    const d = decidir(tipo, texto);
    expect(d.tipo).toBe('existente');
    if (d.tipo !== 'existente') return;
    expect(d.productoId).toBe(productoId);
    expect(descripcionDe(d.presentacionId)).toContain(contiene);
  });

  it('manda a revision un corte que no dice el animal ("FILETE": res o pechuga de pollo)', () => {
    expect(decidir('FILETE', 'FILETE, S/M, 1 KG. GRANEL.')).toEqual({ tipo: 'externo', motivo: MOTIVOS_CORTE.ambiguo });
  });

  it('respeta la marca: un pollo entero de otra marca no se asigna al de Bachoco', () => {
    expect(decidir('ENTERO', "ENTERO, PILGRIM`S, 1 KG. GRANEL. ENTERO")).toEqual({ tipo: 'externo', motivo: MOTIVOS.marca });
  });

  it('respeta la cantidad', () => {
    expect(decidir('HIGADO', 'HIGADO, SUKARNE, PAQUETE 250 GR. HÍGADO REBANADO')).toEqual({
      tipo: 'externo', motivo: MOTIVOS_CORTE.sinPresentacion,
    });
  });
});

describe('configuracion cortesQQP', () => {
  it('reconoce los tipos listados y no confunde medicamentos con cortes', () => {
    expect(esCorte('BISTEC DEL 7')).toBe(true);
    expect(esCorte('Pierna Entera/Pernil')).toBe(true);
    expect(esCorte('ENTEROGERMINA')).toBe(false);
  });

  it('señala tipos que parecen cortes nuevos', () => {
    expect(pareceCorteNuevo('BISTEC DE AGUAYON')).toBe(true);
    expect(pareceCorteNuevo('BISTEC DEL 7')).toBe(false);
    expect(pareceCorteNuevo('ARROZ')).toBe(false);
    expect(pareceCorteNuevo('ENTEROGERMINA')).toBe(false);
  });

  it('apunta a productos de la canasta', () => {
    expect(CORTES.productos).toEqual(['Carne Res', 'Carne Cerdo', 'Carne Pollo']);
  });
});
