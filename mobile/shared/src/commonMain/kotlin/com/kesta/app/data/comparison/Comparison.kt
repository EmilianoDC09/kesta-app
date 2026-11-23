package com.kesta.app.data.comparison

import com.kesta.app.data.location.Location

enum class Canal(val etiqueta: String) {
    FORMAL("Supermercado"),
    INFORMAL("Tianguis"),
}

enum class Fuente(val etiqueta: String) {
    PROFECO("Profeco"),
    SCRAPING("Tienda en línea"),
    COMUNIDAD("Comunidad"),
    OTRA("Otra"),
}

data class PrecioEnComercio(
    val ubicacionId: Int,
    val comercio: String,
    val direccion: String?,
    val ubicacion: Location,
    val canal: Canal,
    val precio: Double,
    val fuente: Fuente,
    val fechaCaptura: String,
    val verificado: Boolean,
    val desactualizado: Boolean,
    val distanciaKm: Double? = null,
)

data class ResumenCanal(
    val canal: Canal,
    val minimo: Double,
    val mediana: Double,
    val maximo: Double,
    val cantidadComercios: Int,
    val desactualizados: Int,
)

/**
 * Comparación formal vs informal de una presentación.
 *
 * Todo se calcula a partir de la misma lista de comercios que ve el usuario, así el precio
 * mínimo de cada canal siempre coincide con el más bajo de esa lista.
 * Si un canal no tiene precios en la zona, su resumen es null y NO hay ahorro.
 */
data class Comparacion(
    val formal: ResumenCanal?,
    val informal: ResumenCanal?,
    val comercios: List<PrecioEnComercio>,
) {
    /** El canal que falta en la zona, si falta alguno. Con esto la pantalla avisa en lugar de mostrar un ahorro. */
    val canalSinPrecios: Canal?
        get() = when {
            formal == null && informal != null -> Canal.FORMAL
            informal == null && formal != null -> Canal.INFORMAL
            else -> null
        }

    /** Canal con la mediana más baja. Null si falta un canal o si las medianas son iguales. */
    val canalMasBarato: Canal?
        get() {
            if (formal == null || informal == null) return null
            return when {
                formal.mediana < informal.mediana -> Canal.FORMAL
                informal.mediana < formal.mediana -> Canal.INFORMAL
                else -> null
            }
        }

    /** Diferencia entre las medianas de los dos canales, en pesos */
    val ahorroPesos: Double?
        get() {
            if (formal == null || informal == null) return null
            return kotlin.math.abs(formal.mediana - informal.mediana)
        }

    /** El mismo ahorro, como porcentaje de la mediana del canal más caro. */
    val ahorroPorcentaje: Double?
        get() {
            val pesos = ahorroPesos ?: return null
            val masCara = maxOf(formal!!.mediana, informal!!.mediana)
            if (masCara <= 0.0) return null
            return pesos / masCara * 100.0
        }

    companion object {
        /**
         * Arma la comparación: calcula la distancia de cada comercio al usuario, los ordena del más
         * cercano al más lejano y resume cada canal.
         */
        fun desde(precios: List<PrecioEnComercio>, origen: Location): Comparacion {
            val comercios = precios
                .map { it.copy(distanciaKm = origen.distanciaKmA(it.ubicacion)) }
                .sortedBy { it.distanciaKm }
            return Comparacion(
                formal = resumir(Canal.FORMAL, comercios),
                informal = resumir(Canal.INFORMAL, comercios),
                comercios = comercios,
            )
        }

        /** Resume los precios de un canal (supermercados o tianguis): mínimo, mediana y máximo */
        private fun resumir(canal: Canal, comercios: List<PrecioEnComercio>): ResumenCanal? {
            val delCanal = comercios.filter { it.canal == canal }
            if (delCanal.isEmpty()) return null
            val valores = delCanal.map { it.precio }.sorted()
            val mitad = valores.size / 2
            val mediana = if (valores.size % 2 == 1) valores[mitad] else (valores[mitad - 1] + valores[mitad]) / 2.0
            return ResumenCanal(
                canal = canal,
                minimo = valores.first(),
                mediana = mediana,
                maximo = valores.last(),
                cantidadComercios = valores.size,
                desactualizados = delCanal.count { it.desactualizado },
            )
        }
    }
}