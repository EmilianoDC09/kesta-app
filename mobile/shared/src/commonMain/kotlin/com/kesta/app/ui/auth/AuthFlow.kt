package com.kesta.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.kesta.app.di.AppContainer
import com.kesta.app.ui.components.KestaLabeledDivider
import com.kesta.app.ui.components.KestaSecondaryButton
import com.kesta.app.ui.components.SystemBarsIcons

/**
 * Pantalla de acceso (mockups "5. Iniciar sesión" y "Registro"):
 * encabezado verde, selector de pestana, formulario y "Continuar como invitado".
 * Arranca siempre en la pestana de inicio de sesion.
 */
@Composable
fun AuthFlow(onContinuarComoInvitado: () -> Unit) {
    val loginViewModel = viewModel<LoginViewModel>(
        factory = viewModelFactory { initializer { LoginViewModel(AppContainer.sessionRepository) } }
    )
    val registerViewModel = viewModel<RegisterViewModel>(
        factory = viewModelFactory { initializer { RegisterViewModel(AppContainer.sessionRepository) } }
    )
    val loginState by loginViewModel.state.collectAsStateWithLifecycle()
    val registerState by registerViewModel.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf(AuthTab.Login) }
    val ocupado = loginState.enviando || registerState.enviando

    SystemBarsIcons(lightIcons = true)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .imePadding()
            .verticalScroll(rememberScrollState()),
    ) {
        AuthHeader()
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp)
                .padding(top = 40.dp, bottom = 24.dp),
        ) {
            AuthTabs(selected = tab, onSelect = { tab = it }, enabled = !ocupado)
            Spacer(Modifier.height(28.dp))
            when (tab) {
                AuthTab.Login -> LoginForm(
                    state = loginState,
                    onCorreoChange = loginViewModel::onCorreoChange,
                    onContrasenaChange = loginViewModel::onContrasenaChange,
                    onSubmit = loginViewModel::submit,
                )
                AuthTab.Registro -> RegisterForm(
                    state = registerState,
                    onNombreChange = registerViewModel::onNombreChange,
                    onCorreoChange = registerViewModel::onCorreoChange,
                    onContrasenaChange = registerViewModel::onContrasenaChange,
                    onConfirmacionChange = registerViewModel::onConfirmacionChange,
                    onSubmit = registerViewModel::submit,
                )
            }
            KestaLabeledDivider(label = "o", modifier = Modifier.padding(vertical = 28.dp))
            KestaSecondaryButton(
                text = "Continuar como invitado",
                onClick = onContinuarComoInvitado,
                enabled = !ocupado,
            )
        }
    }
}
