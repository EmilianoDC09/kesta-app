package com.kesta.app.ui.comparison

import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.fake.FakeData
import com.kesta.app.data.repository.fake.FakePriceRepository
import com.kesta.app.domain.model.Canal
import com.kesta.app.ui.prepararDispatcherDePrueba
import com.kesta.app.ui.restaurarDispatcher
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class ComparisonViewModelTest {

    @BeforeTest fun preparar() = prepararDispatcherDePrueba()
    @AfterTest fun limpiar() = restaurarDispatcher()

    private val centro = FakeData.centroMorelia

    @Test
    fun compararAceiteMuestraLosDosCanalesYElAhorro() {
        val vm = ComparisonViewModel(FakePriceRepository())
        vm.comparar(FakeData.presAceite.id, centro, radioKm = 5)

        val estado = vm.state.value.comparacion
        assertTrue(estado is UiState.Success)
        val comparacion = estado.data
        assertEquals(45.50, comparacion.formal?.mediana)
        assertEquals(40.00, comparacion.informal?.mediana)
        assertEquals(Canal.INFORMAL, comparacion.ahorroPotencial?.canalMasBarato)
        assertEquals(5.50, comparacion.ahorroPotencial?.diferencia)
        // Los comercios vienen ordenados por distancia
        assertEquals("Chedraui", comparacion.comercios.first().comercio)
    }

    @Test
    fun compararUnaPresentacionSoloFormalDejaElInformalVacio() {
        val vm = ComparisonViewModel(FakePriceRepository())
        vm.comparar(FakeData.presLeche.id, centro, radioKm = 5)
        val estado = vm.state.value.comparacion
        assertTrue(estado is UiState.Success)
        assertNull(estado.data.informal)
        assertNull(estado.data.ahorroPotencial)
    }

}