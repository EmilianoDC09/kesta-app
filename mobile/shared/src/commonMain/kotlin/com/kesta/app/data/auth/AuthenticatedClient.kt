package com.kesta.app.data.auth

import com.kesta.app.core.network.createHttpClient
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.auth.Auth
import io.ktor.client.plugins.auth.providers.BearerTokens
import io.ktor.client.plugins.auth.providers.bearer
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.isSuccess

/**
 * Cliente para todo lo que requiere sesion (CAT, PRE, CAN, perfil...).
 *
 * - Adjunta "Authorization: Bearer <accessToken>" en cada peticion.
 * - Al recibir 401 llama a /auth/renovar UNA sola vez aunque haya varias
 *   peticiones en paralelo (el plugin Auth de Ktor serializa la renovacion).
 * - Guarda el refreshToken rotado.
 * - Si el backend rechaza la renovacion, borra la sesion y avisa al repositorio,
 *   que regresa la app a la pantalla de inicio de sesion.
 *
 * La renovacion se hace con [authClient] (sin plugin Auth) para no entrar en bucle.
 */
fun createApiClient(
    baseUrl: String,
    authClient: HttpClient,
    tokenStore: TokenStore,
): HttpClient = createHttpClient(baseUrl) {
    install(Auth) {
        bearer {
            loadTokens {
                tokenStore.get()?.let { BearerTokens(it.accessToken, it.refreshToken) }
            }
            refreshTokens {
                val refreshToken = tokenStore.get()?.refreshToken ?: return@refreshTokens null
                val response = authClient.post("auth/renovar") {
                    setBody(RefreshRequest(refreshToken))
                }
                when {
                    response.status.isSuccess() -> {
                        val tokens = response.body<TokensResponse>()
                        tokenStore.updateTokens(tokens.accessToken, tokens.refreshToken)
                        BearerTokens(tokens.accessToken, tokens.refreshToken)
                    }
                    // Token de renovacion vencido, revocado o ya usado: la sesion termino.
                    response.status.value in setOf(400, 401, 403) -> {
                        tokenStore.clear()
                        tokenStore.notifySessionExpired()
                        null
                    }
                    // 5xx u otro: no se cierra la sesion por una falla del servidor.
                    else -> null
                }
            }
            sendWithoutRequest { true }
        }
    }
}
