package com.kesta.app.ui.auth

internal object Validaciones {
    private val correoRegex = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
    const val MIN_CONTRASENA = 8

    fun correo(valor: String): String? = when {
        valor.isBlank() -> "Ingresa tu correo."
        !correoRegex.matches(valor.trim()) -> "Correo no válido."
        else -> null
    }

    fun nombre(valor: String): String? =
        if (valor.trim().length < 2) "Ingresa tu nombre." else null

    fun contrasenaNueva(valor: String): String? =
        if (valor.length < MIN_CONTRASENA) "Mínimo $MIN_CONTRASENA caracteres." else null
}
