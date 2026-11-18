package com.kesta.app.core.config

/**
 * URL base por defecto de cada plataforma, usada si nadie llama a [ApiConfig.configure].
 */
expect fun defaultApiBaseUrl(): String

/**
 * URL base del backend, configurable por compilacion (contrato 6.5).
 *
 * Android: KestaApplication la toma de BuildConfig.API_BASE_URL, que se define por
 * tipo de compilacion en androidApp/build.gradle.kts (debug = PC de desarrollo,
 * release = servidor del piloto).
 * iOS: usa [defaultApiBaseUrl] hasta que se configure desde el proyecto de Xcode.
 */
object ApiConfig {
    private var configured: String? = null

    /** Debe llamarse antes del primer uso de la red (al arrancar la app). */
    fun configure(baseUrl: String) {
        // Ktor necesita la "/" final para resolver rutas relativas ("ciudades").
        configured = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
    }

    val baseUrl: String
        get() = configured ?: defaultApiBaseUrl()
}
