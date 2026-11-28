import { PoolClient } from 'pg';
import { RegistroProfeco, normalizarTexto } from './transformar';
import { obtenerProductoCanonico, perteneceCanasta } from './canasta';
import { normalizarPresentacion } from './unidades';

export type ResultadoMapeo =
  | {
      vinculado: true;
      productoId: number;
      presentacionId: number;
      creada?: boolean;
    }
  | {
      vinculado: false;
      motivo: string;
    };

function textoSQL(columna: string): string {
  return `
    LOWER(
      unaccent(
        TRIM(
          regexp_replace(
            ${columna},
            '[[:space:]]+',
            ' ',
            'g'
          )
        )
      )
    )
  `;
}

export async function mapearProducto(
  client: PoolClient,
  registro: RegistroProfeco
): Promise<ResultadoMapeo> {
  // Solo registros del CSV de datos abiertos. El buscador QQP tiene su propio emparejamiento en ./qqp-api.
  const canonico = obtenerProductoCanonico(registro.producto);

  if (!canonico) {
    return {
      vinculado: false,
      motivo: 'Producto fuera del mapeo de canasta'
    };
  }

  if (!perteneceCanasta(registro.producto, registro.catalogo)) {
    return {
      vinculado: false,
      motivo: 'Catalogo de Profeco fuera de seleccion'
    };
  }

  const producto = normalizarTexto(canonico);

  const marca = normalizarTexto(registro.marca);

  const descripcionOriginal = registro.presentacion.trim();

  const descripcion = normalizarTexto(descripcionOriginal);

  const unidad = normalizarPresentacion(registro.presentacion);

  if (!unidad) {
    return {
      vinculado: false,
      motivo: 'Presentacion pendiente de normalizacion'
    };
  }

  if (!marca || !descripcion) {
    return {
      vinculado: false,
      motivo: 'Marca o descripcion incompleta'
    };
  }

  const productos = await client.query(
    `
      SELECT id
      FROM productos
      WHERE ${textoSQL('nombre')} = $1
    `,
    [producto]
  );

  if (productos.rows.length !== 1) {
    return {
      vinculado: false,
      motivo:
        productos.rows.length === 0
          ? 'Producto no registrado en Kesta'
          : 'Producto ambiguo en Kesta'
    };
  }

  const productoId: number = productos.rows[0].id;

  const marcas = await client.query(
    `
      SELECT id
      FROM marcas
      WHERE ${textoSQL('nombre')} = $1
    `,
    [marca]
  );

  if (marcas.rows.length !== 1) {
    return {
      vinculado: false,
      motivo:
        marcas.rows.length === 0
          ? 'Marca no registrada en Kesta'
          : 'Marca ambigua en Kesta'
    };
  }

  const marcaId: number = marcas.rows[0].id;

  await client.query(
    `
      SELECT pg_advisory_xact_lock(
        $1::integer,
        $2::integer
      )
    `,
    [productoId, marcaId]
  );

  const candidatas = await client.query(
    `
      SELECT
        pr.id,
        pr.descripcion
      FROM presentaciones pr
      INNER JOIN unidades u
        ON u.id = pr.unidad_id
      WHERE pr.producto_id = $1
        AND pr.marca_id = $2
        AND (
          CASE
            WHEN LOWER(u.abreviatura) = 'kg'
              THEN pr.cantidad * 1000
            WHEN LOWER(u.abreviatura) = 'l'
              THEN pr.cantidad * 1000
            ELSE pr.cantidad
          END
        ) = $3
        AND (
          CASE
            WHEN LOWER(u.abreviatura) = 'kg'
              THEN 'g'
            WHEN LOWER(u.abreviatura) = 'l'
              THEN 'ml'
            ELSE LOWER(u.abreviatura)
          END
        ) = $4
      ORDER BY pr.id
    `,
    [
      productoId,
      marcaId,
      unidad.cantidad,
      unidad.unidad
    ]
  );

  const exactas = candidatas.rows.filter(
    fila =>
      normalizarTexto(fila.descripcion) === descripcion
  );

  if (exactas.length > 1) {
    return {
      vinculado: false,
      motivo: 'Multiples coincidencias en el catalogo'
    };
  }

  if (exactas.length === 1) {
    return {
      vinculado: true,
      productoId,
      presentacionId: exactas[0].id,
      creada: false
    };
  }

  const asociacion = await client.query(
    `
      SELECT id
      FROM presentaciones
      WHERE producto_id = $1
        AND marca_id = $2
      LIMIT 1
    `,
    [productoId, marcaId]
  );

  if (asociacion.rows.length === 0) {
    return {
      vinculado: false,
      motivo: 'Marca sin asociacion previa con el producto'
    };
  }

  const unidades = await client.query(
    `
      SELECT id
      FROM unidades
      WHERE LOWER(TRIM(abreviatura)) = $1
    `,
    [unidad.unidad]
  );

  if (unidades.rows.length !== 1) {
    return {
      vinculado: false,
      motivo:
        unidades.rows.length === 0
          ? 'Unidad no registrada en Kesta'
          : 'Unidad ambigua en Kesta'
    };
  }

  const unidadId: number = unidades.rows[0].id;

  if (
    !Number.isFinite(unidad.cantidad) ||
    unidad.cantidad <= 0 ||
    unidad.cantidad > 99999999.99 ||
    Math.abs(
      unidad.cantidad * 100 -
      Math.round(unidad.cantidad * 100)
    ) > 0.000001
  ) {
    return {
      vinculado: false,
      motivo: 'Cantidad incompatible con el catalogo'
    };
  }

  const nueva = await client.query(
    `
      INSERT INTO presentaciones (
        producto_id,
        marca_id,
        cantidad,
        unidad_id,
        descripcion
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [
      productoId,
      marcaId,
      unidad.cantidad,
      unidadId,
      descripcionOriginal
    ]
  );

  return {
    vinculado: true,
    productoId,
    presentacionId: nueva.rows[0].id,
    creada: true
  };
}