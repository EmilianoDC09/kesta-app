package com.kesta.app.core.network

import io.ktor.client.HttpClient
import io.ktor.client.HttpClientConfig
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/** Configuracion JSON unica para red y almacenamiento local. */
val KestaJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
    explicitNulls = false
}

/**
 * El motor (OkHttp en Android, Darwin en iOS) se resuelve solo segun
 * las dependencias declaradas en androidMain / iosMain.
 * [configure] permite agregar plugins (por ejemplo Auth) sin duplicar la base.
 */
fun createHttpClient(
    baseUrl: String,
    configure: HttpClientConfig<*>.() -> Unit = {},
): HttpClient = HttpClient {
    install(ContentNegotiation) { json(KestaJson) }
    install(HttpTimeout) {
        requestTimeoutMillis = 15_000
        connectTimeoutMillis = 10_000
    }
    defaultRequest {
        url(baseUrl)
        contentType(ContentType.Application.Json)
    }
    configure()
}
