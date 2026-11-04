package com.kesta.app.domain.model

data class TiendaRecomendada(
    val comercio: String,
    val ubicacionId: Int,
    val canal: Canal,
    val distanciaKm: Double,
    /** Cuánto cuesta comprar aquí, lo que esta tienda ofrece. */
    val subtotal: Double,
)

data class OptimizacionCanasta(
    /** Una tienda, o varias si conviene repartir la compra. */
    val tiendasRecomendadas: List<TiendaRecomendada>,
    val costoTotal: Double,
    /** null si hay menos de dos opciones completas para comparar. */
    val ahorroVsMasCara: Double?,
    /** Id de las presentaciones para las que no hay precio en ninguna tienda. */
    val productosSinPrecio: List<Int>,
)

