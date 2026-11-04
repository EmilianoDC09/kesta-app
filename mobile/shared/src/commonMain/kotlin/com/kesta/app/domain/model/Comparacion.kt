package com.kesta.app.domain.model

/** Tipo de comercio: supermercado/cadena (FORMAL) o tianguis/mercado (INFORMAL). */
enum class Canal { FORMAL, INFORMAL}

/** De dónde salió el precio. */
enum class Fuente { PROFECO, SCRAPING, COMUNIDAD}

data class PrecioEnComercio(
    val comercio: String,
    val ubicacionId: Int,
    val canal: Canal,
    val precio: Double,
    val fuente: Fuente,
    /** Fecha en formato ISO 8601, por ejemplo "2026-10-28T14:30:00Z". */
    val fechaCaptura: String,
    val verificado: Boolean,
    val distanciaKm: Double,
    /** true si el precio es viejo y puede haber cambiado. */
    val desactualizado: Boolean = false,
)

/** Mínimo, mediana y máximo de los precios de un canal. */
data class ResumenCanal(
    val canal: Canal,
    val minimo: Double,
    val mediana: Double,
    val maximo: Double,
)

/** Cuánto se ahorra al elegir el canal más barato (calculado sobre la mediana). */
data class AhorroPotencial(
    val canalMasBarato: Canal,
    val diferencia: Double,
    val porcentaje: Double,
)

data class Comparacion(
    /** null si no hay precios formales en el área. */
    val formal: ResumenCanal?,
    /** null si no hay precios informales en el área. */
    val informal: ResumenCanal?,
    /** null si falta información de alguno de los canales. */
    val ahorroPotencial: AhorroPotencial?,
    /** Comercios ordenados por distancia. */
    val comercios: List<PrecioEnComercio>,
)


