package com.kesta.app.ui.auth

import com.kesta.app.core.error.AppError
import com.kesta.app.core.error.asAppError
import com.kesta.app.core.ui.mensaje

/** En el inicio de sesion, 401 significa credenciales incorrectas. */
internal fun Throwable.mensajeLogin(): String = when (val error = asAppError()) {
    AppError.NoAutorizado -> "Correo o contraseña incorrectos."
    else -> error.mensaje()
}

/** En el registro, 409 significa que el correo ya tiene cuenta. */
internal fun Throwable.mensajeRegistro(): String = when (val error = asAppError()) {
    AppError.Conflicto -> "Ya existe una cuenta con ese correo."
    AppError.NoAutorizado -> "No se pudo iniciar sesión con la cuenta nueva."
    else -> error.mensaje()
}
