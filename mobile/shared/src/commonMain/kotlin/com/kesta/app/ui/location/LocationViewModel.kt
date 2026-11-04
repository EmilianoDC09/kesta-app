package com.kesta.app.ui.location

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.core.location.LocationProvider
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.CatalogRepository
import com.kesta.app.domain.model.Ciudad
import com.kesta.app.domain.model.Ubicacion
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Lo que la pantalla de "ciudad y radio" necesita saber.
 *  - [ciudades]: lista de ciudades disponibles.
 *  - [ciudadElegida]: la ciudad que el usuario tocó (null si usa su GPS o aún no elige).
 *  - [ubicacion]: el punto desde donde se buscan precios (GPS o centro de la ciudad).
 *  - [radioKm]: qué tan lejos se buscan comercios.
 */
data class LocationUiState(
    val ciudades: UiState<List<Ciudad>> = UiState.Idle,
    val ciudadElegida: Ciudad? = null,
    val ubicacion: UiState<Ubicacion> = UiState.Idle,
    val radioKm: Int = 5,
)

class LocationViewModel(
    private val catalogo: CatalogRepository,
    private val proveedorUbicacion: LocationProvider,
) : ViewModel() {

    private val _state = MutableStateFlow(LocationUiState())
    val state: StateFlow<LocationUiState> = _state.asStateFlow()

    fun cargarCiudades() {
        if (_state.value.ciudades is UiState.Loading) return
        _state.update { it.copy(ciudades = UiState.Loading) }
        viewModelScope.launch {
            catalogo.ciudades().fold(
                onSuccess = { lista ->
                    _state.update {
                        it.copy(ciudades = if (lista.isEmpty()) UiState.Empty else UiState.Success(lista))
                    }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(ciudades = UiState.Error(e.message ?: "No se pudieron cargar las ciudades"))
                    }
                },
            )
        }
    }

    /** Pide la ubicación del dispositivo (GPS). */
    fun usarUbicacionActual() {
        if (_state.value.ubicacion is UiState.Loading) return
        _state.update { it.copy(ubicacion = UiState.Loading) }
        viewModelScope.launch {
            proveedorUbicacion.ubicacionActual().fold(
                onSuccess = { punto ->
                    _state.update { it.copy(ciudadElegida = null, ubicacion = UiState.Success(punto)) }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(ubicacion = UiState.Error(e.message ?: "No se pudo obtener tu ubicación"))
                    }
                },
            )
        }
    }

    /** El usuario elige una ciudad: se busca desde el centro de esa ciudad. */
    fun elegirCiudad(ciudad: Ciudad) {
        _state.update {
            it.copy(ciudadElegida = ciudad, ubicacion = UiState.Success(ciudad.centro))
        }
    }

    /** Cambia el radio de búsqueda. Se mantiene entre 1 y 50 km (el máximo que acepta el servidor). */
    fun cambiarRadio(km: Int) {
        _state.update { it.copy(radioKm = km.coerceIn(RADIO_MIN_KM, RADIO_MAX_KM)) }
    }

    private companion object {
        const val RADIO_MIN_KM = 1
        const val RADIO_MAX_KM = 50
    }
}
