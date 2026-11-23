package com.kesta.app.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.core.error.AppError
import com.kesta.app.core.error.asAppError
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.catalog.CatalogRepository
import com.kesta.app.data.catalog.Categoria
import com.kesta.app.data.catalog.Producto
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Lo que la pantalla de búsqueda necesita dibujar. */
data class SearchUiState(
    /** Texto que escribió el usuario. */
    val consulta: String = "",
    /** Categoría elegida en el filtro; null = todas. */
    val categoriaId: Int? = null,
    /** Opciones del filtro. Vacía si todavía no cargaron: el filtro queda sin opciones, la búsqueda sigue funcionando. */
    val categorias: List<Categoria> = emptyList(),
    /** Idle = aún no se ha buscado; luego Loading, Success, Empty o Error. */
    val resultados: UiState<List<Producto>> = UiState.Idle,
)

/**
 * Búsqueda de productos (texto + categoría). Solo habla con [CatalogRepository], así que funciona igual
 * con el servidor local que con el de producción.
 */
class SearchViewModel(
    private val repository: CatalogRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    // La búsqueda en curso: si el usuario pide otra, se cancela para que una respuesta lenta
    // no pise a la más reciente.
    private var busqueda: Job? = null

    init {
        cargarCategorias()
        // La primera búsqueda (sin texto: todos los productos) arranca sola, sin depender de la pantalla.
        ejecutarBusqueda()
    }

    fun onConsultaChange(valor: String) = _state.update { it.copy(consulta = valor) }

    /** Busca [consulta] (o el texto actual) conservando la categoría elegida. Un texto vacío lista todo. */
    fun buscar(consulta: String = _state.value.consulta) {
        _state.update { it.copy(consulta = consulta) }
        ejecutarBusqueda()
    }

    /**
     * Empieza una búsqueda desde cero, por ejemplo la que se escribe en el Home: quita la categoría
     * que se había elegido antes, para que no oculte resultados sin que el usuario lo sepa.
     */
    fun nuevaBusqueda(consulta: String) {
        _state.update { it.copy(consulta = consulta, categoriaId = null) }
        ejecutarBusqueda()
    }

    /** Aplica el filtro de categoría (null = todas) y vuelve a buscar con el texto actual. */
    fun elegirCategoria(categoriaId: Int?) {
        if (categoriaId == _state.value.categoriaId) return
        _state.update { it.copy(categoriaId = categoriaId) }
        ejecutarBusqueda()
    }

    /** Para el botón "Reintentar" después de un error. */
    fun reintentar() {
        if (_state.value.categorias.isEmpty()) cargarCategorias()
        ejecutarBusqueda()
    }

    private fun cargarCategorias() {
        viewModelScope.launch {
            repository.categorias().onSuccess { lista ->
                _state.update { it.copy(categorias = lista) }
            }
            // Si falla no se muestra error: el filtro simplemente no tendrá opciones.
        }
    }

    private fun ejecutarBusqueda() {
        busqueda?.cancel()
        val actual = _state.value
        _state.update { it.copy(resultados = UiState.Loading) }
        busqueda = viewModelScope.launch {
            repository.buscarProductos(
                consulta = actual.consulta.trim().take(MAX_CONSULTA),
                categoriaId = actual.categoriaId,
                pagina = 1,
            ).fold(
                onSuccess = { lista ->
                    _state.update {
                        it.copy(resultados = if (lista.isEmpty()) UiState.Empty else UiState.Success(lista))
                    }
                },
                onFailure = { e ->
                    _state.update { it.copy(resultados = UiState.Error(e.asAppError().mensajeBusqueda())) }
                },
            )
        }
    }

    private companion object {
        /** El servidor rechaza textos de más de 100 caracteres. */
        const val MAX_CONSULTA = 100
    }
}

private fun AppError.mensajeBusqueda(): String = when (this) {
    AppError.SinConexion -> "Sin conexión. Revisa tu internet e inténtalo de nuevo."
    AppError.NoAutorizado -> "Tu sesión terminó. Inicia sesión de nuevo."
    is AppError.Validacion -> "Revisa el texto de búsqueda e inténtalo de nuevo."
    is AppError.Servidor -> "El servidor tuvo un problema. Inténtalo en unos minutos."
    AppError.RespuestaInvalida -> "El servidor respondió algo inesperado."
    else -> "No se pudo completar la búsqueda."
}