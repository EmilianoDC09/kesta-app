import { PrecioCercano, redondear } from './precios';

export interface ItemCanasta {
  presentacionId: number;
  cantidad: number;
  etiqueta: string;
}

export interface Tienda {
  ubicacionId: number;
  comercio: string;
  canal: string;
  direccion: string | null;
  distanciaKm: number;
}

interface Linea {
  presentacionId: number;
  etiqueta: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  ubicacionId: number;
}

const tiendaDe = (p: PrecioCercano): Tienda => ({
  ubicacionId: p.ubicacion_id,
  comercio: p.comercio,
  canal: p.canal.toLowerCase(),
  direccion: p.direccion,
  distanciaKm: redondear(p.distancia_km),
});

/** ubicacionId -> presentacionId -> precio (ya vienen como el vigente por ubicacion). */
function indexar(filas: PrecioCercano[]) {
  const tiendas = new Map<number, Tienda>();
  const precios = new Map<number, Map<number, number>>();
  for (const f of filas) {
    tiendas.set(f.ubicacion_id, tiendaDe(f));
    if (!precios.has(f.ubicacion_id)) precios.set(f.ubicacion_id, new Map());
    precios.get(f.ubicacion_id)!.set(f.presentacion_id, f.precio);
  }
  return { tiendas, precios };
}

export function optimizarUnaTienda(items: ItemCanasta[], filas: PrecioCercano[]) {
  const { tiendas, precios } = indexar(filas);
  const opciones = [...tiendas.entries()].map(([ubicacionId, tienda]) => {
    const mapa = precios.get(ubicacionId)!;
    const desglose: Linea[] = [];
    const sinPrecio: number[] = [];
    for (const it of items) {
      const pu = mapa.get(it.presentacionId);
      if (pu === undefined) sinPrecio.push(it.presentacionId);
      else desglose.push({ presentacionId: it.presentacionId, etiqueta: it.etiqueta, cantidad: it.cantidad, precioUnitario: pu, subtotal: redondear(pu * it.cantidad), ubicacionId });
    }
    return { tienda, total: redondear(desglose.reduce((s, l) => s + l.subtotal, 0)), completa: sinPrecio.length === 0, productosSinPrecio: sinPrecio, desglose };
  });
  // Primero las canastas completas; entre ellas, la mas barata. Una canasta incompleta nunca gana por ser "mas barata".
  opciones.sort((a, b) => Number(b.completa) - Number(a.completa) || a.productosSinPrecio.length - b.productosSinPrecio.length || a.total - b.total);
  const completas = opciones.filter((o) => o.completa);
  const ahorro = completas.length >= 2 ? redondear(completas[completas.length - 1].total - completas[0].total) : null;
  return {
    opciones: opciones.slice(0, 5),
    totalOpciones: opciones.length,
    mejorOpcion: opciones[0] ?? null,
    ahorroVsOpcionMasCara: ahorro,
    totalOpcionMasCara: completas.length ? completas[completas.length - 1].total : null,
  };
}

function combinaciones<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [h, ...t] = arr;
  return [...combinaciones(t, k - 1).map((c) => [h, ...c]), ...combinaciones(t, k)];
}

export function optimizarMultiTienda(items: ItemCanasta[], filas: PrecioCercano[], maxTiendas: number) {
  const { tiendas, precios } = indexar(filas);
  // Candidatas: las 3 ubicaciones mas baratas de cada producto (acota la busqueda a un tamano manejable).
  const candidatas = new Set<number>();
  for (const it of items) {
    [...precios.entries()]
      .filter(([, m]) => m.has(it.presentacionId))
      .sort((a, b) => a[1].get(it.presentacionId)! - b[1].get(it.presentacionId)!)
      .slice(0, 3)
      .forEach(([u]) => candidatas.add(u));
  }
  const lista = [...candidatas].slice(0, 12);

  let mejor: { subset: number[]; lineas: Linea[]; sinPrecio: number[]; total: number } | null = null;
  for (let k = 1; k <= Math.min(maxTiendas, lista.length); k++) {
    for (const subset of combinaciones(lista, k)) {
      const lineas: Linea[] = [];
      const sinPrecio: number[] = [];
      for (const it of items) {
        let best: { u: number; p: number } | null = null;
        for (const u of subset) {
          const p = precios.get(u)!.get(it.presentacionId);
          if (p !== undefined && (!best || p < best.p)) best = { u, p };
        }
        if (!best) sinPrecio.push(it.presentacionId);
        else lineas.push({ presentacionId: it.presentacionId, etiqueta: it.etiqueta, cantidad: it.cantidad, precioUnitario: best.p, subtotal: redondear(best.p * it.cantidad), ubicacionId: best.u });
      }
      const total = redondear(lineas.reduce((s, l) => s + l.subtotal, 0));
      const mejorAct = mejor;
      const gana = !mejorAct || sinPrecio.length < mejorAct.sinPrecio.length || (sinPrecio.length === mejorAct.sinPrecio.length && total < mejorAct.total - 0.001);
      if (gana) mejor = { subset, lineas, sinPrecio, total };
    }
  }
  if (!mejor) return { tiendas: [], total: 0, completa: false, productosSinPrecio: items.map((i) => i.presentacionId), asignacion: [] };
  const usadas = [...new Set(mejor.lineas.map((l) => l.ubicacionId))];
  return {
    tiendas: usadas.map((u) => tiendas.get(u)!),
    total: mejor.total,
    completa: mejor.sinPrecio.length === 0,
    productosSinPrecio: mejor.sinPrecio,
    asignacion: mejor.lineas,
  };
}
