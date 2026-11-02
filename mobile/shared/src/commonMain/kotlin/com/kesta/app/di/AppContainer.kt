package com.kesta.app.di

import com.kesta.app.core.config.defaultApiBaseUrl
import com.kesta.app.core.network.createHttpClient
import com.kesta.app.data.repository.ApiStatusRepository
import com.kesta.app.data.repository.KtorApiStatusRepository

/**
 * Inyeccion manual de dependencias. Suficiente para el MVP; no se agrega
 * Koin hasta que haya una razon concreta.
 */
object AppContainer {
    private val httpClient by lazy { createHttpClient(defaultApiBaseUrl()) }

    val apiStatusRepository: ApiStatusRepository by lazy {
        KtorApiStatusRepository(httpClient)
    }
}
