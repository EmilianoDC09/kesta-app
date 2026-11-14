package com.kesta.app

import android.app.Application
import com.kesta.app.platform.KestaAndroid

class KestaApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Context para el almacenamiento de la sesion y URL del backend segun la compilacion.
        KestaAndroid.init(this, BuildConfig.API_BASE_URL)
    }
}
