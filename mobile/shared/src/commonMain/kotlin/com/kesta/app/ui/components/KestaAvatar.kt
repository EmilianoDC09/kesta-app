package com.kesta.app.ui.components
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kesta.app.data.auth.Usuario
import com.kesta.app.ui.theme.KestaGold
import com.kesta.app.ui.theme.KestaTextMuted

/** Círculo dorado con la inicial del usuario, presente en el encabezado de todas las pantallas. */
@Composable
fun KestaAvatar(
    usuario: Usuario?,
    cerrandoSesion: Boolean,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var abierto by remember { mutableStateOf(false) }
    val inicial = usuario?.nombre?.trim()?.firstOrNull()?.uppercase() ?: "?"
    Box(modifier) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(KestaGold)
                .clickable { abierto = true },
            contentAlignment = Alignment.Center,
        ) {
            Text(inicial, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp)
        }
        DropdownMenu(expanded = abierto, onDismissRequest = { abierto = false }) {
            if (usuario != null) {
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(usuario.nombre, fontWeight = FontWeight.Bold)
                            Text(usuario.correo, fontSize = 12.sp, color = KestaTextMuted)
                        }
                    },
                    onClick = {},
                    enabled = false,
                )
            }
            DropdownMenuItem(
                text = { Text(if (usuario == null) "Iniciar sesión o registrarse" else "Cerrar sesión") },
                enabled = !cerrandoSesion,
                onClick = {
                    abierto = false
                    onLogout()
                },
            )
        }
    }
}