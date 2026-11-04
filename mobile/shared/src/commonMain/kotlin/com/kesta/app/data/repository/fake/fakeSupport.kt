package com.kesta.app.data.repository.fake

import kotlinx.coroutines.delay
import kotlin.math.round

/**
 * Comportamiento común de todos los Fakes:
 *  - [retrasoMs] > 0 simula una respuesta lenta (permite ver el estado "cargando").
 *  - [fallo] != null hace que la operación falle (permite ver el estado "error").
 */
internal suspend fun <T> respuestaSimulada(
    retrasoMs: Long,
    fallo: Throwable?,
    obtener: () -> Result<T>,
): Result<T> {
    if (retrasoMs > 0) delay(retrasoMs)
    if (fallo != null) return Result.failure(fallo)
    return obtener()
}

/** Redondea a dos decimales, igual que el backend. */
internal fun redondear(valor: Double): Double = round(valor * 100) / 100
