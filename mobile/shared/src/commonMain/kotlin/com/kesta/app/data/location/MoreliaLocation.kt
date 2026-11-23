package com.kesta.app.data.location

/**
 * Ubicación provisional: siempre el centro de Morelia. Sirve mientras no exista el GPS real de cada
 * plataforma; cuando exista, solo hay que cambiar la línea de AppContainer que crea el LocationProvider.
 */
class MoreliaLocation: LocationProvider {
    override suspend fun ubicacionActual(): Result<Location> = Result.success(Location.CENTRO_MORELIA)
}
