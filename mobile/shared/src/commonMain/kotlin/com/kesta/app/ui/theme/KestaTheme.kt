package com.kesta.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val KestaGreen = Color(0xFF0A4033)
val KestaGold = Color(0xFFB6822B)
val KestaSurface = Color(0xFFFAF8F3)

<<<<<<< Updated upstream
=======
// Neutros de los mockups de acceso (Figma)
val KestaBorder = Color(0xFFD9D9D9)
val KestaTextMuted = Color(0xFF9E9E9E)
val KestaTabInactive = Color(0xFFF7F7F7)
val KestaTextPrimary = Color(0xFF1F1F1F)

val KestaGreenLight = Color(0xFFE3F3EA)

val KestaGoldLight = Color(0xFFFFF4DC)

val KestaRed = Color(0xFFD93025)

>>>>>>> Stashed changes
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
