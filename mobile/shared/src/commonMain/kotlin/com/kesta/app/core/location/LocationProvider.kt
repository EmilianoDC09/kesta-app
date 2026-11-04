package com.kesta.app.core.location

import com.kesta.app.domain.model.Ubicacion

/**
 * Entrega la ubicación actual del dispositivo.
 * Es una interfaz a propósito: el GPS de Android y el de iOS funcionan distinto,
 * así que el ViewModel solo conoce esta interfaz y nunca el GPS real.
 */
interface LocationProvider {
    suspend fun ubicacionActual(): Result<Ubicacion>
}