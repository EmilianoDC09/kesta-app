package com.kesta.app.ui.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.kesta.app.ui.components.ErrorText
import com.kesta.app.ui.components.KestaPasswordField
import com.kesta.app.ui.components.KestaPrimaryButton
import com.kesta.app.ui.components.KestaTextField

/** Formulario de la pestana "Registrarse". El estado vive en RegisterViewModel. */
@Composable
fun RegisterForm(
    state: RegisterUiState,
    onNombreChange: (String) -> Unit,
    onCorreoChange: (String) -> Unit,
    onContrasenaChange: (String) -> Unit,
    onConfirmacionChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Column {
        KestaTextField(
            value = state.nombre,
            onValueChange = onNombreChange,
            placeholder = "Nombre completo",
            error = state.nombreError,
            enabled = !state.enviando,
        )
        Spacer(Modifier.height(14.dp))
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
            placeholder = "Contraseña (mínimo ${Validaciones.MIN_CONTRASENA} caracteres)",
            error = state.contrasenaError,
            enabled = !state.enviando,
            imeAction = ImeAction.Next,
        )
        Spacer(Modifier.height(14.dp))
        KestaPasswordField(
            value = state.confirmacion,
            onValueChange = onConfirmacionChange,
            placeholder = "Confirmar contraseña",
            error = state.confirmacionError,
            enabled = !state.enviando,
            onDone = onSubmit,
        )
        ErrorText(state.error)
        Spacer(Modifier.height(24.dp))
        KestaPrimaryButton(text = "Crear cuenta", onClick = onSubmit, loading = state.enviando)
    }
}
