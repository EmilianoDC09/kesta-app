package com.kesta.app.data.repository.fake

import com.kesta.app.data.repository.AuthRepository
import com.kesta.app.domain.model.Sesion
import com.kesta.app.domain.model.Usuario

/**
 * Sesión de mentira. Cuenta de prueba.
 * Registrar un correo que ya existe falla, y una contraseña incorrecta también
 */
class FakeAuthRepository(
    cuentasIniciales: Map<String, String> = mapOf(FakeData.CORREO_DEMO to FakeData.CONTRASENA_DEMO),
    sesionInicial: Sesion? = null,
    private val fallo: Throwable? = null,
    private val retrasoMs: Long = 0,
) : AuthRepository {

    private val cuentas = cuentasIniciales.mapKeys { it.key.lowercase() }.toMutableMap()
    private var sesion: Sesion? = sesionInicial

    override suspend fun registrar(
        nombre: String,
        correo: String,
        contrasena: String,
        ciudadId: Int,
    ): Result<Sesion> = respuestaSimulada(retrasoMs, fallo) {
        val clave = correo.trim().lowercase()
        if (cuentas.containsKey(clave)) {
            Result.failure(Exception("Ese correo ya está registrado"))
        } else {
            cuentas[clave] = contrasena
            val nueva = Sesion(
                Usuario(
                    id = cuentas.size,
                    nombre = nombre,
                    ciudadId = ciudadId,
                    radioKmPorDefecto = 5,
                    rol = "usuario",
                ),
            )
            sesion = nueva
            Result.success(nueva)
        }
    }

    override suspend fun iniciarSesion(
        correo: String,
        contrasena: String
    ): Result<Sesion> =
        respuestaSimulada(retrasoMs, fallo) {
            val clave = correo.trim().lowercase()
            if (cuentas[clave] != contrasena) {
                Result.failure(Exception("Correo o contraseña incorrectos"))
            } else {
                val activa = Sesion(
                    Usuario(
                        id = 1,
                        nombre = "Ana",
                        ciudadId = 1,
                        radioKmPorDefecto = 5,
                        rol = "usuario",
                    ),
                )
                sesion = activa
                Result.success(activa)
            }
        }

    override suspend fun cerrarSesion(): Result<Unit> = respuestaSimulada(retrasoMs, fallo) {
        sesion = null
        Result.success(Unit)
    }

    override suspend fun sesionActual(): Result<Sesion?> =
        respuestaSimulada(retrasoMs, fallo) { Result.success(sesion) }
}