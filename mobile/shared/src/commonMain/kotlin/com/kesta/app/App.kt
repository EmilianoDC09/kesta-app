package com.kesta.app

import androidx.compose.runtime.Composable
import com.kesta.app.ui.home.HomeScreen
import com.kesta.app.ui.theme.KestaTheme

/**
 * Punto de entrada compartido. Lo invocan MainActivity (Android)
 * y MainViewController (iOS). Mas adelante aqui vive la navegacion.
 */
@Composable
fun App() {
    KestaTheme {
        HomeScreen()
    }
}
