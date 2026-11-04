package com.kesta.app.ui.location

import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.fake.FakeCatalogRepository
import com.kesta.app.data.repository.fake.FakeData
import com.kesta.app.data.repository.fake.FakeLocationProvider
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

@OptIn(ExperimentalCoroutinesApi::class)
class LocationViewModelTest {

    @BeforeTest fun preparar() = prepararDispatcherDePrueba()
    @AfterTest fun limpiar() = restaurarDispatcher()

    private fun crear(
        catalogo: FakeCatalogRepository = FakeCatalogRepository(),
        gps: FakeLocationProvider = FakeLocationProvider(),
    ) = LocationViewModel(catalogo, gps)

    @Test
    fun cargarCiudadesMuestraLosDatos() {
        val vm = crear()
        vm.cargarCiudades()
        assertEquals(UiState.Success(FakeData.ciudades), vm.state.value.ciudades)
    }


    @Test
    fun usarUbicacionActualGuardaElPuntoDelGps() {
        val vm = crear()
        vm.usarUbicacionActual()
        assertEquals(UiState.Success(FakeData.centroMorelia), vm.state.value.ubicacion)
        assertNull(vm.state.value.ciudadElegida)
    }

    @Test
    fun elegirCiudadUsaElCentroDeLaCiudad() {
        val vm = crear()
        val morelia = FakeData.ciudades.first()
        vm.elegirCiudad(morelia)
        assertEquals(morelia, vm.state.value.ciudadElegida)
        assertEquals(UiState.Success(morelia.centro), vm.state.value.ubicacion)
    }

}
