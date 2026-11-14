package com.kesta.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.kesta.app.data.auth.SessionState
import com.kesta.app.di.AppContainer
import com.kesta.app.ui.auth.AuthFlow
import com.kesta.app.ui.home.HomeScreen
import com.kesta.app.ui.session.SessionViewModel
import com.kesta.app.ui.splash.SplashScreen
import com.kesta.app.ui.theme.KestaTheme

/**
 * Punto de entrada compartido. La pantalla raiz depende solo del estado de sesion:
 * Verificando -> splash, NoAutenticado -> acceso, Autenticado / Invitado -> inicio.
 * Cerrar sesion o que expire la renovacion regresa automaticamente al login.
 */
@Composable
fun App() {
    KestaTheme {
        val sessionViewModel = viewModel<SessionViewModel>(
            factory = viewModelFactory {
                initializer { SessionViewModel(AppContainer.sessionRepository) }
            }
        )
        val session by sessionViewModel.session.collectAsStateWithLifecycle()
        val cerrandoSesion by sessionViewModel.cerrandoSesion.collectAsStateWithLifecycle()
        val mostrarSplash by sessionViewModel.mostrarSplash.collectAsStateWithLifecycle()

        if (mostrarSplash) {
            SplashScreen()
        } else when (val s = session) {
            SessionState.Verificando -> SplashScreen()
            SessionState.NoAutenticado -> AuthFlow(
                onContinuarComoInvitado = sessionViewModel::continuarComoInvitado,
            )
            is SessionState.Autenticado -> HomeScreen(
                usuario = s.usuario,
                cerrandoSesion = cerrandoSesion,
                onLogout = sessionViewModel::logout,
            )
            SessionState.Invitado -> HomeScreen(
                usuario = null,
                cerrandoSesion = cerrandoSesion,
                onLogout = sessionViewModel::logout,
            )
        }
    }
}
