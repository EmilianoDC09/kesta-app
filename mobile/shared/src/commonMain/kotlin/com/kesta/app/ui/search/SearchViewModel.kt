package com.kesta.app.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.CatalogRepository
import com.kesta.app.domain.model.Categoria
import com.kesta.app.domain.model.Producto
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Lo que las pantallas de búsqueda necesitan saber.
 *  - [consulta]: el texto escrito en el buscador.
 *  - [categoriaId]: la categoría elegida como filtro (null = todas).
 *  - [categorias]: las categorías disponibles para el filtro.
 *  - [resultados]: los productos encontrados (cargando, con datos, vacío o error).
 */
data class SearchUiState(
    val consulta: String = "",
    val categoriaId: Int? = null,
    val categorias: UiState<List<Categoria>> = UiState.Idle,
    val resultados: UiState<List<Producto>> = UiState.Idle,
)

class SearchViewModel(
    private val catalogo: CatalogRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    private var busquedaActual: Job? = null

    fun cargarCategorias() {
        if (_state.value.categorias is UiState.Loading) return
        _state.update { it.copy(categorias = UiState.Loading) }
        viewModelScope.launch {
            catalogo.categorias().fold(
                onSuccess = { lista ->
                    _state.update {
                        it.copy(categorias = if (lista.isEmpty()) UiState.Empty else UiState.Success(lista))
                    }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(categorias = UiState.Error(e.message ?: "No se pudieron cargar las categorías"))
                    }
                },
            )
        }
    }

    fun cambiarConsulta(texto: String) {
        _state.update { it.copy(consulta = texto) }
    }

    /** Elige una categoría como filtro; null quita el filtro. */
    fun elegirCategoria(categoriaId: Int?) {
        _state.update { it.copy(categoriaId = categoriaId) }
    }

    fun buscar() {
        val actual = _state.value
        val texto = actual.consulta.trim()
        if (texto.isEmpty() && actual.categoriaId == null) {
            _state.update { it.copy(resultados = UiState.Error("Escribe un producto o elige una categoría")) }
            return
        }
        _state.update { it.copy(resultados = UiState.Loading) }
        // Si el usuario busca otra vez, la búsqueda anterior se descarta para que
        // una respuesta tardía no pise a la más reciente.
        busquedaActual?.cancel()
        busquedaActual = viewModelScope.launch {
            catalogo.buscarProductos(texto, actual.categoriaId, pagina = 1).fold(
                onSuccess = { lista ->
                    _state.update {
                        it.copy(resultados = if (lista.isEmpty()) UiState.Empty else UiState.Success(lista))
                    }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(resultados = UiState.Error(e.message ?: "No se pudo buscar"))
                    }
                },
            )
        }
    }
}