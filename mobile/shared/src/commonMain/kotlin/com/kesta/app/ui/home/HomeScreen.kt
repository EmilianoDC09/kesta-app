package com.kesta.app.ui.home

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.auth.Usuario
import com.kesta.app.data.status.ApiStatus
import com.kesta.app.di.AppContainer
import com.kesta.app.ui.components.KestaLogo
import com.kesta.app.ui.components.KestaScreen
import com.kesta.app.ui.components.SystemBarsIcons

@Composable
fun HomeScreen(
    usuario: Usuario?,
    cerrandoSesion: Boolean,
    onLogout: () -> Unit,
    viewModel: HomeViewModel = viewModel<HomeViewModel>(
        factory = viewModelFactory {
            initializer { HomeViewModel(AppContainer.apiStatusRepository) }
        }
    ),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeContent(
        usuario = usuario,
        state = state,
        cerrandoSesion = cerrandoSesion,
        onCheckConnection = viewModel::checkConnection,
        onLogout = onLogout,
    )
}

/** Sin ViewModel: facil de previsualizar y de probar. */
@Composable
fun HomeContent(
    usuario: Usuario?,
    state: UiState<ApiStatus>,
    cerrandoSesion: Boolean,
    onCheckConnection: () -> Unit,
    onLogout: () -> Unit,
) {
    SystemBarsIcons(lightIcons = false)
    KestaScreen {
        KestaLogo()
        Spacer(Modifier.height(8.dp))
        Text("Hola, ${usuario?.nombre ?: "invitado"}", style = MaterialTheme.typography.titleLarge)
        if (usuario != null) {
            Text(usuario.correo, style = MaterialTheme.typography.bodyMedium)
        }
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
        Spacer(Modifier.height(48.dp))
        OutlinedButton(
            onClick = onLogout,
            enabled = !cerrandoSesion,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (cerrandoSesion) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                Text(if (usuario == null) "Iniciar sesión o registrarse" else "Cerrar sesión")
            }
        }
    }
}
