package com.kesta.app.ui.comparison

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.PriceRepository
import com.kesta.app.domain.model.Comparacion
import com.kesta.app.domain.model.Ubicacion
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Estado de la pantalla de comparación formal vs. informal. */
data class ComparisonUiState(
    val comparacion: UiState<Comparacion> = UiState.Idle,
)

class ComparisonViewModel(
    private val precios: PriceRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ComparisonUiState())
    val state: StateFlow<ComparisonUiState> = _state.asStateFlow()

    private var comparacionActual: Job? = null

    /**
     * Compara los precios de una presentación cerca de [ubicacion].
     * Si no hay ningún comercio con precio dentro del radio, el resultado es "vacío".
     */
    fun comparar(presentacionId: Int, ubicacion: Ubicacion, radioKm: Int) {
        if (radioKm <= 0) {
            _state.update { it.copy(comparacion = UiState.Error("El radio debe ser mayor que cero")) }
            return
        }
        _state.update { it.copy(comparacion = UiState.Loading) }
        comparacionActual?.cancel()
        comparacionActual = viewModelScope.launch {
            precios.comparar(presentacionId, ubicacion, radioKm).fold(
                onSuccess = { resultado ->
                    _state.update {
                        it.copy(
                            comparacion = if (resultado.comercios.isEmpty()) {
                                UiState.Empty
                            } else {
                                UiState.Success(resultado)
                            },
                        )
                    }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(comparacion = UiState.Error(e.message ?: "No se pudo comparar los precios"))
                    }
                },
            )
        }
    }
}