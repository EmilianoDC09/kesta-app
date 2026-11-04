package com.kesta.app.domain.model

/** Una forma concreta de comprar un producto, por ejemplo "La Costeña 1L". */
data class Presentacion(
    val id: Int,
    val marca: String,
    val cantidad: Double,
    val unidad: String,
    /** Nombre del producto al que pertenece; sirve para mostrar "Aceite vegetal La Costeña 1L". */
    val producto: String = "",
)
