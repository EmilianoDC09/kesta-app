package com.kesta.app.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kesta.app.ui.theme.KestaBorder
import com.kesta.app.ui.theme.KestaGreen
import com.kesta.app.ui.theme.KestaTextMuted
import com.kesta.app.ui.theme.KestaTextPrimary

/** Forma comun de campos y botones del kit de Kesta. */
internal val KestaControlShape = RoundedCornerShape(10.dp)

@Composable
private fun kestaFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = KestaTextPrimary,
    unfocusedTextColor = KestaTextPrimary,
    disabledTextColor = KestaTextMuted,
    focusedContainerColor = Color.White,
    unfocusedContainerColor = Color.White,
    disabledContainerColor = Color.White,
    focusedBorderColor = KestaGreen,
    unfocusedBorderColor = KestaBorder,
    disabledBorderColor = KestaBorder,
    focusedPlaceholderColor = KestaTextMuted,
    unfocusedPlaceholderColor = KestaTextMuted,
    disabledPlaceholderColor = KestaTextMuted,
    cursorColor = KestaGreen,
)

/** Campo de texto del kit: texto de ejemplo dentro, borde gris que pasa a verde con foco. */
@Composable
fun KestaTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    enabled: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    onImeAction: () -> Unit = {},
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder) },
        singleLine = true,
        isError = error != null,
        supportingText = if (error != null) {
            { Text(error) }
        } else {
            null
        },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
        keyboardActions = KeyboardActions(onDone = { onImeAction() }, onSearch = { onImeAction() }),
        enabled = enabled,
        shape = KestaControlShape,
        colors = kestaFieldColors(),
        modifier = modifier.fillMaxWidth(),
    )
}

@Composable
fun KestaPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    enabled: Boolean = true,
    imeAction: ImeAction = ImeAction.Done,
    onDone: () -> Unit = {},
) {
    var visible by rememberSaveable { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder) },
        singleLine = true,
        isError = error != null,
        supportingText = if (error != null) {
            { Text(error) }
        } else {
            null
        },
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = imeAction),
        keyboardActions = KeyboardActions(onDone = { onDone() }),
        trailingIcon = if (value.isNotEmpty()) {
            {
                TextButton(onClick = { visible = !visible }, enabled = enabled) {
                    Text(if (visible) "Ocultar" else "Ver", color = KestaTextMuted, fontSize = 13.sp)
                }
            }
        } else {
            null
        },
        enabled = enabled,
        shape = KestaControlShape,
        colors = kestaFieldColors(),
        modifier = modifier.fillMaxWidth(),
    )
}
