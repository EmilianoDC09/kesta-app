package com.kesta.app.data.auth

import kotlinx.serialization.Serializable

@Serializable
data class Usuario(
    val id: Int,
    val nombre: String,
    val correo: String,
    val rol: String,
    val ciudadId: Int? = null,
)

/** Respuesta de POST /auth/login y POST /auth/registro. */
@Serializable
data class AuthResponse(
    val usuario: Usuario,
    val accessToken: String,
    val refreshToken: String,
    val expiraEnSegundos: Int? = null,
)

/** Respuesta de POST /auth/renovar. */
@Serializable
data class TokensResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiraEnSegundos: Int? = null,
)

@Serializable
data class LoginRequest(val correo: String, val contrasena: String)

@Serializable
data class RegistroRequest(
    val nombre: String,
    val correo: String,
    val contrasena: String,
    val ciudadId: Int,
)

@Serializable
data class RefreshRequest(val refreshToken: String)

/** Lo que se guarda en el telefono para mantener la sesion. */
@Serializable
data class StoredSession(
    val accessToken: String,
    val refreshToken: String,
    val usuario: Usuario,
)
