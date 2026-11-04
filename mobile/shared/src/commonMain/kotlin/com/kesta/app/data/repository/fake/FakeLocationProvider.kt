package com.kesta.app.data.repository.fake

import com.kesta.app.core.location.LocationProvider
import com.kesta.app.domain.model.Ubicacion

/** GPS de prueba, el cual siempre "estás" en el centro de Morelia*/
class FakeLocationProvider(
    private val ubicacion: Ubicacion = FakeData.centroMorelia,
    private val fallo: Throwable? = null,
    private val retrasoMs: Long = 0,
) : LocationProvider {

    override suspend fun ubicacionActual(): Result<Ubicacion> =
        respuestaSimulada(retrasoMs, fallo) { Result.success(ubicacion) }
}