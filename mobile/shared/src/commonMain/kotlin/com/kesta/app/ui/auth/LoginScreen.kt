package com.kesta.app.ui.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.kesta.app.ui.components.ErrorText
import com.kesta.app.ui.components.KestaPasswordField
import com.kesta.app.ui.components.KestaPrimaryButton
import com.kesta.app.ui.components.KestaTextField

/** Formulario de la pestana "Iniciar sesion". El estado vive en LoginViewModel. */
@Composable
fun LoginForm(
    state: LoginUiState,
    onCorreoChange: (String) -> Unit,
    onContrasenaChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Column {
        KestaTextField(
            value = state.correo,
            onValueChange = onCorreoChange,
            placeholder = "Correo electrónico",
            error = state.correoError,
            enabled = !state.enviando,
            keyboardType = KeyboardType.Email,
        )
        Spacer(Modifier.height(14.dp))
        KestaPasswordField(
            value = state.contrasena,
            onValueChange = onContrasenaChange,
            placeholder = "Contraseña",
            error = state.contrasenaError,
            enabled = !state.enviando,
            onDone = onSubmit,
        )
        ErrorText(state.error)
        Spacer(Modifier.height(24.dp))
        KestaPrimaryButton(text = "Entrar", onClick = onSubmit, loading = state.enviando)
    }
}
