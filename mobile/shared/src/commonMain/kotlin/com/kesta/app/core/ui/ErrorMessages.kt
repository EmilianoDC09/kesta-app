package com.kesta.app.core.ui

import com.kesta.app.core.error.AppError

/**
 * Mensaje por defecto para cada error. Una pantalla puede dar un texto mas
 * especifico para su caso (ver ui/auth/AuthMessages.kt) y delegar aqui el resto.
 */
fun AppError.mensaje(): String = when (this) {
    AppError.SinConexion -> "No se pudo conectar con el servidor. Revisa tu conexión."
    AppError.NoAutorizado -> "Tu sesión terminó. Inicia sesión de nuevo."
    AppError.SinPermiso -> "No tienes permiso para realizar esta acción."
    AppError.NoEncontrado -> "No se encontró lo que buscabas."
    AppError.Conflicto -> "Ese registro ya existe."
    is AppError.Validacion -> mensajeServidor ?: "Revisa los datos e intenta de nuevo."
    is AppError.Servidor -> mensajeServidor ?: "Error del servidor ($codigo). Intenta más tarde."
    AppError.RespuestaInvalida -> "El servidor respondió en un formato inesperado."
    AppError.AlmacenamientoLocal -> "No se pudo guardar la información en el dispositivo."
    AppError.Desconocido -> "Ocurrió un error inesperado."
}
