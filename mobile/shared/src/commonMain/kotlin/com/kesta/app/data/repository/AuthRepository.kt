package com.kesta.app.data.repository

import com.kesta.app.domain.model.Sesion

/** Registro, inicio y cierre de sesión */
interface AuthRepository {
    suspend fun registrar(
        nombre: String,
        correo: String,
        contrasena: String,
        ciudadId: Int,
    ): Result<Sesion>

    suspend fun iniciarSesion(correo: String, contrasena: String): Result<Sesion>

    suspend fun cerrarSesion(): Result<Unit>

    /** Devuelve la sesión guardada, o null (dentro de Success) si no hay ninguna. */
    suspend fun sesionActual(): Result<Sesion?>
}