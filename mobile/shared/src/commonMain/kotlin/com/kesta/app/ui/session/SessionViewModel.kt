package com.kesta.app.ui.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.AuthRepository
import com.kesta.app.domain.model.Sesion
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Lo que las pantallas de registro / inicio de sesión necesitan saber.
 *  - [sesion]: null = nadie ha iniciado sesión.
 *  - [accion]: estado de la última acción (registrar, iniciar o cerrar sesión).
 */
data class SessionUiState(
    val sesion: Sesion? = null,
    val accion: UiState<Unit> = UiState.Idle,
)

class SessionViewModel(
    private val auth: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(SessionUiState())
    val state: StateFlow<SessionUiState> = _state.asStateFlow()

    /** Al abrir la app, revisa si ya había una sesión guardada. */
    fun cargarSesion() {
        if (_state.value.accion is UiState.Loading) return
        _state.update { it.copy(accion = UiState.Loading) }
        viewModelScope.launch {
            auth.sesionActual().fold(
                onSuccess = { sesion ->
                    _state.update { it.copy(sesion = sesion, accion = UiState.Idle) }
                },
                // Si no se puede leer la sesión guardada, se trata como "sin sesión".
                onFailure = {
                    _state.update { it.copy(sesion = null, accion = UiState.Idle) }
                },
            )
        }
    }

    fun registrar(nombre: String, correo: String, contrasena: String, ciudadId: Int) {
        if (_state.value.accion is UiState.Loading) return
        if (nombre.isBlank()) {
            mostrarError("Escribe tu nombre")
            return
        }
        val correoLimpio = correo.trim()
        if (!correoValido(correoLimpio)) {
            mostrarError("Escribe un correo válido")
            return
        }
        if (contrasena.isEmpty()) {
            mostrarError("Escribe una contraseña")
            return
        }
        entrar { auth.registrar(nombre.trim(), correoLimpio, contrasena, ciudadId) }
    }

    fun iniciarSesion(correo: String, contrasena: String) {
        if (_state.value.accion is UiState.Loading) return
        val correoLimpio = correo.trim()
        if (!correoValido(correoLimpio)) {
            mostrarError("Escribe un correo válido")
            return
        }
        if (contrasena.isEmpty()) {
            mostrarError("Escribe tu contraseña")
            return
        }
        entrar { auth.iniciarSesion(correoLimpio, contrasena) }
    }

    fun cerrarSesion() {
        if (_state.value.accion is UiState.Loading) return
        _state.update { it.copy(accion = UiState.Loading) }
        viewModelScope.launch {
            auth.cerrarSesion().fold(
                onSuccess = {
                    _state.update { it.copy(sesion = null, accion = UiState.Idle) }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(accion = UiState.Error(e.message ?: "No se pudo cerrar la sesión"))
                    }
                },
            )
        }
    }

    /** Quita el mensaje de error (o de éxito) al cambiar de pantalla. */
    fun limpiarAccion() {
        _state.update { if (it.accion is UiState.Loading) it else it.copy(accion = UiState.Idle) }
    }

    /** Registro e inicio de sesión comparten el mismo manejo de resultado. */
    private fun entrar(llamada: suspend () -> Result<Sesion>) {
        _state.update { it.copy(accion = UiState.Loading) }
        viewModelScope.launch {
            llamada().fold(
                onSuccess = { sesion ->
                    _state.update { it.copy(sesion = sesion, accion = UiState.Success(Unit)) }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(accion = UiState.Error(e.message ?: "No se pudo completar la operación"))
                    }
                },
            )
        }
    }

    private fun mostrarError(mensaje: String) {
        _state.update { it.copy(accion = UiState.Error(mensaje)) }
    }

    private fun correoValido(correo: String): Boolean = CORREO_REGEX.matches(correo)

    private companion object {
        val CORREO_REGEX = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
    }
}