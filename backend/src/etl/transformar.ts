export interface RegistroProfeco {
  archivo_origen: string;
  producto: string;
  presentacion: string;
  marca: string;
  categoria: string;
  catalogo: string;
  precio: string;
  fecha_registro: string;
  cadena_comercial: string;
  giro: string;
  nombre_comercial: string;
  direccion: string;
  estado: string;
  municipio: string;
  latitud: string;
  longitud: string;
}

// Normaliza texto para comparar productos y marcas.
export function normalizarTexto(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Valida y conserva la fecha original de Profeco.
export function normalizarFecha(fecha: string): string | null {
  const valor = fecha.trim().replace(/\//g, '-');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return null;
  }

  const fechaValidada = new Date(`${valor}T00:00:00Z`);

  if (Number.isNaN(fechaValidada.getTime())) {
    return null;
  }

  return fechaValidada.toISOString().slice(0, 10) === valor
    ? valor
    : null;
}

// Convierte valores numericos sin inventar datos.
function numero(valor: string): number | null {
  if (!valor || !valor.trim()) {
    return null;
  }

  const resultado = Number(valor);

  return Number.isFinite(resultado) ? resultado : null;
}

// Transforma un registro de Profeco.
export function transformarRegistro(registro: RegistroProfeco) {
  const producto = normalizarTexto(registro.producto);
  const marca = normalizarTexto(registro.marca);
  const precio = numero(registro.precio);
  const fecha = normalizarFecha(registro.fecha_registro);
  const municipio = normalizarTexto(registro.municipio);

  const latitud = numero(registro.latitud);
  const longitud = numero(registro.longitud);

  if (municipio !== 'morelia') {
    return { valido: false as const, motivo: 'Fuera de ciudad piloto' };
  }

  if (!producto) {
    return { valido: false as const, motivo: 'Producto vacio' };
  }

  if (precio === null || precio <= 0) {
    return { valido: false as const, motivo: 'Precio invalido' };
  }

  if (!fecha) {
    return { valido: false as const, motivo: 'Fecha invalida' };
  }

  const coordenadasValidas =
    latitud !== null &&
    longitud !== null &&
    latitud >= -90 &&
    latitud <= 90 &&
    longitud >= -180 &&
    longitud <= 180;

  return {
    valido: true as const,
    datos: {
      producto,
      marca,
      presentacion: normalizarTexto(registro.presentacion),
      categoria: normalizarTexto(registro.categoria),
      precio,
      fecha,
      comercio: normalizarTexto(registro.cadena_comercial),
      sucursal: registro.nombre_comercial.trim(),
      direccion: registro.direccion.trim(),
      municipio,
      estado: normalizarTexto(registro.estado),
      latitud: coordenadasValidas ? latitud : null,
      longitud: coordenadasValidas ? longitud : null,
      fuente: 'Profeco',
      original: registro
    }
  };
}