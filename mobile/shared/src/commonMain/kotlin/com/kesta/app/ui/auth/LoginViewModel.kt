package com.kesta.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.data.auth.SessionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUiState(
    val correo: String = "",
    val contrasena: String = "",
    val correoError: String? = null,
    val contrasenaError: String? = null,
    val enviando: Boolean = false,
    val error: String? = null,
)

class LoginViewModel(
    private val repository: SessionRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onCorreoChange(valor: String) =
        _state.update { it.copy(correo = valor, correoError = null, error = null) }

    fun onContrasenaChange(valor: String) =
        _state.update { it.copy(contrasena = valor, contrasenaError = null, error = null) }

    fun submit() {
        val actual = _state.value
        if (actual.enviando) return
        val correoError = Validaciones.correo(actual.correo)
        val contrasenaError = if (actual.contrasena.isEmpty()) "Ingresa tu contraseña." else null
        if (correoError != null || contrasenaError != null) {
            _state.update { it.copy(correoError = correoError, contrasenaError = contrasenaError) }
            return
        }
        _state.update { it.copy(enviando = true, error = null) }
        viewModelScope.launch {
            repository.login(actual.correo, actual.contrasena).fold(
                // La navegacion la hace App al cambiar la sesion; se limpia el formulario
                // para que la contrasena no quede en memoria al volver tras un logout.
                onSuccess = { _state.value = LoginUiState() },
                onFailure = { e ->
                    _state.update {
                        it.copy(enviando = false, error = e.mensajeLogin())
                    }
                },
            )
        }
    }
}
