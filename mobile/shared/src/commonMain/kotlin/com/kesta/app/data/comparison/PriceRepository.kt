package com.kesta.app.data.comparison

import com.kesta.app.data.location.Location
/**
 * Pregunta de la app: "¿cuánto cuesta esta presentación cerca de mí?".
 * La respuesta ya trae los comercios ordenados por distancia y el resumen de cada canal.
 */
interface PriceRepository {
    suspend fun comparar(
        presentacionId: Int,
        origen: Location,
        radioKm: Int,
    ): Result<Comparacion>
}