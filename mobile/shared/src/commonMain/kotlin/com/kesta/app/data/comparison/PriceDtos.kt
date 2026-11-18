package com.kesta.app.data.comparison

import com.kesta.app.data.location.Location
import kotlinx.serialization.Serializable

/*
 * Respuesta del servidor para PRE-01 (GET /precios): el precio vigente de una presentación
 * en cada ubicación cercana. Es interna a la capa de datos.
 */

@Serializable
internal data class ComercioDto(
    val id: Int,
    val nombre: String,
    val canal: String,
)

@Serializable
internal data class UbicacionDto(
    val id: Int,
    val direccion: String? = null,
    val lat: Double,
    val lng: Double,
    val distanciaKm: Double = 0.0,
)

@Serializable
internal data class PrecioDto(
    val precioId: Int,
    val presentacionId: Int,
    val precio: Double,
    val fuente: String,
    val fechaCaptura: String,
    val estadoVerificacion: String,
    val desactualizado: Boolean = false,
    val comercio: ComercioDto,
    val ubicacion: UbicacionDto,
)

@Serializable
internal data class PreciosRespuestaDto(
    val datos: List<PrecioDto> = emptyList(),
    val total: Int = 0,
)

private fun String.aCanal(): Canal? = when (lowercase()) {
    "formal" -> Canal.FORMAL
    "informal" -> Canal.INFORMAL
    else -> null
}

private fun String.aFuente(): Fuente = when (lowercase()) {
    "profeco" -> Fuente.PROFECO
    "scraping" -> Fuente.SCRAPING
    "comunidad" -> Fuente.COMUNIDAD
    else -> Fuente.OTRA
}

internal fun PrecioDto.aPrecioEnComercio(): PrecioEnComercio? {
    val canalComercio = comercio.canal.aCanal() ?: return null
    return PrecioEnComercio(
        ubicacionId = ubicacion.id,
        comercio = comercio.nombre,
        direccion = ubicacion.direccion?.takeIf { it.isNotBlank() },
        ubicacion = Location(lat = ubicacion.lat, lng = ubicacion.lng),
        canal = canalComercio,
        precio = precio,
        fuente = fuente.aFuente(),
        fechaCaptura = fechaCaptura,
        verificado = estadoVerificacion == "Activo",
        desactualizado = desactualizado,
    )
}