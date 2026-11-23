package com.kesta.app.data.location

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember

/*
 * PARTE iOS DE LA UBICACIÓN
 * PENDIENTE: cuando se quiera ubicación real en iPhone, aquí se implementa con CoreLocation
 * (la herramienta de ubicación de Apple) y se reemplazan estas dos versiones simples.
 * iOS todavía no tiene ubicación real: siempre se usa el centro de Morelia.
 */

/** Permiso de ubicación de iOS: por ahora "falso" */
private object PermisoUbicacionIos : PermisoUbicacion {
    override fun concedido() = false
    override fun yaSePregunto() = true
    override fun solicitar() = Unit
}

/**
 * Proveedor de ubicación de iOS: siempre responde "el usuario está en el centro de Morelia".
 */
private class CentroMoreliaIos : LocationProvider {
    override suspend fun ubicacionActual(): Result<Location> =
        Result.success(Location.CENTRO_MORELIA)
}

@Composable
actual fun rememberPermisoUbicacion(onResultado: (Boolean) -> Unit): PermisoUbicacion = PermisoUbicacionIos

@Composable
actual fun rememberLocationProvider(): LocationProvider = remember { CentroMoreliaIos() }