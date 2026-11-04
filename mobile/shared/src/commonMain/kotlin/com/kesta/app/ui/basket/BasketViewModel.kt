package com.kesta.app.ui.basket

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.BasketRepository
import com.kesta.app.domain.model.Canasta
import com.kesta.app.domain.model.OptimizacionCanasta
import com.kesta.app.domain.model.Ubicacion
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch


data class BasketUiState(
    val canastas: UiState<List<Canasta>> = UiState.Idle,
    val detalle: UiState<Canasta> = UiState.Idle,
    val optimizacion: UiState<OptimizacionCanasta> = UiState.Idle,
    val accion: UiState<Unit> = UiState.Idle,
)

class BasketViewModel(
    private val canastasRepo: BasketRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(BasketUiState())
    val state: StateFlow<BasketUiState> = _state.asStateFlow()

    private var aperturaActual: Job? = null
    private var optimizacionActual: Job? = null

    // lectura

    fun cargarCanastas() {
        if (_state.value.canastas is UiState.Loading) return
        _state.update { it.copy(canastas = UiState.Loading) }
        viewModelScope.launch {
            canastasRepo.canastas().fold(
                onSuccess = { lista ->
                    _state.update {
                        it.copy(canastas = if (lista.isEmpty()) UiState.Empty else UiState.Success(lista))
                    }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(canastas = UiState.Error(e.message ?: "No se pudieron cargar las canastas"))
                    }
                },
            )
        }
    }

    /** Abre una canasta para ver su contenido. */
    fun abrir(canastaId: Int) {
        _state.update { it.copy(detalle = UiState.Loading, optimizacion = UiState.Idle) }
        aperturaActual?.cancel()
        aperturaActual = viewModelScope.launch {
            canastasRepo.canasta(canastaId).fold(
                onSuccess = { canasta ->
                    _state.update { it.copy(detalle = UiState.Success(canasta)) }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(detalle = UiState.Error(e.message ?: "No se pudo abrir la canasta"))
                    }
                },
            )
        }
    }

    // cambios

    fun crear(nombre: String) {
        if (!puedeEjecutar()) return
        if (nombre.isBlank()) {
            mostrarError("Escribe un nombre para la canasta")
            return
        }
        _state.update { it.copy(accion = UiState.Loading) }
        viewModelScope.launch {
            canastasRepo.crear(nombre.trim()).fold(
                onSuccess = { nueva ->
                    _state.update { estado ->
                        estado.copy(
                            canastas = conCanastaAgregada(estado.canastas, nueva),
                            detalle = UiState.Success(nueva),
                            optimizacion = UiState.Idle,
                            accion = UiState.Success(Unit),
                        )
                    }
                },
                onFailure = { e -> falloAccion(e, "No se pudo crear la canasta") },
            )
        }
    }

    fun agregarProducto(canastaId: Int, presentacionId: Int, cantidad: Double) {
        if (!puedeEjecutar()) return
        if (cantidad <= 0.0) {
            mostrarError("La cantidad debe ser mayor que cero")
            return
        }
        cambiarCanasta("No se pudo agregar el producto") {
            canastasRepo.agregarProducto(canastaId, presentacionId, cantidad)
        }
    }

    fun cambiarCantidad(canastaId: Int, itemId: Int, cantidad: Double) {
        if (!puedeEjecutar()) return
        if (cantidad <= 0.0) {
            mostrarError("La cantidad debe ser mayor que cero")
            return
        }
        cambiarCanasta("No se pudo cambiar la cantidad") {
            canastasRepo.cambiarCantidad(canastaId, itemId, cantidad)
        }
    }

    fun quitarProducto(canastaId: Int, itemId: Int) {
        if (!puedeEjecutar()) return
        cambiarCanasta("No se pudo quitar el producto") {
            canastasRepo.quitarProducto(canastaId, itemId)
        }
    }

    fun eliminar(canastaId: Int) {
        if (!puedeEjecutar()) return
        _state.update { it.copy(accion = UiState.Loading) }
        viewModelScope.launch {
            canastasRepo.eliminar(canastaId).fold(
                onSuccess = {
                    _state.update { estado ->
                        val abierta = estado.detalle
                        val eraLaAbierta = abierta is UiState.Success && abierta.data.id == canastaId
                        estado.copy(
                            canastas = sinCanasta(estado.canastas, canastaId),
                            detalle = if (eraLaAbierta) UiState.Idle else estado.detalle,
                            optimizacion = if (eraLaAbierta) UiState.Idle else estado.optimizacion,
                            accion = UiState.Success(Unit),
                        )
                    }
                },
                onFailure = { e -> falloAccion(e, "No se pudo eliminar la canasta") },
            )
        }
    }

    // optimización

    /**
     * Calcula en qué tienda (o combinación de tiendas) conviene comprar la canasta.
     * El resultado es "vacío" solo si no hay tienda recomendada ni productos sin precio
     */
    fun optimizar(canastaId: Int, ubicacion: Ubicacion, radioKm: Int, unaSolaTienda: Boolean) {
        if (radioKm <= 0) {
            _state.update { it.copy(optimizacion = UiState.Error("El radio debe ser mayor que cero")) }
            return
        }
        _state.update { it.copy(optimizacion = UiState.Loading) }
        optimizacionActual?.cancel()
        optimizacionActual = viewModelScope.launch {
            canastasRepo.optimizar(canastaId, ubicacion, radioKm, unaSolaTienda).fold(
                onSuccess = { resultado ->
                    _state.update {
                        it.copy(
                            optimizacion = if (resultado.tiendasRecomendadas.isEmpty() &&
                                resultado.productosSinPrecio.isEmpty()
                            ) {
                                UiState.Empty
                            } else {
                                UiState.Success(resultado)
                            },
                        )
                    }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(optimizacion = UiState.Error(e.message ?: "No se pudo calcular la mejor opción"))
                    }
                },
            )
        }
    }

    /** Quita el mensaje de error (o de éxito) de la última acción. */
    fun limpiarAccion() {
        _state.update { if (it.accion is UiState.Loading) it else it.copy(accion = UiState.Idle) }
    }

    // ayudas

    private fun puedeEjecutar(): Boolean = _state.value.accion !is UiState.Loading

    private fun mostrarError(mensaje: String) {
        _state.update { it.copy(accion = UiState.Error(mensaje)) }
    }

    private fun falloAccion(e: Throwable, mensajePorDefecto: String) {
        _state.update { it.copy(accion = UiState.Error(e.message ?: mensajePorDefecto)) }
    }

    /** Agregar, cambiar cantidad y quitar devuelven la canasta ya actualizada. */
    private fun cambiarCanasta(mensajePorDefecto: String, llamada: suspend () -> Result<Canasta>) {
        _state.update { it.copy(accion = UiState.Loading) }
        viewModelScope.launch {
            llamada().fold(
                onSuccess = { canasta ->
                    _state.update { estado ->
                        estado.copy(
                            canastas = conCanastaActualizada(estado.canastas, canasta),
                            detalle = UiState.Success(canasta),
                            optimizacion = UiState.Idle,
                            accion = UiState.Success(Unit),
                        )
                    }
                },
                onFailure = { e -> falloAccion(e, mensajePorDefecto) },
            )
        }
    }

    /** La lista solo se toca si ya estaba cargada, si no, se deja como está. */
    private fun conCanastaAgregada(
        lista: UiState<List<Canasta>>,
        nueva: Canasta,
    ): UiState<List<Canasta>> = when (lista) {
        is UiState.Success -> UiState.Success(lista.data + nueva)
        is UiState.Empty -> UiState.Success(listOf(nueva))
        else -> lista
    }

    private fun conCanastaActualizada(
        lista: UiState<List<Canasta>>,
        canasta: Canasta,
    ): UiState<List<Canasta>> = when (lista) {
        is UiState.Success -> UiState.Success(lista.data.map { if (it.id == canasta.id) canasta else it })
        else -> lista
    }

    private fun sinCanasta(
        lista: UiState<List<Canasta>>,
        canastaId: Int,
    ): UiState<List<Canasta>> = when (lista) {
        is UiState.Success -> {
            val restantes = lista.data.filter { it.id != canastaId }
            if (restantes.isEmpty()) UiState.Empty else UiState.Success(restantes)
        }
        else -> lista
    }
}
