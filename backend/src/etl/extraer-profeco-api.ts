import type { RegistroProfeco } from './transformar';
import { adaptarProductoProfeco } from './adaptar-profeco-api';

const URL_PROFECO = 'https://qqp.profeco.gob.mx/api/precios';
const CLAVE_CIUDAD = '1601';

// Productos que queremos consultar en Morelia.
// Puedes agregar nuevas búsquedas sin cambiar el extractor.
export const BUSQUEDAS_CANASTA = [
  'tortilla',
  'leche',
  'huevo',
  'frijol',
  'arroz',
  'aceite',
  'azucar',
  'pan blanco',
  'pasta para sopa',
  'atun',
  'sardina',
  'jitomate',
  'cebolla',
  'chile jalapeño',
  'limon',
  'manzana',
  'platano',
  'papa',
  'zanahoria',
  'pollo',
  'carne de res',
  'carne de cerdo',
  'papel higienico',
  'jabon de tocador'
];

interface ProductoAPI {
  producto?: string;
  tipo_producto?: string;
  precio?: number;
  fecha_observacion?: string;
  cadena_comercial?: string;
  establecimiento?: string;
  direccion?: string;
  municipio?: string;
  entidad?: string;
}

interface RespuestaAPI {
  success?: boolean;
  data?: {
    productos?: ProductoAPI[];
  };
}

export interface ResultadoExtraccion {
  registros: RegistroProfeco[];
  consultasExitosas: string[];
  consultasFallidas: {
    busqueda: string;
    error: string;
  }[];
}

const esperar = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

async function consultarProfeco(
  busqueda: string
): Promise<ProductoAPI[]> {
  const url = new URL(URL_PROFECO);

  url.searchParams.set('clave_ciudad', CLAVE_CIUDAD);
  url.searchParams.set('busqueda', busqueda);

  const maxIntentos = 5;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const respuesta = await fetch(url.toString(), {
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: 'application/json'
        }
      });

      if (
        (respuesta.status === 429 ||
          respuesta.status >= 500) &&
        intento < maxIntentos
      ) {
        await esperar(5000 * intento);
        continue;
      }

      if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}`);
      }

      const datos = (await respuesta.json()) as RespuestaAPI;

      if (
        datos.success !== true ||
        !Array.isArray(datos.data?.productos)
      ) {
        throw new Error('Respuesta inesperada de Profeco');
      }

      return datos.data.productos;
    } catch (error) {
      const reintentable =
        error instanceof TypeError ||
        (error instanceof Error &&
          (error.name === 'TimeoutError' ||
            error.name === 'AbortError'));

      if (!reintentable || intento === maxIntentos) {
        throw error;
      }

      await esperar(5000 * intento);
    }
  }

  throw new Error('No fue posible consultar Profeco');
}

function convertirRegistro(item: ProductoAPI): RegistroProfeco {
  const adaptado = adaptarProductoProfeco(
    item.producto ?? ''
);

  return {
    archivo_origen: 'Profeco QQP API',
    producto: item.producto ?? '',
    presentacion: adaptado.presentacion ?? '',
    marca: adaptado.marca ?? '',
    categoria: item.tipo_producto ?? '',
    catalogo: 'API_PROFECO',
    precio: String(item.precio ?? ''),
    fecha_registro: item.fecha_observacion ?? '',
    cadena_comercial: item.cadena_comercial ?? '',
    giro: '',
    nombre_comercial: item.establecimiento ?? '',
    direccion: item.direccion ?? '',
    estado: item.entidad ?? '',
    municipio: item.municipio ?? '',
    latitud: '',
    longitud: ''
  };
}

// Conservamos la función original para mantener compatibilidad.
export async function extraerPreciosProfeco(
  busqueda: string = 'leche'
): Promise<RegistroProfeco[]> {
  const termino = busqueda.trim();

  if (!termino) {
    throw new Error('Debes indicar un producto para buscar');
  }

  const productos = await consultarProfeco(termino);

  return productos.map(convertirRegistro);
}

// Nueva función para consultar múltiples productos.
export async function extraerCanastaProfeco(
  busquedas: string[] = BUSQUEDAS_CANASTA
): Promise<ResultadoExtraccion> {
  const registros: RegistroProfeco[] = [];
  const consultasExitosas: string[] = [];
  const consultasFallidas: ResultadoExtraccion[
    'consultasFallidas'
  ] = [];

  const terminos = [
    ...new Set(
      busquedas.map(busqueda => busqueda.trim()).filter(Boolean)
    )
  ];

  const clavesEncontradas = new Set<string>();

  for (const busqueda of terminos) {
    try {
      const productos = await extraerPreciosProfeco(busqueda);

      for (const producto of productos) {
        const clave = JSON.stringify([
          producto.producto,
          producto.precio,
          producto.fecha_registro,
          producto.nombre_comercial,
          producto.direccion
        ]);

        if (clavesEncontradas.has(clave)) {
          continue;
        }

        clavesEncontradas.add(clave);
        registros.push(producto);
      }

      consultasExitosas.push(busqueda);
    } catch (error) {
      consultasFallidas.push({
        busqueda,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      });
    }

    // Espaciamos las solicitudes para evitar saturar el servicio.
    await esperar(5000);
  }

  return {
    registros,
    consultasExitosas,
    consultasFallidas
  };
}