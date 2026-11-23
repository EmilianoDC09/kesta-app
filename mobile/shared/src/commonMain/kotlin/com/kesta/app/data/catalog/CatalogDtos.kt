package com.kesta.app.data.catalog

import kotlinx.serialization.Serializable

/*
 * Respuestas del servidor para el catálogo (CAT-02 y CAT-03), tal como las manda.
 * Son internas a la capa de datos: el resto de la app solo conoce Categoria, Presentacion y Producto.
 */
@Serializable
internal data class CategoriaDto(
    // Un producto sin categoría llega como {"id": null, "nombre": null}.
    val id: Int? = null,
    val nombre: String? = null,
)

@Serializable
internal data class CategoriasRespuestaDto(
    val datos: List<CategoriaDto> = emptyList(),
)

@Serializable
internal data class MarcaDto(
    val id: Int,
    val nombre: String,
)

@Serializable
internal data class PresentacionDto(
    val id: Int,
    val marca: MarcaDto,
    val cantidad: Double,
    /** Abreviatura: "kg", "L", "pza". */
    val unidad: String,
)

@Serializable
internal data class ProductoDto(
    val id: Int,
    val nombre: String,
    val categoria: CategoriaDto? = null,
    val presentaciones: List<PresentacionDto> = emptyList(),
)

@Serializable
internal data class ProductosRespuestaDto(
    val datos: List<ProductoDto> = emptyList(),
    val pagina: Int = 1,
    val limite: Int = 20,
    val total: Int = 0,
)

internal fun CategoriaDto.aCategoria() = Categoria(
    id = id ?: 0,
    nombre = nombre ?: "Sin categoría",
)

internal fun PresentacionDto.aPresentacion() = Presentacion(
    id = id,
    marca = marca.nombre,
    cantidad = cantidad,
    unidad = unidad,
)

internal fun ProductoDto.aProducto() = Producto(
    id = id,
    nombre = nombre,
    categoria = (categoria ?: CategoriaDto()).aCategoria(),
    presentaciones = presentaciones.map { it.aPresentacion() },
)