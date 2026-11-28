/**
 * Sincronizacion diaria de precios con el buscador QQP de Profeco (qqp.profeco.gob.mx).
 *
 *   npx tsx src/etl/qqp-api/sincronizar.ts                       simulacion: consulta, empareja y deshace
 *   npx tsx src/etl/qqp-api/sincronizar.ts --aplicar             carga real
 *   ... --desde-respaldo datos/qqp-api/qqp_1601_<fecha>.json     reprocesa un respaldo sin consultar Profeco
 *   ... --terminos "huevo,arroz"                                 solo esos terminos (pruebas)
 *   ... --sin-geocodificar                                       no llama a Google para sucursales sin punto
 *
 * Codigo de salida: 0 si todo salio bien; 1 si fallo o si la carga fue parcial (alguna busqueda fallo).
 * Un programador de tareas (cron, GitHub Actions) puede alertar con ese codigo.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { PoolClient } from 'pg';
import { pool } from '../../db';
import { coordenadasDeDireccion } from '../../services/geocodificacion';
import { obtenerProductoCanonico } from '../canasta';
import { normalizarTexto } from '../transformar';
import { ObservacionQQP } from './cliente';
import { CONFIG_QQP } from './config';
import { CORTES, esCorte, pareceCorteNuevo } from './cortes';
import { CandidatoCorte, decidirCorte, decidirPresentacion, decidirUbicacion, PresentacionCatalogo, UbicacionExistente } from './emparejar';
import { evaluarExtraccion, Extraccion, extraer, guardarRespaldo, leerRespaldo } from './extraccion';
import { claveObservacion, validarObservacion } from './observacion';
import * as repo from './repositorio';
import { terminosBusqueda } from './terminos';
import { direccionCompleta, quitarTipo, separarMarca } from './texto';

/** Mismo candado que src/etl/cargar-profeco.ts: las cargas de Profeco (CSV o API) nunca corren a la vez. */
const CANDADO_PROFECO = 51001;

interface Opciones {
  aplicar: boolean;
  respaldo: string | null;
  terminos: string[] | null;
  geocodificar: boolean;
  ignorarLegado: boolean;
}

function leerOpciones(argv: string[]): Opciones {
  const valor = (flag: string) => {
    const i = argv.indexOf(flag);
    if (i === -1) return null;
    const v = argv[i + 1];
    if (!v || v.startsWith('--')) throw new Error(`Falta el valor de ${flag}`);
    return v;
  };
  const terminos = valor('--terminos');
  return {
    aplicar: argv.includes('--aplicar'),
    respaldo: valor('--desde-respaldo'),
    terminos: terminos ? terminos.split(',').map(normalizarTexto).filter(Boolean) : null,
    geocodificar: !argv.includes('--sin-geocodificar'),
    ignorarLegado: argv.includes('--ignorar-legado'),
  };
}

interface Contadores {
  leidas: number;
  cargadas: number;
  duplicadas: number;
  sin_vincular: number;
  descartadas: number;
}

interface Resumen {
  contadores: Contadores;
  motivos: Record<string, number>;
  /** Observaciones que ya estaban en productos_externos y siguen sin vincular (cuentan como duplicadas). */
  pendientes: Record<string, number>;
  fueraDeCanasta: number;
  cortesCargados: number;
  tiposNuevosDeCarne: string[];
  presentacionesCreadas: number;
  ubicacionesCreadas: number;
  ubicacionesGeocodificadas: number;
  preciosSinPunto: number;
}

