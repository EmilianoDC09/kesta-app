package com.kesta.app.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeContentPadding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.ApiStatus
import com.kesta.app.di.AppContainer
import com.kesta.app.ui.theme.KestaGold

@Composable
fun HomeScreen(
    viewModel: HomeViewModel = viewModel<HomeViewModel>(
        factory = viewModelFactory {
            initializer { HomeViewModel(AppContainer.apiStatusRepository) }
        }
    ),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeContent(state = state, onCheckConnection = viewModel::checkConnection)
}

/** Sin ViewModel: facil de previsualizar y de probar. */
@Composable
fun HomeContent(
    state: UiState<ApiStatus>,
    onCheckConnection: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().safeContentPadding().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = buildAnnotatedString {
                    append("ke")
                    withStyle(SpanStyle(color = KestaGold)) { append("S") }
                    append("ta")
                },
                fontSize = 56.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Compara precios entre tiendas y tianguis para ahorrar y comprar mejor.",
                style = MaterialTheme.typography.bodyLarge,
            )
            Spacer(Modifier.height(32.dp))
            Button(
                onClick = onCheckConnection,
                enabled = state !is UiState.Loading,
            ) {
                Text("Probar conexion con el servidor")
            }
            Spacer(Modifier.height(16.dp))
            when (state) {
                UiState.Idle -> Unit
                UiState.Loading -> CircularProgressIndicator()
                UiState.Empty -> Text("Sin datos")
                is UiState.Success -> Text("Servidor disponible (HTTP ${state.data.httpCode})")
                is UiState.Error -> Text(
                    text = "Error: ${state.message}",
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}
