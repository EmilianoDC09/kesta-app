package com.kesta.app.data.comparison

import com.kesta.app.core.error.AppError
import com.kesta.app.core.error.AppException
import com.kesta.app.core.network.bodyOrNull
import com.kesta.app.core.network.safeRequest
import com.kesta.app.data.location.Location
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.parameter

/** PRE-01: pide el precio vigente de una presentación en cada comercio cercano y arma la comparación en la app. */
class KtorPriceRepository(private val client: HttpClient) : PriceRepository {

    override suspend fun comparar(
        presentacionId: Int,
        origen: Location,
        radioKm: Int,
    ): Result<Comparacion> {
        val response = safeRequest {
            client.get("precios") {
                parameter("presentacionId", presentacionId)
                parameter("lat", origen.lat)
                parameter("lng", origen.lng)
                parameter("radioKm", radioKm)
            }
        }.getOrElse { return Result.failure(it) }
        val cuerpo = response.bodyOrNull<PreciosRespuestaDto>()
            ?: return Result.failure(AppException(AppError.RespuestaInvalida))
        val precios = cuerpo.datos.mapNotNull { it.aPrecioEnComercio() }
        return Result.success(Comparacion.desde(precios, origen))
    }
}