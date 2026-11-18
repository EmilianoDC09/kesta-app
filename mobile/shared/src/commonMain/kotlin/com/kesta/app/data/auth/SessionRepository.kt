package com.kesta.app.data.auth

import kotlinx.coroutines.flow.StateFlow

sealed interface SessionState {
    /** Al abrir la app, mientras se revisa si hay una sesion guardada. */
    data object Verificando : SessionState
    data object NoAutenticado : SessionState
    data class Autenticado(val usuario: Usuario) : SessionState
    /** Explora sin cuenta. No se guarda: al reabrir la app vuelve a la pantalla de acceso. */
    data object Invitado : SessionState
}

/**
 * Los errores se devuelven como Result.failure(AppException(AppError)).
 * La implementacion de prueba (FakeSessionRepository) vive en commonTest.
 */
interface SessionRepository {
    val session: StateFlow<SessionState>

    /** Lee la sesion guardada y la valida contra el servidor (renovando si hace falta). */
    suspend fun restore()

    suspend fun login(correo: String, contrasena: String): Result<Usuario>

    suspend fun register(nombre: String, correo: String, contrasena: String): Result<Usuario>

    fun continueAsGuest()

    /** Siempre termina con la sesion local cerrada, aunque el servidor no responda. */
    suspend fun logout()
}