async function cargar(client: PoolClient, e: Extraccion, ejecucionId: number, o: Opciones): Promise<Resumen> {
  const c: Contadores = { leidas: 0, cargadas: 0, duplicadas: 0, sin_vincular: 0, descartadas: 0 };
  const motivos = new Map<string, number>();
  const contar = (m: string) => motivos.set(m, (motivos.get(m) ?? 0) + 1);
  const pendientes = new Map<string, number>();
  let fueraDeCanasta = 0;
  let cortesCargados = 0;
  const tiposNuevosDeCarne = new Set<string>();
  let presentacionesCreadas = 0;
  let ubicacionesCreadas = 0;
  let ubicacionesGeocodificadas = 0;
  let preciosSinPunto = 0;

  const fuenteId = await repo.obtenerFuenteProfeco(client);
  const marcas = await repo.cargarMarcas(client);
  const productos = await repo.cargarProductos(client);
  const cachePresentaciones = new Map<number, PresentacionCatalogo[]>();
  const cacheComercios = new Map<string, number[]>();
  const cacheUbicaciones = new Map<number, UbicacionExistente[]>();
  const cachePuntos = new Map<string, { lat: number; lng: number } | null>();
  const vistas = new Set<string>();

  const presentacionesDe = async (productoId: number) => {
    if (!cachePresentaciones.has(productoId)) {
      cachePresentaciones.set(productoId, await repo.presentacionesDeProducto(client, productoId));
    }
    return cachePresentaciones.get(productoId)!;
  };
  let cacheCandidatos: CandidatoCorte[] | null = null;
  const candidatosCorte = async (): Promise<CandidatoCorte[]> => {
    if (!cacheCandidatos) {
      cacheCandidatos = [];
      for (const nombre of CORTES.productos) {
        const ids = productos.get(normalizarTexto(nombre)) ?? [];
        if (ids.length === 1) {
          cacheCandidatos.push({ productoId: ids[0], productoNombre: nombre, presentaciones: await presentacionesDe(ids[0]) });
        }
      }
    }
    return cacheCandidatos;
  };

  const geocodificar = async (direccion: string) => {
    if (!o.geocodificar) return null;
    if (!cachePuntos.has(direccion)) {
      cachePuntos.set(
        direccion,
        await coordenadasDeDireccion(direccion, {
          ciudad: CONFIG_QQP.ciudad.nombre,
          estado: CONFIG_QQP.ciudad.estado,
          centro: CONFIG_QQP.ciudad.centro,
          radioKm: CONFIG_QQP.radioGeocodificacionKm,
        })
      );
    }
    return cachePuntos.get(direccion)!;
  };

  // Un descarte ya registrado en otra ejecucion cuenta como duplicado: no se acumula cada dia.
  const descartar = async (clave: string, motivo: string, original: unknown) => {
    if (await repo.existeDescarte(client, clave)) {
      c.duplicadas++;
      return;
    }
    c.descartadas++;
    contar(motivo);
    await repo.guardarDescarte(client, { ejecucionId, clave, motivo, original });
  };

  // Formato inesperado: cuentan como leidas y descartadas para que el problema sea visible en la ejecucion.
  for (const inv of e.invalidas) {
    c.leidas++;
    const clave = createHash('sha256').update(JSON.stringify(['qqp-api-invalida', inv.dato])).digest('hex');
    await descartar(clave, `Formato inesperado de Profeco: ${inv.error}`, inv.dato);
  }

  for (const obs of e.observaciones) {
    // El buscador compara por prefijo: "pan" tambien trae PANTALLAS. Ese ruido no se registra.
    const canonico = obtenerProductoCanonico(obs.tipo_producto);
    const corte = !canonico && esCorte(obs.tipo_producto);
    if (!canonico && !corte) {
      fueraDeCanasta++;
      if (pareceCorteNuevo(obs.tipo_producto)) tiposNuevosDeCarne.add(obs.tipo_producto);
      continue;
    }
    c.leidas++;
    const clave = claveObservacion(obs);

    const v = validarObservacion(obs);
    if (!v.valida) {
      await descartar(clave, v.motivo, obs);
      continue;
    }

    // Un mismo producto puede llegar por dos terminos; o ya estar cargado de una ejecucion anterior.
    if (vistas.has(clave) || (await repo.existePrecio(client, clave))) {
      vistas.add(clave);
      c.duplicadas++;
      continue;
    }
    vistas.add(clave);

    const resto = quitarTipo(obs.producto, obs.tipo_producto);
    const externo = async (motivo: string) => {
      const sep = resto ? separarMarca(resto, marcas) : null;
      const nuevo = await repo.guardarExterno(client, {
        ejecucionId,
        fuenteId,
        clave,
        tipo: obs.tipo_producto,
        textoMarca: sep?.textoMarca ?? null,
        resto,
        precio: obs.precio,
        fecha: v.fecha,
        comercio: obs.cadena_comercial,
        sucursal: obs.establecimiento,
        direccion: direccionCompleta(obs.direccion, obs.colonia, obs.cp),
        motivo,
        original: obs,
      });
      if (nuevo) {
        c.sin_vincular++;
        contar(motivo);
      } else {
        c.duplicadas++;
        pendientes.set(motivo, (pendientes.get(motivo) ?? 0) + 1);
      }
    };

    // 1-2. Producto y presentacion
    if (!resto) {
      await externo('Descripcion incompleta');
      continue;
    }
    let presentacionId: number;
    if (corte) {
      const candidatos = await candidatosCorte();
      if (candidatos.length === 0) {
        await externo('Producto no registrado en Kesta');
        continue;
      }
      const d = decidirCorte(obs.tipo_producto, resto, candidatos, marcas);
      if (d.tipo === 'externo') {
        await externo(d.motivo);
        continue;
      }
      presentacionId = d.presentacionId;
    } else {
      const ids = productos.get(normalizarTexto(canonico!)) ?? [];
      if (ids.length !== 1) {
        await externo(ids.length === 0 ? 'Producto no registrado en Kesta' : 'Producto ambiguo en Kesta');
        continue;
      }
      const productoId = ids[0];
      const presentaciones = await presentacionesDe(productoId);
      const d = decidirPresentacion(resto, presentaciones, marcas, canonico!);
      if (d.tipo === 'externo') {
        await externo(d.motivo);
        continue;
      } else if (d.tipo === 'crear') {
        const id = await repo.crearPresentacion(client, productoId, d, ejecucionId);
        if (id === null) {
          await externo('Unidad no registrada en Kesta');
          continue;
        }
        presentacionId = id;
        presentacionesCreadas++;
        const marca = marcas.find((m) => m.id === d.marcaId)!;
        presentaciones.push({ id, marcaId: d.marcaId, marcaNombre: marca.nombre, descripcion: d.descripcion, cantidad: d.cantidad, unidad: d.unidad });
      } else {
        presentacionId = d.presentacionId;
      }
    }

    // 3. Comercio
    const nombreComercio = obs.cadena_comercial.trim() || obs.establecimiento.trim();
    if (!nombreComercio) {
      await descartar(clave, 'Comercio sin nombre', obs);
      continue;
    }
    const claveComercio = normalizarTexto(nombreComercio);
    if (!cacheComercios.has(claveComercio)) cacheComercios.set(claveComercio, await repo.buscarComercio(client, nombreComercio));
    let comercios = cacheComercios.get(claveComercio)!;
    if (comercios.length > 1) {
      await externo('Comercio ambiguo en Kesta');
      continue;
    }
    if (comercios.length === 0) {
      comercios = [await repo.crearComercio(client, nombreComercio)];
      cacheComercios.set(claveComercio, comercios);
    }
    const comercioId = comercios[0];

    // 4. Sucursal (ubicacion)
    if (!obs.direccion.trim()) {
      await externo('Sucursal sin direccion');
      continue;
    }
    if (!cacheUbicaciones.has(comercioId)) cacheUbicaciones.set(comercioId, await repo.ubicacionesDeComercio(client, comercioId));
    const ubicaciones = cacheUbicaciones.get(comercioId)!;
    const u = decidirUbicacion({ direccion: obs.direccion, cp: obs.cp }, ubicaciones);
    let ubicacionId: number;
    let conPunto: boolean;
    const completa = direccionCompleta(obs.direccion, obs.colonia, obs.cp);
    if (u.tipo === 'ambigua') {
      await externo('Ubicacion ambigua');
      continue;
    } else if (u.tipo === 'nueva') {
      const punto = await geocodificar(completa);
      ubicacionId = await repo.crearUbicacion(client, { comercioId, direccion: completa, referencia: obs.establecimiento.trim(), punto }, ejecucionId);
      conPunto = punto !== null;
      ubicacionesCreadas++;
      if (punto) ubicacionesGeocodificadas++;
      ubicaciones.push({ id: ubicacionId, direccion: completa, tieneCoordenadas: conPunto });
    } else {
      ubicacionId = u.ubicacionId;
      conPunto = u.tieneCoordenadas;
      if (!conPunto) {
        const punto = await geocodificar(completa);
        if (punto) {
          await repo.asignarPunto(client, ubicacionId, punto);
          ubicacionesGeocodificadas++;
          conPunto = true;
          const fila = ubicaciones.find((x) => x.id === ubicacionId);
          if (fila) fila.tieneCoordenadas = true;
        }
      }
    }

    // 5. Precio
    const insertado = await repo.insertarPrecio(client, {
      presentacionId, comercioId, ubicacionId, fuenteId, precio: obs.precio, fecha: v.fecha, clave, ejecucionId,
    });
    if (insertado) {
      c.cargadas++;
      if (corte) cortesCargados++;
      if (!conPunto) preciosSinPunto++;
      await repo.marcarExternoVinculado(client, clave, presentacionId);
    } else {
      c.duplicadas++;
    }
  }

  return {
    contadores: c,
    motivos: Object.fromEntries(motivos),
    pendientes: Object.fromEntries(pendientes),
    fueraDeCanasta,
    cortesCargados,
    tiposNuevosDeCarne: [...tiposNuevosDeCarne].sort(),
    presentacionesCreadas,
    ubicacionesCreadas,
    ubicacionesGeocodificadas,
    preciosSinPunto,
  };
}

