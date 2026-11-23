package com.kesta.app.ui.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.data.auth.SessionRepository
import com.kesta.app.data.auth.SessionState
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Decide que pantalla raiz se muestra y ejecuta el cierre de sesion. */
class SessionViewModel(
    private val repository: SessionRepository,
) : ViewModel() {

    val session: StateFlow<SessionState> = repository.session

    private val _cerrandoSesion = MutableStateFlow(false)
    val cerrandoSesion: StateFlow<Boolean> = _cerrandoSesion.asStateFlow()

    /**
     * true mientras el splash debe seguir visible. Solo aplica al arrancar la app;
     * cerrar sesion o entrar como invitado no muestran el splash.
     */
    private val _mostrarSplash = MutableStateFlow(repository.session.value is SessionState.Verificando)
    val mostrarSplash: StateFlow<Boolean> = _mostrarSplash.asStateFlow()

    init {
        if (_mostrarSplash.value) {
            // La validacion de la sesion corre en paralelo; el tiempo minimo no la retrasa.
            viewModelScope.launch { repository.restore() }
            viewModelScope.launch {
                delay(SPLASH_MINIMO_MS)
                _mostrarSplash.value = false
            }
        }
    }

    fun continuarComoInvitado() = repository.continueAsGuest()

    /** Para un invitado solo regresa a la pantalla de acceso. */
    fun logout() {
        if (_cerrandoSesion.value) return
        _cerrandoSesion.value = true
        viewModelScope.launch {
            try {
                repository.logout()
            } finally {
                _cerrandoSesion.value = false
            }
        }
    }

    companion object {
        /** Duracion minima del splash al abrir la app. */
        const val SPLASH_MINIMO_MS = 3_000L
    }
}