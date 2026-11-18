package com.kesta.app.data.auth

import com.kesta.app.core.error.AppError
import com.kesta.app.core.error.AppException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Implementacion en memoria para pruebas de ViewModels (6.2 / 8.1). */
class FakeSessionRepository(
    initial: SessionState = SessionState.NoAutenticado,
    var loginResult: Result<Usuario> = Result.failure(AppException(AppError.NoAutorizado)),
    var registerResult: Result<Usuario> = Result.failure(AppException(AppError.Conflicto)),
) : SessionRepository {
    private val _session = MutableStateFlow(initial)
    override val session: StateFlow<SessionState> = _session.asStateFlow()

    override suspend fun restore() {
        if (_session.value is SessionState.Verificando) _session.value = SessionState.NoAutenticado
    }

    override suspend fun login(correo: String, contrasena: String): Result<Usuario> =
        loginResult.onSuccess { _session.value = SessionState.Autenticado(it) }

    override suspend fun register(nombre: String, correo: String, contrasena: String): Result<Usuario> =
        registerResult.onSuccess { _session.value = SessionState.Autenticado(it) }

    override fun continueAsGuest() {
        _session.value = SessionState.Invitado
    }

    override suspend fun logout() {
        _session.value = SessionState.NoAutenticado
    }
}
