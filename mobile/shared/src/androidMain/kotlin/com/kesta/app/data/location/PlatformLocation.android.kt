package com.kesta.app.data.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.ManagedActivityResultLauncher
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat

/**
    Los dos permisos de ubicación de Android:
    - FINE: ubicación precisa (GPS).
    - COARSE: ubicación aproximada (antenas y Wi-Fi).
 */
private val PERMISOS = arrayOf(
    Manifest.permission.ACCESS_FINE_LOCATION,
    Manifest.permission.ACCESS_COARSE_LOCATION,
)

/** Indica si el teléfono tiene permiso de ubicación. */
internal fun tienePermisoDeUbicacion(context: Context): Boolean =
    PERMISOS.any { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }

/* Implementación Android del permiso de ubicación.*/
private class AndroidPermisoUbicacion(
    private val context: Context,
    private val lanzador: ManagedActivityResultLauncher<Array<String>, Map<String, Boolean>>,
) : PermisoUbicacion {

    // Aquí solo se guarda si ya se mostró la ventana de permiso.
    private val preferencias = context.getSharedPreferences("kesta_ubicacion", Context.MODE_PRIVATE)

    override fun concedido() = tienePermisoDeUbicacion(context)

    // Sirve para pedirlo SOLO la primera vez que se abre la app después de instalarla.
    override fun yaSePregunto() = preferencias.getBoolean(CLAVE_YA_SE_PREGUNTO, false)

    // Muestra la ventana del sistema para pedir el permiso. */
    override fun solicitar() {
        // Se anota antes de mostrar la ventana: así solo se pide sola la primera vez.
        preferencias.edit().putBoolean(CLAVE_YA_SE_PREGUNTO, true).apply()
        lanzador.launch(PERMISOS)
    }

    private companion object {
        // Nombre con el que se guarda el dato en las preferencias.
        const val CLAVE_YA_SE_PREGUNTO = "ya_se_pregunto"
    }
}

/**
 * Crea el objeto que maneja el permiso, la cual se usa dentro de una pantalla (MainFlow).
 *
 * @param onResultado se llama cuando el usuario responde la ventana del sistema:
 *   true si aceptó el permiso y false si lo negó.
 */
@Composable
actual fun rememberPermisoUbicacion(onResultado: (Boolean) -> Unit): PermisoUbicacion {
    val context = LocalContext.current.applicationContext
    val alResponder = rememberUpdatedState(onResultado)
    val lanzador = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { respuesta ->
        alResponder.value(respuesta.values.any { it })
    }
    return remember(context, lanzador) { AndroidPermisoUbicacion(context, lanzador) }
}

/**
 * Crea el proveedor que obtiene la ubicación real del teléfono (GPS) y la dirección en texto.
 * La lógica está en AndroidLocationProvider; aquí solo se le entrega el contexto de la app.
 */
@Composable
actual fun rememberLocationProvider(): LocationProvider {
    val context = LocalContext.current.applicationContext
    return remember(context) { AndroidLocationProvider(context) }
}