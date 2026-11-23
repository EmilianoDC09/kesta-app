package com.kesta.app.data.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Geocoder
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import androidx.core.os.CancellationSignal
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import kotlin.coroutines.resume

/**
 * Obtiene la ubicación real del teléfono con el servicio de ubicación de Android
 * Si no hay permiso, el servicio está apagado o no responde a tiempo, devuelve fallo
 * y la app se queda en el centro de Morelia.
 */
class AndroidLocationProvider(private val context: Context) : LocationProvider {

    @SuppressLint("MissingPermission") // El permiso se revisa en la primera línea.
    override suspend fun ubicacionActual(): Result<Location> {
        if (!tienePermisoDeUbicacion(context)) {
            return Result.failure(SecurityException("Sin permiso de ubicación"))
        }
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return Result.failure(IllegalStateException("Sin servicio de ubicación"))

        // Con ubicación "aproximada" solo funciona la red; con "precisa", primero el GPS.
        val proveedores = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { runCatching { manager.isProviderEnabled(it) }.getOrDefault(false) }

        for (proveedor in proveedores) {
            val punto = runCatching {
                withTimeoutOrNull(TIEMPO_MAXIMO_MS) { pedirUnaVez(manager, proveedor) }
            }.getOrNull()
            if (punto != null) return Result.success(Location(punto.latitude, punto.longitude))
        }

        // Último intento: la última ubicación que el teléfono recuerda.
        val recordada = proveedores.firstNotNullOfOrNull { proveedor ->
            runCatching { manager.getLastKnownLocation(proveedor) }.getOrNull()
        }
        return if (recordada != null) {
            Result.success(Location(recordada.latitude, recordada.longitude))
        } else {
            Result.failure(IllegalStateException("No se pudo obtener la ubicación"))
        }
    }

    /** Convierte las coordenadas en calle y número con el servicio de direcciones de Android. */
    override suspend fun direccionDe(punto: Location): Direccion? = withContext(Dispatchers.IO) {
        runCatching {
            if (!Geocoder.isPresent()) return@runCatching null
            val geocoder = Geocoder(context, Locale("es", "MX"))
            val resultados: List<android.location.Address> = withTimeoutOrNull(TIEMPO_MAXIMO_MS) {
                if (Build.VERSION.SDK_INT >= 33) {
                    suspendCancellableCoroutine { continuacion ->
                        geocoder.getFromLocation(punto.lat, punto.lng, 1, object : Geocoder.GeocodeListener {
                            override fun onGeocode(addresses: MutableList<android.location.Address>) {
                                if (continuacion.isActive) continuacion.resume(addresses)
                            }

                            override fun onError(errorMessage: String?) {
                                if (continuacion.isActive) continuacion.resume(emptyList())
                            }
                        })
                    }
                } else {
                    @Suppress("DEPRECATION")
                    geocoder.getFromLocation(punto.lat, punto.lng, 1).orEmpty()
                }
            }.orEmpty()
            val a = resultados.firstOrNull() ?: return@runCatching null

            val calle = listOfNotNull(a.thoroughfare, a.subThoroughfare).joinToString(" ")
                .ifBlank { a.featureName.orEmpty() }
                .ifBlank { a.getAddressLine(0).orEmpty().substringBefore(",") }
            val ciudad = listOfNotNull(a.postalCode, a.locality ?: a.subAdminArea)
                .joinToString(" ")
            val detalle = listOf(ciudad, a.adminArea.orEmpty()).filter { it.isNotBlank() }.joinToString(", ")
            if (calle.isBlank()) null else Direccion(calle, detalle)
        }.getOrNull()
    }

    @SuppressLint("MissingPermission")
    private suspend fun pedirUnaVez(manager: LocationManager, proveedor: String): android.location.Location? =
        suspendCancellableCoroutine { continuacion ->
            val senal = CancellationSignal()
            continuacion.invokeOnCancellation { senal.cancel() }
            LocationManagerCompat.getCurrentLocation(
                manager,
                proveedor,
                senal,
                ContextCompat.getMainExecutor(context),
            ) { ubicacion -> if (continuacion.isActive) continuacion.resume(ubicacion) }
        }

    private companion object {
        const val TIEMPO_MAXIMO_MS = 8_000L
    }
}