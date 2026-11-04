package com.kesta.app.ui.search

import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.fake.FakeCatalogRepository
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

@OptIn(ExperimentalCoroutinesApi::class)
class SearchViewModelTest {

    @BeforeTest fun preparar() = prepararDispatcherDePrueba()
    @AfterTest fun limpiar() = restaurarDispatcher()

    @Test
    fun buscarSinResultadosMuestraVacio() {
        val vm = SearchViewModel(FakeCatalogRepository(productos = emptyList()))
        vm.cambiarConsulta("leche")
        vm.buscar()
        assertEquals(UiState.Empty, vm.state.value.resultados)
    }

    @Test
    fun buscarLecheMuestraSoloLaLeche() {
        val vm = SearchViewModel(FakeCatalogRepository())
        vm.cambiarConsulta("leche")
        vm.buscar()
        assertEquals(UiState.Success(listOf(FakeData.productos[2])), vm.state.value.resultados)
    }


    @Test
    fun buscarSoloConCategoriaFiltraPorEsaCategoria() {
        val vm = SearchViewModel(FakeCatalogRepository())
        vm.elegirCategoria(FakeData.catAceites.id)
        vm.buscar()
        assertEquals(UiState.Success(listOf(FakeData.productos[0])), vm.state.value.resultados)
    }


    @Test
    fun cargarCategoriasMuestraLosDatos() {
        val vm = SearchViewModel(FakeCatalogRepository())
        vm.cargarCategorias()
        assertEquals(UiState.Success(FakeData.categorias), vm.state.value.categorias)
    }

    @Test
    fun cargarCategoriasSinDatosMuestraVacio() {
        val vm = SearchViewModel(FakeCatalogRepository(categorias = emptyList()))
        vm.cargarCategorias()
        assertEquals(UiState.Empty, vm.state.value.categorias)
    }

    @Test
    fun cambiarConsultaYCategoriaActualizanElEstado() {
        val vm = SearchViewModel(FakeCatalogRepository())
        vm.cambiarConsulta("aceite")
        vm.elegirCategoria(1)
        assertEquals("aceite", vm.state.value.consulta)
        assertEquals(1, vm.state.value.categoriaId)
    }
}