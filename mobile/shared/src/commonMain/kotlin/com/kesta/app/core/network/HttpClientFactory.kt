package com.kesta.app.core.network

import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * El motor (OkHttp en Android, Darwin en iOS) se resuelve solo segun
 * las dependencias declaradas en androidMain / iosMain.
 */
fun createHttpClient(baseUrl: String): HttpClient = HttpClient {
    install(ContentNegotiation) {
        json(
            Json {
                ignoreUnknownKeys = true
                isLenient = true
                explicitNulls = false
            }
        )
    }
    install(HttpTimeout) {
        requestTimeoutMillis = 15_000
        connectTimeoutMillis = 10_000
    }
    defaultRequest {
        url(baseUrl)
        contentType(ContentType.Application.Json)
    }
}
