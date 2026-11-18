package com.kesta.app.core.config

/**
 * Valor de respaldo. En la app la URL real llega por BuildConfig.API_BASE_URL
 * (ver androidApp/build.gradle.kts y KestaApplication).
 *
 * Desarrollo con telefono o emulador por USB:  adb reverse tcp:3000 tcp:3000
 */
actual fun defaultApiBaseUrl(): String = "http://localhost:3000/api/v1/"
