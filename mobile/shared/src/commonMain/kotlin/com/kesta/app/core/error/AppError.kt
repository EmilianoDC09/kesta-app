package com.kesta.app.core.error

/**
 * Errores que la capa de datos entrega a la UI. Los repositorios NO devuelven
 * textos de pantalla: devuelven un AppError y cada pantalla decide el mensaje
 * (ver core/ui/ErrorMessages.kt y los mapeos propios de cada funcionalidad).
 */
sealed interface AppError {
    /** Sin red, timeout o servidor apagado: no hubo respuesta. */
    data object SinConexion : AppError

    /** 401: credenciales invalidas o sesion terminada. */
    data object NoAutorizado : AppError

    /** 403: el usuario no tiene permiso para esa operacion. */
    data object SinPermiso : AppError

    /** 404. */
    data object NoEncontrado : AppError

    /** 409: el recurso ya existe (por ejemplo, correo ya registrado). */
    data object Conflicto : AppError

    /** 400 / 422: el servidor rechazo los datos enviados. */
    data class Validacion(val mensajeServidor: String?) : AppError

    /** Cualquier otro codigo de error (5xx, 429...). */
    data class Servidor(val codigo: Int, val mensajeServidor: String?) : AppError

    /** La respuesta fue 2xx pero no tiene el formato esperado. */
    data object RespuestaInvalida : AppError

    /** No se pudo leer o escribir en el almacenamiento del dispositivo. */
    data object AlmacenamientoLocal : AppError

    data object Desconocido : AppError
}

class AppException(val error: AppError) : Exception(error.toString())

fun Throwable.asAppError(): AppError = (this as? AppException)?.error ?: AppError.Desconocido
