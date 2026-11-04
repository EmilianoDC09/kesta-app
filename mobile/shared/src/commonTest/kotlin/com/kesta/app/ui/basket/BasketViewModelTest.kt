package com.kesta.app.ui.basket

import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.fake.FakeBasketRepository
import com.kesta.app.data.repository.fake.FakeData
import com.kesta.app.ui.prepararDispatcherDePrueba
import com.kesta.app.ui.restaurarDispatcher
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class BasketViewModelTest {

    @BeforeTest fun preparar() = prepararDispatcherDePrueba()
    @AfterTest fun limpiar() = restaurarDispatcher()

    private val centro = FakeData.centroMorelia
    private val canastaId = FakeData.canastas.first().id

    // lista y detalle
    @Test
    fun cargarCanastasMuestraLosDatos() {
        val vm = BasketViewModel(FakeBasketRepository())
        vm.cargarCanastas()
        assertEquals(UiState.Success(FakeData.canastas), vm.state.value.canastas)
    }

    @Test
    fun abrirUnaCanastaMuestraSuContenido() {
        val vm = BasketViewModel(FakeBasketRepository())
        vm.abrir(canastaId)
        assertEquals(UiState.Success(FakeData.canastas.first()), vm.state.value.detalle)
    }

    @Test
    fun abrirUnaCanastaQueNoExisteMuestraError() {
        val vm = BasketViewModel(FakeBasketRepository())
        vm.abrir(999)
        assertEquals(UiState.Error("No se encontró la canasta"), vm.state.value.detalle)
    }

    //  cambios
    @Test
    fun crearUnaCanastaLaAgregaALaListaYLaAbre() {
        val vm = BasketViewModel(FakeBasketRepository())
        vm.cargarCanastas()
        vm.crear("Fiesta")
        assertEquals(UiState.Success(Unit), vm.state.value.accion)
        val lista = vm.state.value.canastas
        assertTrue(lista is UiState.Success)
        assertEquals(2, lista.data.size)
        val detalle = vm.state.value.detalle
        assertTrue(detalle is UiState.Success)
        assertEquals("Fiesta", detalle.data.nombre)
    }

    @Test
    fun agregarUnProductoActualizaElDetalle() {
        val vm = BasketViewModel(FakeBasketRepository())
        vm.agregarProducto(canastaId, FakeData.presLeche.id, cantidad = 2.0)
        assertEquals(UiState.Success(Unit), vm.state.value.accion)
        val detalle = vm.state.value.detalle
        assertTrue(detalle is UiState.Success)
        assertEquals(3, detalle.data.items.size)
    }

    @Test
    fun cambiarLaCantidadActualizaElProducto() {
        val vm = BasketViewModel(FakeBasketRepository())
        vm.cambiarCantidad(canastaId, itemId = 1, cantidad = 3.0)
        val detalle = vm.state.value.detalle
        assertTrue(detalle is UiState.Success)
        assertEquals(3.0, detalle.data.items.first { it.id == 1 }.cantidad)
    }

    @Test
    fun quitarUnProductoLoSacaDeLaCanasta() {
        val vm = BasketViewModel(FakeBasketRepository())
        vm.quitarProducto(canastaId, itemId = 1)
        val detalle = vm.state.value.detalle
        assertTrue(detalle is UiState.Success)
        assertEquals(1, detalle.data.items.size)
    }

    @Test
    fun eliminarLaUltimaCanastaDejaLaListaVaciaYCierraElDetalle() {
        val vm = BasketViewModel(FakeBasketRepository())
        vm.cargarCanastas()
        vm.abrir(canastaId)
        vm.eliminar(canastaId)
        assertEquals(UiState.Empty, vm.state.value.canastas)
        assertEquals(UiState.Idle, vm.state.value.detalle)
        assertEquals(UiState.Success(Unit), vm.state.value.accion)
    }

    // optimización
    @Test
    fun optimizarConUnaSolaTiendaRecomiendaLaMasBarata() {
        val vm = BasketViewModel(FakeBasketRepository())
        vm.optimizar(canastaId, centro, radioKm = 5, unaSolaTienda = true)
        val estado = vm.state.value.optimizacion
        assertTrue(estado is UiState.Success)
        val resultado = estado.data
        assertEquals(1, resultado.tiendasRecomendadas.size)
        assertEquals("Tianguis del Pedregal", resultado.tiendasRecomendadas.first().comercio)
        assertEquals(90.0, resultado.costoTotal)
        assertEquals(19.5, resultado.ahorroVsMasCara)
        assertTrue(resultado.productosSinPrecio.isEmpty())
    }

}
