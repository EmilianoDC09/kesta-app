package com.kesta.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val KestaGreen = Color(0xFF0A4033)
val KestaGold = Color(0xFFB6822B)
val KestaSurface = Color(0xFFFAF8F3)

private val KestaColors = lightColorScheme(
    primary = KestaGreen,
    onPrimary = Color.White,
    secondary = KestaGold,
    onSecondary = Color.White,
    background = KestaSurface,
    surface = KestaSurface,
    onBackground = KestaGreen,
    onSurface = KestaGreen,
)

@Composable
fun KestaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = KestaColors, content = content)
}
