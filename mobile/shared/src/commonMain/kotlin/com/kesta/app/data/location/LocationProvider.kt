package com.kesta.app.data.location

/** Una dirección lista para mostrar, ejemplo: "Calle Fresa 9" y debajo "58218 Morelia, Michoacán". */
data class Direccion(
    val titulo: String,
    val detalle: String,
)

/**
 * Pregunta de la app: "¿dónde está el usuario?".
 * Android usa el GPS real; si el usuario niega el permiso devuelve fallo y la app usa el centro de Morelia.
 */
interface LocationProvider {
    suspend fun ubicacionActual(): Result<Location>

    /** La calle y colonia de un punto. Devuelve null si no se puede saber. */
    suspend fun direccionDe(punto: Location): Direccion? = null
}
