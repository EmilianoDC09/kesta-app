package com.kesta.app.domain.model

data class CanastaItem(
    val id: Int,
    val presentacion: Presentacion,
    val cantidad: Double,
    /** Precio de referencia por unidad; null si todavía no hay precio conocido. */
    val precioReferencia: Double?,
)

data class Canasta(
    val id: Int,
    val nombre: String,
    val items: List<CanastaItem>,
)