export async function sincronizar(o: Opciones): Promise<boolean> {
  const client = await pool.connect();
  let ejecucionId: number | null = null;
  let candado = false;
  let transaccion = false;
  const origen = o.respaldo ? `respaldo:${path.basename(o.respaldo)}` : CONFIG_QQP.origen;

  try {
    const r = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [CANDADO_PROFECO]);
    if (r.rows[0].ok !== true) throw new Error('Ya hay una carga de Profeco en curso (CSV o API)');
    candado = true;

    // La carga anterior por API usaba otra huella: correr encima duplicaria las observaciones que se traslapan.
    const legado = await client.query(
      `SELECT id FROM ejecuciones_ingesta WHERE origen = $1 AND estado = 'completada' ORDER BY id`,
      [CONFIG_QQP.origenLegado]
    );
    if (legado.rows.length > 0 && !o.ignorarLegado) {
      const ids = legado.rows.map((x) => x.id).join(', ');
      throw new Error(
        `Hay cargas del extractor anterior sin revertir (ejecucion ${ids}). ` +
          `Revisalas con: npx tsx src/etl/qqp-api/revertir-ejecucion.ts --id <id> ` +
          `o vuelve a correr con --ignorar-legado si decides conservarlas.`
      );
    }

    if (o.aplicar) {
      // Con el candado tomado, cualquier ejecucion 'en_proceso' quedo colgada (proceso cancelado).
      await client.query(
        `UPDATE ejecuciones_ingesta SET estado = 'fallida', fin = NOW(), error = 'Interrumpida sin cerrar'
         WHERE tipo = 'profeco' AND estado = 'en_proceso'`
      );
      const ej = await client.query(
        `INSERT INTO ejecuciones_ingesta (tipo, origen, estado) VALUES ('profeco', $1, 'en_proceso') RETURNING id`,
        [origen]
      );
      ejecucionId = ej.rows[0].id;
    }

    // Extraccion: fuera de la transaccion, para no retener bloqueos mientras se espera a Profeco.
    let extraccion: Extraccion;
    if (o.respaldo) {
      extraccion = leerRespaldo(path.resolve(process.cwd(), o.respaldo));
      console.log(`Reprocesando respaldo ${o.respaldo} (${extraccion.observaciones.length} observaciones)`);
    } else {
      const terminos = o.terminos ?? terminosBusqueda();
      console.log(`Consultando ${terminos.length} terminos en Profeco QQP (${CONFIG_QQP.ciudad.nombre})...`);
      extraccion = await extraer(terminos, {
        alAvanzar: (t) => console.log(`  ${t.ok ? 'ok   ' : 'FALLO'} ${t.termino}${t.ok ? ` (${t.observaciones})` : `: ${t.error}`}`),
      });
      console.log(`Respaldo guardado en ${guardarRespaldo(extraccion)}`);
    }

    const ev = evaluarExtraccion(extraccion);
    if (!ev.cargar) throw new Error(`Extraccion no confiable: ${ev.problemas.join('; ')}`);

    await client.query('BEGIN');
    transaccion = true;
    if (!o.aplicar) {
      const ej = await client.query(
        `INSERT INTO ejecuciones_ingesta (tipo, origen, estado) VALUES ('profeco', $1, 'en_proceso') RETURNING id`,
        [origen]
      );
      ejecucionId = ej.rows[0].id;
    }

    const resumen = await cargar(client, extraccion, ejecucionId!, o);
    const fallidos = extraccion.terminos.filter((t) => !t.ok);
    const k = resumen.contadores;

    await client.query(
      `UPDATE ejecuciones_ingesta
       SET fin = NOW(), estado = 'completada',
           leidas = $2, cargadas = $3, duplicadas = $4, sin_vincular = $5, descartadas = $6, detalle = $7
       WHERE id = $1`,
      [
        ejecucionId, k.leidas, k.cargadas, k.duplicadas, k.sin_vincular, k.descartadas,
        JSON.stringify({
          motivos: resumen.motivos,
          externos_aun_pendientes: resumen.pendientes,
          terminos_consultados: extraccion.terminos.length,
          terminos_fallidos: fallidos.map((t) => ({ termino: t.termino, error: t.error })),
          fuera_de_canasta: resumen.fueraDeCanasta,
          cortes_de_carne_cargados: resumen.cortesCargados,
          tipos_nuevos_de_carne: resumen.tiposNuevosDeCarne,
          presentaciones_creadas: resumen.presentacionesCreadas,
          ubicaciones_creadas: resumen.ubicacionesCreadas,
          ubicaciones_geocodificadas: resumen.ubicacionesGeocodificadas,
          precios_sin_punto: resumen.preciosSinPunto,
          obtenido_en: extraccion.obtenidoEn,
        }),
      ]
    );

    console.log('\n--- RESULTADOS ---');
    console.table(k);
    console.log('Motivos (registros nuevos sin vincular):');
    console.table(resumen.motivos);
    const nPendientes = Object.values(resumen.pendientes).reduce((a, b) => a + b, 0);
    if (nPendientes > 0) {
      console.log(`Siguen sin vincular desde ejecuciones anteriores (incluidas en duplicadas): ${nPendientes}`);
      console.table(resumen.pendientes);
    }
    console.log(
      `Fuera de la canasta (ruido del buscador): ${resumen.fueraDeCanasta} | presentaciones nuevas: ${resumen.presentacionesCreadas} | ` +
        `sucursales nuevas: ${resumen.ubicacionesCreadas} | geocodificadas: ${resumen.ubicacionesGeocodificadas}`
    );
    console.log(`Carne por corte: ${resumen.cortesCargados} precios cargados`);
    if (resumen.tiposNuevosDeCarne.length > 0) {
      console.warn(
        `AVISO: tipos de carne que no estan en cortesQQP (agregar a mapeo-canasta.json si son cortes): ${resumen.tiposNuevosDeCarne.join(', ')}`
      );
    }
    if (resumen.preciosSinPunto > 0) {
      console.warn(`AVISO: ${resumen.preciosSinPunto} precios quedaron en sucursales sin coordenadas y no aparecen en busquedas cercanas.`);
    }

    if (o.aplicar) {
      await client.query('COMMIT');
      console.log('\nCarga aplicada.');
    } else {
      await client.query('ROLLBACK');
      console.log('\nSimulacion: no se guardo nada. Usa --aplicar para cargar.');
    }
    transaccion = false;

    if (fallidos.length > 0) {
      console.error(`PARCIAL: fallaron ${fallidos.length} busquedas: ${fallidos.map((t) => t.termino).join(', ')}`);
      return false;
    }
    return true;
  } catch (e) {
    if (transaccion) await client.query('ROLLBACK');
    if (o.aplicar && ejecucionId !== null) {
      await client.query(
        `UPDATE ejecuciones_ingesta SET estado = 'fallida', fin = NOW(), error = $2 WHERE id = $1`,
        [ejecucionId, (e as Error).message]
      );
    }
    throw e;
  } finally {
    if (candado) await client.query('SELECT pg_advisory_unlock($1)', [CANDADO_PROFECO]).catch(() => undefined);
    client.release();
  }
}

if (require.main === module) {
  let opciones: Opciones;
  try {
    opciones = leerOpciones(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  sincronizar(opciones)
    .then((ok) => {
      process.exitCode = ok ? 0 : 1;
    })
    .catch((e: Error) => {
      console.error('Error de la sincronizacion QQP:', e.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
