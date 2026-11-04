package com.kesta.app.data.repository.fake

import com.kesta.app.data.repository.PriceRepository
import com.kesta.app.domain.model.AhorroPotencial
import com.kesta.app.domain.model.Canal
import com.kesta.app.domain.model.Comparacion
import com.kesta.app.domain.model.PrecioEnComercio
import com.kesta.app.domain.model.ResumenCanal
import com.kesta.app.domain.model.Ubicacion

/**
 * Comparación de precios de prueba. Calcula mínimo, mediana, máximo y ahorro
 * el ahorro se calcula sobre la mediana.
 * Si una presentación no tiene precios dentro del radio, devuelve una comparación
 * sin comercios (el ViewModel la convierte en "vacío").
 */
class FakePriceRepository(
    private val preciosPorPresentacion: Map<Int, List<PrecioEnComercio>> = FakeData.precios,
    private val fallo: Throwable? = null,
    private val retrasoMs: Long = 0,
) : PriceRepository {

    override suspend fun comparar(
        presentacionId: Int,
        centro: Ubicacion,
        radioKm: Int,
    ): Result<Comparacion> = respuestaSimulada(retrasoMs, fallo) {
        val cercanos = preciosPorPresentacion[presentacionId].orEmpty()
            .filter { it.distanciaKm <= radioKm }
            .sortedBy { it.distanciaKm }
        val formal = resumen(Canal.FORMAL, cercanos)
        val informal = resumen(Canal.INFORMAL, cercanos)
        Result.success(
            Comparacion(
                formal = formal,
                informal = informal,
                ahorroPotencial = ahorro(formal, informal),
                comercios = cercanos,
            ),
        )
    }

    private fun resumen(
        canal: Canal,
        precios: List<PrecioEnComercio>
    ): ResumenCanal? {
        val valores = precios.filter { it.canal == canal }.map { it.precio }
        if (valores.isEmpty()) return null
        return ResumenCanal(
            canal = canal,
            minimo = valores.min(),
            mediana = redondear(mediana(valores)),
            maximo = valores.max(),
        )
    }

    private fun mediana(valores: List<Double>): Double {
        val ordenados = valores.sorted()
        val mitad = ordenados.size / 2
        return if (ordenados.size % 2 == 1) ordenados[mitad] else (ordenados[mitad - 1] + ordenados[mitad]) / 2
    }

    private fun ahorro(formal: ResumenCanal?, informal: ResumenCanal?): AhorroPotencial? {
        if (formal == null || informal == null) return null
        val (barato, caro) = if (formal.mediana <= informal.mediana) formal to informal else informal to formal
        val diferencia = redondear(caro.mediana - barato.mediana)
        val porcentaje = if (caro.mediana == 0.0) 0.0 else redondear(diferencia / caro.mediana * 100)
        return AhorroPotencial(canalMasBarato = barato.canal, diferencia = diferencia, porcentaje = porcentaje)
    }
}
