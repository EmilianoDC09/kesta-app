package com.kesta.app.ui.ofertas

import com.kesta.app.data.location.Location
import kotlin.math.abs
import kotlin.math.floor

/** Funciones puras para mostrar precios, distancias y fechas, y para armar la ruta de "Cómo llegar" .*/

/** Redondea a centésimas "hacia arriba en la mitad" (28.455 -> 28.46) */
private fun Double.aCentavos(): Long = floor(this * 100.0 + 0.5).toLong()

/** 43.9 -> "$43.90"; 1234.5 -> "$1,234.50". */
fun Double.comoPesos(): String {
    val centavos = aCentavos()
    val pesos = centavos / 100
    val resto = (centavos % 100).toString().padStart(2, '0')
    val conComas = pesos.toString().reversed().chunked(3).joinToString(",").reversed()
    return "$$conComas.$resto"
}

/** 10.4396 -> "10.4%". */
fun Double.comoPorcentaje(): String {
    val decimas = floor(this * 10.0 + 0.5).toLong()
    return "${decimas / 10}.${decimas % 10}%"
}

/** 2.04 -> "2.0 km"; una distancia casi nula se muestra como "menos de 0.1 km". */
fun Double.comoKm(): String {
    val decimas = floor(this * 10.0 + 0.5).toLong()
    if (decimas == 0L) return "menos de 0.1 km"
    return "${decimas / 10}.${decimas % 10} km"
}

private val MESES = listOf("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")

/** "2026-11-14T09:30:00.000Z" -> "14 nov 2026". Si el texto no tiene el formato esperado, se devuelve igual. */
fun fechaCorta(iso: String): String {
    if (iso.length < 10) return iso
    val anio = iso.substring(0, 4).toIntOrNull()
    val mes = iso.substring(5, 7).toIntOrNull()
    val dia = iso.substring(8, 10).toIntOrNull()
    if (anio == null || mes == null || dia == null || mes !in 1..12) return iso
    return "$dia ${MESES[mes - 1]} $anio"
}

/**
 * Enlace de ruta de Google Maps desde [origen] hasta [destino]. Android lo abre con la app de mapas
 * si hay una instalada y, si no, en el navegador.
 */
fun urlDeRuta(origen: Location, destino: Location): String =
    "https://www.google.com/maps/dir/?api=1" +
            "&origin=${origen.lat},${origen.lng}" +
            "&destination=${destino.lat},${destino.lng}" +
            "&travelmode=driving"

/** 1.0 -> "1"; 0.5 -> "0.5"; 12.0 -> "12". Cantidades de una presentación sin ceros sobrantes. */
fun Double.comoCantidad(): String = if (this == floor(this) && abs(this) < 1e12) toLong().toString() else toString()

/** ("Alpura", 1.0, "L") -> "Alpura · 1 L". */
fun etiquetaPresentacion(marca: String, cantidad: Double, unidad: String): String =
    "$marca · ${cantidad.comoCantidad()} $unidad"