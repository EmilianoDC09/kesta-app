package com.kesta.app.core.ui

/**
 * Los estados que exige el contrato (6.2) para toda pantalla:
 * cargando, con datos, vacio y error (Idle = aun no se ha pedido nada).
 */
sealed interface UiState<out T> {
    data object Idle : UiState<Nothing>
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data object Empty : UiState<Nothing>
    data class Error(val message: String) : UiState<Nothing>
}
