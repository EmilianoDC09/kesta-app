package com.kesta.app.core.config

/**
 * URL base del backend. Debe terminar en "/" para que Ktor resuelva
 * rutas relativas ("ciudades" -> .../api/v1/ciudades).
 *
 * Android emulador: 10.0.2.2 es el alias de la maquina anfitriona.
 * iOS simulador: localhost funciona porque comparte red con el Mac.
 * Dispositivo fisico: usar la IP de la LAN. La tarea 6.5 la vuelve
 * configurable por compilacion (desarrollo / servidor del piloto).
 */
expect fun defaultApiBaseUrl(): String
