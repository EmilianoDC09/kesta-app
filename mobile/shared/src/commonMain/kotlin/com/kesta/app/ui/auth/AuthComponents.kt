package com.kesta.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kesta.app.ui.components.KestaIcon
import com.kesta.app.ui.theme.KestaBorder
import com.kesta.app.ui.theme.KestaGreen
import com.kesta.app.ui.theme.KestaTabInactive
import com.kesta.app.ui.theme.KestaTextMuted

/*
 * Piezas exclusivas de la pantalla de acceso. Los campos, botones y el separador
 * son del kit general: ui/components/KestaInputs.kt y KestaButtons.kt.
 */

enum class AuthTab(val titulo: String) {
    Login("Iniciar sesión"),
    Registro("Registrarse"),
}

/** Encabezado verde con el icono y el lema (mockups 5. Iniciar sesión / Registro). */
@Composable
fun AuthHeader() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(KestaGreen)
            .statusBarsPadding()
            .padding(top = 32.dp, bottom = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        KestaIcon(height = 104.dp)
        Spacer(Modifier.height(20.dp))
        Text(
            text = "Tu comparador de canasta básica",
            color = Color.White,
            fontSize = 13.sp,
        )
    }
}

@Composable
fun AuthTabs(
    selected: AuthTab,
    onSelect: (AuthTab) -> Unit,
    enabled: Boolean,
) {
    val shape = RoundedCornerShape(8.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(44.dp)
            .clip(shape)
            .border(1.dp, KestaBorder, shape),
    ) {
        AuthTab.entries.forEach { tab ->
            val isSelected = tab == selected
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(if (isSelected) KestaGreen else KestaTabInactive)
                    .clickable(enabled = enabled && !isSelected) { onSelect(tab) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = tab.titulo,
                    color = if (isSelected) Color.White else KestaTextMuted,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
            }
        }
    }
}
