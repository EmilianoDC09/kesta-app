package com.kesta.app.ui.session

import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.fake.FakeAuthRepository
import com.kesta.app.data.repository.fake.FakeData
import com.kesta.app.domain.model.Sesion
import com.kesta.app.domain.model.Usuario
import com.kesta.app.ui.prepararDispatcherDePrueba
import com.kesta.app.ui.restaurarDispatcher
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

@OptIn(ExperimentalCoroutinesApi::class)
class SessionViewModelTest {

    @BeforeTest fun preparar() = prepararDispatcherDePrueba()
    @AfterTest fun limpiar() = restaurarDispatcher()

    @Test
    fun iniciarSesionConDatosCorrectosGuardaLaSesion() {
        val vm = SessionViewModel(FakeAuthRepository())
        vm.iniciarSesion(FakeData.CORREO_DEMO, FakeData.CONTRASENA_DEMO)
        assertEquals(UiState.Success(Unit), vm.state.value.accion)
        assertNotNull(vm.state.value.sesion)
    }

    @Test
    fun iniciarSesionConContrasenaIncorrectaMuestraError() {
        val vm = SessionViewModel(FakeAuthRepository())
        vm.iniciarSesion(FakeData.CORREO_DEMO, "otra")
        assertEquals(UiState.Error("Correo o contraseña incorrectos"), vm.state.value.accion)
        assertNull(vm.state.value.sesion)
    }

    @Test
    fun correoInvalidoMuestraError() {
        val vm = SessionViewModel(FakeAuthRepository())
        vm.iniciarSesion("esto-no-es-un-correo", "Kesta123")
        assertEquals(UiState.Error("Escribe un correo válido"), vm.state.value.accion)
    }

    @Test
    fun contrasenaVaciaMuestraError() {
        val vm = SessionViewModel(FakeAuthRepository())
        vm.iniciarSesion(FakeData.CORREO_DEMO, "")
        assertEquals(UiState.Error("Escribe tu contraseña"), vm.state.value.accion)
    }

    @Test
    fun registrarConCorreoNuevoCreaLaSesion() {
        val vm = SessionViewModel(FakeAuthRepository())
        vm.registrar("Luis", "luis@kesta.mx", "secreta", ciudadId = 1)
        assertEquals(UiState.Success(Unit), vm.state.value.accion)
        assertEquals("Luis", vm.state.value.sesion?.usuario?.nombre)
    }

    @Test
    fun registrarConCorreoRepetidoMuestraError() {
        val vm = SessionViewModel(FakeAuthRepository())
        vm.registrar("Ana", FakeData.CORREO_DEMO, "secreta", ciudadId = 1)
        assertEquals(UiState.Error("Ese correo ya está registrado"), vm.state.value.accion)
        assertNull(vm.state.value.sesion)
    }

    @Test
    fun registrarSinNombreMuestraError() {
        val vm = SessionViewModel(FakeAuthRepository())
        vm.registrar("  ", "luis@kesta.mx", "secreta", ciudadId = 1)
        assertEquals(UiState.Error("Escribe tu nombre"), vm.state.value.accion)
    }

    @Test
    fun cerrarSesionLimpiaLaSesion() {
        val vm = SessionViewModel(FakeAuthRepository())
        vm.iniciarSesion(FakeData.CORREO_DEMO, FakeData.CONTRASENA_DEMO)
        vm.cerrarSesion()
        assertNull(vm.state.value.sesion)
        assertEquals(UiState.Idle, vm.state.value.accion)
    }

    @Test
    fun cargarSesionRecuperaLaSesionGuardada() {
        val guardada = Sesion(Usuario(id = 1, nombre = "Ana", ciudadId = 1, radioKmPorDefecto = 5, rol = "usuario"))
        val vm = SessionViewModel(FakeAuthRepository(sesionInicial = guardada))
        vm.cargarSesion()
        assertEquals(guardada, vm.state.value.sesion)
        assertEquals(UiState.Idle, vm.state.value.accion)
    }

}
