package com.kesta.app.data.repository

import com.kesta.app.domain.model.Canasta
import com.kesta.app.domain.model.OptimizacionCanasta
import com.kesta.app.domain.model.Ubicacion

/** Canastas personalizadas y su optimización  */
interface BasketRepository {
    suspend fun canastas(): Result<List<Canasta>>

    suspend fun canasta(canastaId: Int): Result<Canasta>

    suspend fun crear(nombre: String): Result<Canasta>

    suspend fun agregarProducto(
        canastaId: Int,
        presentacionId: Int,
        cantidad: Double,
    ): Result<Canasta>

    suspend fun cambiarCantidad(
        canastaId: Int,
        itemId: Int,
        cantidad: Double,
    ): Result<Canasta>

    suspend fun quitarProducto(canastaId: Int, itemId: Int): Result<Canasta>

    suspend fun eliminar(canastaId: Int): Result<Unit>

    suspend fun optimizar(
        canastaId: Int,
        centro: Ubicacion,
        radioKm: Int,
        unaSolaTienda: Boolean,
    ): Result<OptimizacionCanasta>
}