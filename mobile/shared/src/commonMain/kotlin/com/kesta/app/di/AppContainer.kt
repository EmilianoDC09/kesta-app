package com.kesta.app.di

import com.kesta.app.core.config.ApiConfig
import com.kesta.app.core.network.createHttpClient
import com.kesta.app.core.storage.createSecureStore
import com.kesta.app.data.auth.KtorSessionRepository
import com.kesta.app.data.auth.SessionRepository
import com.kesta.app.data.auth.TokenStore
import com.kesta.app.data.auth.createApiClient
import com.kesta.app.data.status.ApiStatusRepository
import com.kesta.app.data.status.KtorApiStatusRepository

/**
 * Inyeccion manual de dependencias. Suficiente para el MVP; no se agrega
 * Koin hasta que haya una razon concreta.
 *
 * authClient: sin token, solo para /auth/login, /auth/registro, /auth/renovar, /auth/logout.
 * apiClient: con token y renovacion automatica, para todo lo demas.
 */
object AppContainer {
    private val baseUrl by lazy { ApiConfig.baseUrl }
    private val tokenStore by lazy { TokenStore(createSecureStore()) }
    private val authClient by lazy { createHttpClient(baseUrl) }
    private val apiClient by lazy { createApiClient(baseUrl, authClient, tokenStore) }

    val sessionRepository: SessionRepository by lazy {
        KtorSessionRepository(authClient, apiClient, tokenStore)
    }

    val apiStatusRepository: ApiStatusRepository by lazy {
        KtorApiStatusRepository(apiClient)
    }
}
