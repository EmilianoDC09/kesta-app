package com.kesta.app.data.auth

import com.kesta.app.core.error.AppError
import com.kesta.app.core.error.AppException
import com.kesta.app.core.network.bodyOrNull
import com.kesta.app.core.network.safeRequest
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.auth.authProvider
import io.ktor.client.plugins.auth.providers.BearerAuthProvider
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpStatusCode
import io.ktor.http.isSuccess
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.cancellation.CancellationException

/**
 * AUT-01 registro, AUT-02 login, AUT-03 renovar (en el cliente), AUT-04 logout,
 * AUT-05 perfil (para validar la sesion al abrir la app).
 */
class KtorSessionRepository(
    private val authClient: HttpClient,
    private val apiClient: HttpClient,
    private val tokenStore: TokenStore,
) : SessionRepository {

    private val _session = MutableStateFlow<SessionState>(SessionState.Verificando)
    override val session: StateFlow<SessionState> = _session.asStateFlow()

    init {
        tokenStore.onSessionExpired = { _session.value = SessionState.NoAutenticado }
    }

    override suspend fun restore() {
        val stored = tokenStore.get()
        if (stored == null) {
            _session.value = SessionState.NoAutenticado
            return
        }
        _session.value = try {
            // Si el accessToken vencio (15 min), el cliente renueva solo antes de responder.
            val response = apiClient.get("usuarios/perfil")
            val current = tokenStore.get()
            if (response.status == HttpStatusCode.Unauthorized && current == null) {
                SessionState.NoAutenticado
            } else {
                SessionState.Autenticado(current?.usuario ?: stored.usuario)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // Sin red o servidor caido: NO se cierra la sesion; se usa el usuario guardado.
            SessionState.Autenticado(stored.usuario)
        }
    }

    override suspend fun login(correo: String, contrasena: String): Result<Usuario> {
        val response = safeRequest {
            authClient.post("auth/login") { setBody(LoginRequest(correo.trim(), contrasena)) }
        }.getOrElse { return Result.failure(it) }

        val auth = response.bodyOrNull<AuthResponse>()
            ?: return Result.failure(AppException(AppError.RespuestaInvalida))
        return iniciarSesionLocal(auth)
    }

    override suspend fun register(nombre: String, correo: String, contrasena: String): Result<Usuario> {
        val correoLimpio = correo.trim()
        val response = safeRequest {
            authClient.post("auth/registro") {
                setBody(RegistroRequest(nombre.trim(), correoLimpio, contrasena, CIUDAD_PILOTO_ID))
            }
        }.getOrElse { return Result.failure(it) }

        // Si el registro no devuelve tokens, se inicia sesion con las mismas credenciales.
        val auth = response.bodyOrNull<AuthResponse>() ?: return login(correoLimpio, contrasena)
        return iniciarSesionLocal(auth)
    }

    override fun continueAsGuest() {
        _session.value = SessionState.Invitado
    }

    override suspend fun logout() {
        val stored = tokenStore.get()
        if (stored != null) {
            try {
                withTimeoutOrNull(LOGOUT_TIMEOUT_MS) { revocarEnServidor(stored) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Sin red: la sesion se cierra localmente de todos modos.
            }
        }
        tokenStore.clear()
        apiClient.authProvider<BearerAuthProvider>()?.clearToken()
        _session.value = SessionState.NoAutenticado
    }

    /**
     * Se usa authClient con el token explicito para que una renovacion automatica
     * no rote el refreshToken despues de haberlo puesto en el cuerpo.
     * Si el accessToken ya vencio, se renueva una vez y se reintenta.
     */
    private suspend fun revocarEnServidor(stored: StoredSession) {
        val first = postLogout(stored.accessToken, stored.refreshToken)
        if (first.status != HttpStatusCode.Unauthorized) return
        val renewed = authClient.post("auth/renovar") { setBody(RefreshRequest(stored.refreshToken)) }
        if (!renewed.status.isSuccess()) return
        val tokens = renewed.body<TokensResponse>()
        postLogout(tokens.accessToken, tokens.refreshToken)
    }

    private suspend fun postLogout(accessToken: String, refreshToken: String): HttpResponse =
        authClient.post("auth/logout") {
            bearerAuth(accessToken)
            setBody(RefreshRequest(refreshToken))
        }

    private suspend fun iniciarSesionLocal(auth: AuthResponse): Result<Usuario> {
        try {
            tokenStore.save(StoredSession(auth.accessToken, auth.refreshToken, auth.usuario))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            return Result.failure(AppException(AppError.AlmacenamientoLocal))
        }
        // Descarta tokens de una cuenta anterior que Ktor tenga en memoria.
        apiClient.authProvider<BearerAuthProvider>()?.clearToken()
        _session.value = SessionState.Autenticado(auth.usuario)
        return Result.success(auth.usuario)
    }

    private companion object {
        /** Morelia, ciudad piloto. Se reemplaza por un selector cuando haya mas ciudades. */
        const val CIUDAD_PILOTO_ID = 1
        const val LOGOUT_TIMEOUT_MS = 5_000L
    }
}
