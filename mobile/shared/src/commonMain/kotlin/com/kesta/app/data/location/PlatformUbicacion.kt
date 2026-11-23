package com.kesta.app.data.location

import androidx.compose.runtime.Composable

/**
 * El permiso de ubicación del teléfono, cada plataforma lo maneja distinto,
 * por eso aquí solo se declara qué se necesita y Android/iOS lo implementan por su cuenta.
 */
interface PermisoUbicacion {
    /** ¿El usuario ya nos dio permiso de usar su ubicación? */
    fun concedido(): Boolean

    /** ¿Ya le mostramos la ventana de permiso alguna vez? */
    fun yaSePregunto(): Boolean

    /** Muestra la ventana del sistema pidiendo el permiso. El resultado llega a `onResultado`. */
    fun solicitar()
}

/** [onResultado] recibe true si el usuario aceptó y false si lo negó. */
@Composable
expect fun rememberPermisoUbicacion(onResultado: (Boolean) -> Unit): PermisoUbicacion

/** El proveedor que obtiene la ubicación real del teléfono (GPS) en cada plataforma. */
@Composable
expect fun rememberLocationProvider(): LocationProvider