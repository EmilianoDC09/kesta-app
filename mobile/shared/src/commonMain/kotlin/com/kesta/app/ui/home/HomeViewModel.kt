package com.kesta.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.status.ApiStatus
import com.kesta.app.data.status.ApiStatusRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class HomeViewModel(
    private val repository: ApiStatusRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<ApiStatus>>(UiState.Idle)
    val state: StateFlow<UiState<ApiStatus>> = _state.asStateFlow()

    fun checkConnection() {
        if (_state.value is UiState.Loading) return
        _state.value = UiState.Loading
        viewModelScope.launch {
            repository.check().fold(
                onSuccess = { _state.value = UiState.Success(it) },
                onFailure = { _state.value = UiState.Error(it.message ?: "No se pudo conectar") },
            )
        }
    }
}
