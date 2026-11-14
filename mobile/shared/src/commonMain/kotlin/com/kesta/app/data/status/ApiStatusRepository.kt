package com.kesta.app.data.status

import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess

/** Resultado minimo de una prueba de conectividad contra el backend. */
data class ApiStatus(val httpCode: Int, val bytes: Int)

/**
 * Interfaz de repositorio: el ViewModel depende de esto, no de Ktor.
 * La implementacion de prueba (FakeApiStatusRepository) vive en commonTest.
 */
interface ApiStatusRepository {
    suspend fun check(): Result<ApiStatus>
}

class KtorApiStatusRepository(private val client: HttpClient) : ApiStatusRepository {
    // CAT-01 es publico: GET /ciudades. Solo comprueba conectividad;
    // el modelo real de ciudades se define en 6.5.
    override suspend fun check(): Result<ApiStatus> = runCatching {
        val response = client.get("ciudades")
        if (!response.status.isSuccess()) {
            error("El servidor respondio ${response.status.value}")
        }
        ApiStatus(response.status.value, response.bodyAsText().length)
    }
}
