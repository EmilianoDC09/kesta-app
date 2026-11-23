package com.kesta.app.ui.location

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.data.location.Direccion
import com.kesta.app.data.location.Location
import com.kesta.app.data.location.LocationProvider
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** De dónde sale el punto desde el que se busca. */
enum class OrigenUbicacion { CENTRO_MORELIA, UBICACION_ACTUAL }

/** Desde dónde se busca y a qué distancia. */
data class LocationUiState(
    /** Empieza en el centro de Morelia y cambia a la del teléfono si el usuario lo permite. */
    val ubicacion: Location = Location.CENTRO_MORELIA,
    val origen: OrigenUbicacion = OrigenUbicacion.CENTRO_MORELIA,
    /** Calle y número de la ubicación del teléfono (null si todavía no se sabe o no hay internet). */
    val direccion: Direccion? = null,
    /** true mientras se espera la respuesta del GPS. */
    val buscando: Boolean = false,
    val radioKm: Int = LocationViewModel.RADIO_INICIAL_KM,
)

/**
 * Ubicación del usuario y radio de búsqueda, compartidos por la búsqueda y la comparación.
 * Si no se puede obtener la ubicación (permiso negado, GPS apagado o sin señal), se usa el
 * centro de Morelia, como pide el contrato.
 */
class LocationViewModel(
    private val provider: LocationProvider,
) : ViewModel() {

    private val _state = MutableStateFlow(LocationUiState())
    val state: StateFlow<LocationUiState> = _state.asStateFlow()

    private var arrancado = false

    /**
     * Al abrir la app con el permiso ya concedido se arranca en la ubicación del teléfono.
     * Solo funciona una vez: si el usuario después elige el centro, girar la pantalla no lo cambia.
     */
    fun arrancarConUbicacionActual() {
        if (arrancado) return
        arrancado = true
        usarUbicacionActual()
    }

    /** Pide la ubicación del teléfono; si falla, el usuario se queda en el centro de Morelia. */
    fun usarUbicacionActual() {
        arrancado = true
        _state.update { it.copy(buscando = true) }
        viewModelScope.launch {
            val resultado = provider.ubicacionActual()
            _state.update { actual ->
                val punto = resultado.getOrNull()
                if (punto != null) {
                    actual.copy(
                        ubicacion = punto,
                        origen = OrigenUbicacion.UBICACION_ACTUAL,
                        direccion = null,
                        buscando = false,
                    )
                } else {
                    actual.copy(
                        ubicacion = Location.CENTRO_MORELIA,
                        origen = OrigenUbicacion.CENTRO_MORELIA,
                        direccion = null,
                        buscando = false,
                    )
                }
            }
            // La calle llega un poco después; mientras tanto el encabezado ya muestra algo.
            val punto = resultado.getOrNull() ?: return@launch
            val direccion = provider.direccionDe(punto)
            _state.update { if (it.ubicacion == punto) it.copy(direccion = direccion) else it }
        }
    }

    /** El usuario eligió buscar desde el centro de Morelia. */
    fun usarCentroDeMorelia() {
        arrancado = true
        _state.update {
            it.copy(ubicacion = Location.CENTRO_MORELIA, origen = OrigenUbicacion.CENTRO_MORELIA, buscando = false)
        }
    }

    /** El servidor acepta de 1 a 50 km; fuera de ese rango se ajusta al límite más cercano. */
    fun cambiarRadio(km: Int) {
        _state.update { it.copy(radioKm = km.coerceIn(RADIO_MIN_KM, RADIO_MAX_KM)) }
    }

    companion object {
        const val RADIO_INICIAL_KM = 3
        const val RADIO_MIN_KM = 1
        const val RADIO_MAX_KM = 50
    }
}