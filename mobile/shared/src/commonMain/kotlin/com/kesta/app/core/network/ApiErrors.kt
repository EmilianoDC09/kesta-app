package com.kesta.app.core.network

import com.kesta.app.core.error.AppError
import com.kesta.app.core.error.AppException
import io.ktor.client.call.body
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.coroutines.cancellation.CancellationException

/**
 * Ejecuta una peticion y unifica el manejo de errores para todos los repositorios:
 * - sin respuesta (red, timeout)  -> AppError.SinConexion
 * - respuesta con codigo de error -> AppError segun el codigo HTTP
 * - 2xx                           -> la respuesta, para que el repositorio lea el cuerpo
 */
suspend fun safeRequest(block: suspend () -> HttpResponse): Result<HttpResponse> {
    val response = try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        return Result.failure(AppException(AppError.SinConexion))
    }
    return if (response.status.isSuccess()) {
        Result.success(response)
    } else {
        Result.failure(AppException(response.toAppError()))
    }
}

suspend fun HttpResponse.toAppError(): AppError {
    val mensaje = mensajeDeError()
    return when (status.value) {
        401 -> AppError.NoAutorizado
        403 -> AppError.SinPermiso
        404 -> AppError.NoEncontrado
        409 -> AppError.Conflicto
        400, 422 -> AppError.Validacion(mensaje)
        else -> AppError.Servidor(status.value, mensaje)
    }
}

/** Lee el cuerpo como T, o null si no tiene el formato esperado. */
suspend inline fun <reified T> HttpResponse.bodyOrNull(): T? = try {
    body<T>()
} catch (e: CancellationException) {
    throw e
} catch (e: Exception) {
    null
}

/**
 * Intenta leer el mensaje de error que manda el backend.
 * Acepta {"mensaje": "..."}, {"message": "..."} o {"error": "..."}.
 */
suspend fun HttpResponse.mensajeDeError(): String? = try {
    val obj = KestaJson.parseToJsonElement(bodyAsText()) as? JsonObject
    obj?.let {
        listOf("mensaje", "message", "error").firstNotNullOfOrNull { clave ->
            (it[clave] as? JsonPrimitive)?.takeIf { p -> p.isString }?.content
        }
    }
} catch (e: CancellationException) {
    throw e
} catch (e: Exception) {
    null
}
