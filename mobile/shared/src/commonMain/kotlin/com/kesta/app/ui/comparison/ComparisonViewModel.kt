package com.kesta.app.ui.comparison

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.core.error.AppError
import com.kesta.app.core.error.asAppError
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.comparison.Comparacion
import com.kesta.app.data.comparison.PriceRepository
import com.kesta.app.data.location.Location
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Comparación formal vs. informal de una presentación. Estados: Idle (nada pedido), Loading,
 * Success (con precios), Empty (ningún comercio con precio en la zona) y Error.
 *
 * Cuando falta un canal NO es un error: llega como Success y la comparación indica cuál falta
 * ([Comparacion.canalSinPrecios]) para que la pantalla avise en lugar de mostrar un ahorro.
 *
 * Además de comparar una presentación ([cargar]), puede comparar varias a la vez ([cargarListado]),
 * que es lo que necesita "Mayor ahorro": una tarjeta por producto encontrado.
 */
class ComparisonViewModel(
    private val repository: PriceRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<Comparacion>>(UiState.Idle)
    val state: StateFlow<UiState<Comparacion>> = _state.asStateFlow()

    /** Comparaciones de varias presentaciones a la vez, por id de presentación. Empty = no hay qué comparar. */
    private val _listado = MutableStateFlow<UiState<Map<Int, Comparacion>>>(UiState.Idle)
    val listado: StateFlow<UiState<Map<Int, Comparacion>>> = _listado.asStateFlow()

    private data class ConsultaListado(val ids: List<Int>, val origen: Location, val radioKm: Int)

    private var cargaListado: Job? = null
    private var ultimaListado: ConsultaListado? = null

    private data class Consulta(val presentacionId: Int, val origen: Location, val radioKm: Int)

    private var carga: Job? = null
    private var ultima: Consulta? = null

    /**
     * Carga la comparación. Si ya se pidió exactamente lo mismo y no falló, no se repite
     * (por ejemplo, al girar la pantalla). Para forzar una nueva carga, usa [actualizar].
     */
    fun cargar(presentacionId: Int, origen: Location, radioKm: Int) {
        val consulta = Consulta(presentacionId, origen, radioKm)
        if (consulta == ultima && _state.value !is UiState.Error) return
        lanzar(consulta)
    }

    /** Vuelve a pedir la última comparación: sirve para "Reintentar" y para refrescar. */
    fun actualizar() {
        ultima?.let { lanzar(it) }
    }

    /**
     * Compara varias presentaciones a la vez. Una que falle se omite; solo es error si fallan todas.
     * Si ya se pidió exactamente lo mismo y no falló, no se repite.
     */
    fun cargarListado(presentacionIds: List<Int>, origen: Location, radioKm: Int) {
        val consulta = ConsultaListado(presentacionIds.distinct(), origen, radioKm)
        if (consulta == ultimaListado && _listado.value !is UiState.Error) return
        ultimaListado = consulta
        cargaListado?.cancel()
        if (consulta.ids.isEmpty()) {
            _listado.value = UiState.Empty
            return
        }
        _listado.value = UiState.Loading
        cargaListado = viewModelScope.launch {
            val intentos = coroutineScope {
                consulta.ids.map { id ->
                    async { id to repository.comparar(id, consulta.origen, consulta.radioKm) }
                }.awaitAll()
            }
            val exitosas = intentos.mapNotNull { (id, r) -> r.getOrNull()?.let { id to it } }.toMap()
            val falla = intentos.firstNotNullOfOrNull { (_, r) -> r.exceptionOrNull() }
            _listado.value = when {
                exitosas.isNotEmpty() -> UiState.Success(exitosas)
                falla != null -> UiState.Error(falla.asAppError().mensajeComparacion())
                else -> UiState.Empty
            }
        }
    }

    /** "Reintentar" para el listado. */
    fun reintentarListado() {
        val u = ultimaListado ?: return
        ultimaListado = null
        cargarListado(u.ids, u.origen, u.radioKm)
    }

    private fun lanzar(consulta: Consulta) {
        carga?.cancel()
        ultima = consulta
        _state.value = UiState.Loading
        carga = viewModelScope.launch {
            repository.comparar(consulta.presentacionId, consulta.origen, consulta.radioKm).fold(
                onSuccess = { comparacion ->
                    _state.value = if (comparacion.comercios.isEmpty()) UiState.Empty else UiState.Success(comparacion)
                },
                onFailure = { e ->
                    _state.value = UiState.Error(e.asAppError().mensajeComparacion())
                },
            )
        }
    }
}

private fun AppError.mensajeComparacion(): String = when (this) {
    AppError.SinConexion -> "Sin conexión. Revisa tu internet e inténtalo de nuevo."
    AppError.NoEncontrado -> "Este producto ya no está disponible."
    is AppError.Validacion -> "No se pudo calcular la comparación con esa ubicación o ese radio."
    is AppError.Servidor -> "El servidor tuvo un problema. Inténtalo en unos minutos."
    AppError.RespuestaInvalida -> "El servidor respondió algo inesperado."
    else -> "No se pudo cargar la comparación."
}