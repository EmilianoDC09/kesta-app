package com.kesta.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.data.auth.SessionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RegisterUiState(
    val nombre: String = "",
    val correo: String = "",
    val contrasena: String = "",
    val confirmacion: String = "",
    val nombreError: String? = null,
    val correoError: String? = null,
    val contrasenaError: String? = null,
    val confirmacionError: String? = null,
    val enviando: Boolean = false,
    val error: String? = null,
)

class RegisterViewModel(
    private val repository: SessionRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(RegisterUiState())
    val state: StateFlow<RegisterUiState> = _state.asStateFlow()

    fun onNombreChange(v: String) = _state.update { it.copy(nombre = v, nombreError = null, error = null) }
    fun onCorreoChange(v: String) = _state.update { it.copy(correo = v, correoError = null, error = null) }
    fun onContrasenaChange(v: String) = _state.update { it.copy(contrasena = v, contrasenaError = null, error = null) }
    fun onConfirmacionChange(v: String) = _state.update { it.copy(confirmacion = v, confirmacionError = null, error = null) }

    fun submit() {
        val s = _state.value
        if (s.enviando) return
        val nombreError = Validaciones.nombre(s.nombre)
        val correoError = Validaciones.correo(s.correo)
        val contrasenaError = Validaciones.contrasenaNueva(s.contrasena)
        val confirmacionError = if (s.confirmacion != s.contrasena) "Las contraseñas no coinciden." else null
        if (listOf(nombreError, correoError, contrasenaError, confirmacionError).any { it != null }) {
            _state.update {
                it.copy(
                    nombreError = nombreError,
                    correoError = correoError,
                    contrasenaError = contrasenaError,
                    confirmacionError = confirmacionError,
                )
            }
            return
        }
        _state.update { it.copy(enviando = true, error = null) }
        viewModelScope.launch {
            repository.register(s.nombre, s.correo, s.contrasena).fold(
                onSuccess = { _state.value = RegisterUiState() },
                onFailure = { e ->
                    _state.update {
                        it.copy(enviando = false, error = e.mensajeRegistro())
                    }
                },
            )
        }
    }
}
