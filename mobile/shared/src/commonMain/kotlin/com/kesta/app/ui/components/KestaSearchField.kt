package com.kesta.app.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import com.kesta.app.ui.theme.KestaBorder
import com.kesta.app.ui.theme.KestaGold
import com.kesta.app.ui.theme.KestaTextMuted
import com.kesta.app.ui.theme.KestaTextPrimary

/**
 * Buscador de producto
 * Busca al tocar la lupa o la tecla "buscar" del teclado.
 */
@Composable
fun KestaSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    onSearch: () -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Buscar producto en Kesta...",
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder) },
        singleLine = true,
        trailingIcon = {
            IconButton(onClick = onSearch) {
                Icon(Icons.Filled.Search, contentDescription = "Buscar", tint = KestaTextMuted)
            }
        },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { onSearch() }),
        shape = KestaControlShape,
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = KestaTextPrimary,
            unfocusedTextColor = KestaTextPrimary,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
            focusedBorderColor = KestaGold,
            unfocusedBorderColor = KestaBorder,
            focusedPlaceholderColor = KestaTextMuted,
            unfocusedPlaceholderColor = KestaTextMuted,
            cursorColor = KestaGold,
        ),
        modifier = modifier.fillMaxWidth(),
    )
}