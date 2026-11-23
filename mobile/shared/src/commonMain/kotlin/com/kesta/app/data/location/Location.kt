package com.kesta.app.data.location

import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** Un punto en el mapa: del usuario o de un comercio. */
data class Location(
    val lat: Double,
    val lng: Double,
) {
    /** Distancia en línea recta (km) hasta otro punto, sirve para ordenar comercios del más cercano al más lejano. */

    fun distanciaKmA(otra: Location): Double {
        val radioTierraKm = 6371.0
        val dLat = (otra.lat - lat) * PI / 180.0
        val dLng = (otra.lng - lng) * PI / 180.0
        val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(lat * PI / 180.0) * cos(otra.lat * PI / 180.0) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * radioTierraKm * asin(sqrt(a))
    }

    companion object {
        /** Se usa cuando el usuario niega el permiso de ubicación */
        val CENTRO_MORELIA = Location(lat = 19.7027, lng = -101.1925)
    }
}