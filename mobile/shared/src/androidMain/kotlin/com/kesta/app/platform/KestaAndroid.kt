package com.kesta.app.platform

import android.content.Context
import com.kesta.app.core.config.ApiConfig

/**
 * Punto de arranque del codigo compartido en Android.
 * Se llama UNA vez desde KestaApplication.onCreate, no desde una Activity:
 * asi tambien funciona cuando el proceso arranca sin pantalla
 * (por ejemplo, el servicio de notificaciones push de FCM).
 */
object KestaAndroid {
    private var appContext: Context? = null

    fun init(context: Context, apiBaseUrl: String? = null) {
        appContext = context.applicationContext
        apiBaseUrl?.let(ApiConfig::configure)
    }

    internal val context: Context
        get() = checkNotNull(appContext) {
            "Falta KestaAndroid.init(...) en KestaApplication.onCreate."
        }
}
