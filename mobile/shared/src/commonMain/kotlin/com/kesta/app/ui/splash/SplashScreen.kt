package com.kesta.app.ui.splash

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.kesta.app.ui.components.KestaIcon
import com.kesta.app.ui.components.SystemBarsIcons
import com.kesta.app.ui.theme.KestaGreen

/** Se muestra mientras se valida la sesion guardada. Mismo verde que el encabezado de acceso. */
@Composable
fun SplashScreen() {
    SystemBarsIcons(lightIcons = true)
    Column(
        modifier = Modifier.fillMaxSize().background(KestaGreen),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        KestaIcon(height = 132.dp)
        Spacer(Modifier.height(32.dp))
        CircularProgressIndicator(
            modifier = Modifier.size(28.dp),
            color = Color.White,
            strokeWidth = 2.dp,
        )
    }
}
