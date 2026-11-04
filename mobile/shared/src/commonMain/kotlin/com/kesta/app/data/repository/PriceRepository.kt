package com.kesta.app.data.repository

import com.kesta.app.domain.model.Comparacion
import com.kesta.app.domain.model.Ubicacion

/** Precios y comparación formal vs. informal */
interface PriceRepository {
    suspend fun comparar(
        presentacionId: Int,
        centro: Ubicacion,
        radioKm: Int,
    ): Result<Comparacion>
}
