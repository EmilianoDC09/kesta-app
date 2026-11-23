package com.kesta.app.data.catalog

/** Clasificación general de productos  */
data class Categoria(
    val id: Int,
    val nombre: String,
)

/** Variante de un producto */
data class Presentacion(
    val id: Int,
    val marca: String,
    val cantidad: Double,
    val unidad: String,
) {
    /** Texto listo para mostrar: "Alpura · 1 L". */
    val etiqueta: String
        get() {
            val cant = if (cantidad % 1.0 == 0.0) cantidad.toInt().toString() else cantidad.toString()
            return "$marca · $cant $unidad"
        }
}

/** Artículo comparable de la canasta básica. */
data class Producto(
    val id: Int,
    val nombre: String,
    val categoria: Categoria,
    val presentaciones: List<Presentacion>,
)