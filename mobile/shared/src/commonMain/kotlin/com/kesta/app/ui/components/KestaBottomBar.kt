package com.kesta.app.ui.components


import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.kesta.app.ui.theme.KestaBorder
import com.kesta.app.ui.theme.KestaGold
import com.kesta.app.ui.theme.KestaGreen
import com.kesta.app.ui.theme.KestaTextMuted
import androidx.compose.foundation.layout.height
import androidx.compose.ui.draw.shadow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource

/** Pestañas de la barra inferior */
enum class KestaTab { INICIO, UBICACION, CANASTA, PERFIL }


@Composable
fun KestaBottomBar(
    selected: KestaTab?,
    onInicio: () -> Unit,
    onUbicacion: () -> Unit,
    onReportar: () -> Unit,
    onCanasta: () -> Unit,
    onPerfil: () -> Unit,
    modifier: Modifier = Modifier,
    expandida: Boolean = true,
) {

    val progreso by animateFloatAsState(
        targetValue = if (expandida) 1f else 0f,
        animationSpec = tween(durationMillis = 800),
        label = "barraInferior",
    )

    Surface(modifier = modifier.fillMaxWidth(), color = Color.Transparent) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
        ) {
            // Qué tan lejos está cada opción del botón central, para que al juntarse se deslicen hacia él.
            val ancho = maxWidth - 20.dp
            val hueco = (ancho - (TAB * 4 + BOTON)) / 4
            val distanciaExterna = ancho / 2 - TAB / 2
            val distanciaInterna = ancho / 2 - (TAB + hueco + TAB / 2)

            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .height(CAPSULA)
                    .graphicsLayer {
                        alpha = progreso
                        val escala = 0.3f + 0.7f * progreso
                        scaleX = escala
                    }
                    .shadow(10.dp, CircleShape)
                    .background(Color.White, CircleShape)
                    .border(1.dp, KestaBorder, CircleShape),
            )

            Row(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BarTab(Icons.Filled.Home, "Inicio", selected == KestaTab.INICIO, expandida, onInicio,
                    Modifier.juntarHaciaElCentro(progreso, distanciaExterna))
                BarTab(Icons.Filled.Place, "Ubicación", selected == KestaTab.UBICACION, expandida, onUbicacion,
                    Modifier.juntarHaciaElCentro(progreso, distanciaInterna))
                ReportButton(onReportar)
                BarTab(Icons.Filled.ShoppingCart, "Mi canasta", selected == KestaTab.CANASTA, expandida, onCanasta,
                    Modifier.juntarHaciaElCentro(progreso, -distanciaInterna))
                BarTab(Icons.Filled.Person, "Perfil", selected == KestaTab.PERFIL, expandida, onPerfil,
                    Modifier.juntarHaciaElCentro(progreso, -distanciaExterna))
            }
        }
    }
}

private val TAB = 50.dp
private val BOTON = 60.dp
private val CAPSULA = 64.dp

private fun Modifier.juntarHaciaElCentro(progreso: Float, distancia: Dp): Modifier = graphicsLayer {
    translationX = (1f - progreso) * distancia.toPx()
    alpha = progreso
    val escala = 0.4f + 0.6f * progreso
    scaleX = escala
    scaleY = escala
}

@Composable
private fun BarTab(
    icon: ImageVector,
    description: String,
    selected: Boolean,
    /** Con la barra juntada las opciones no se pueden tocar aunque estén debajo del botón. */
    habilitada: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .size(TAB)
            .clip(RoundedCornerShape(18.dp))
            .background(if (selected) KestaGreen.copy(alpha = 0.12f) else Color.Transparent)
            .clickable(enabled = !selected && habilitada, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = description,
            tint = if (selected) KestaGreen else KestaTextMuted,
            modifier = Modifier.size(24.dp),
        )
    }
}

@Composable
private fun ReportButton(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(BOTON)
            .clip(CircleShape)
            .background(Color.White)
            .background(KestaGold.copy(alpha = 0.20f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier.size(50.dp).clip(CircleShape).background(KestaGold),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Add,
                contentDescription = "Reportar precio",
                tint = Color.White,
                modifier = Modifier.size(36.dp),
            )
        }
    }
}

/** Detecta hacia dónde hace scroll el usuario */
class ControlBarraInferior : NestedScrollConnection {
    var expandida by mutableStateOf(true)
        private set

    override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
        // El umbral evita que un temblor pequeño del dedo cambie la barra.
        if (available.y < -UMBRAL_SCROLL) expandida = false
        else if (available.y > UMBRAL_SCROLL) expandida = true
        return Offset.Zero
    }
}

private const val UMBRAL_SCROLL = 8f

@Composable
fun rememberControlBarraInferior(): ControlBarraInferior = remember { ControlBarraInferior() }