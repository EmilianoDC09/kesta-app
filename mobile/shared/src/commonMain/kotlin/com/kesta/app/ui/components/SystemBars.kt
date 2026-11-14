package com.kesta.app.ui.components

import androidx.compose.runtime.Composable

/**
 * lightIcons = true: iconos blancos en la barra de estado (para fondos verdes).
 * lightIcons = false: iconos oscuros (para fondos claros).
 */
@Composable
expect fun SystemBarsIcons(lightIcons: Boolean)
