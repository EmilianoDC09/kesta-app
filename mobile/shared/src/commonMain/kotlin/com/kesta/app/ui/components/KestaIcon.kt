package com.kesta.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.kesta.app.resources.Res
import com.kesta.app.resources.kesta_logomin
import com.kesta.app.ui.theme.KestaSurface
import org.jetbrains.compose.resources.painterResource
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Icono de Kesta con un contorno claro que sigue la silueta del logo.
 * Sin el contorno, la mitad verde del icono se pierde sobre fondos verdes.
 *
 * El contorno se logra dibujando copias del icono tenidas de un solo color,
 * desplazadas [outline] en todas las direcciones, debajo del icono original.
 * Con outline = 0.dp se dibuja solo el icono.
 */
@Composable
fun KestaIcon(
    height: Dp,
    modifier: Modifier = Modifier,
    outline: Dp = 2.dp,
    outlineColor: Color = KestaSurface,
) {
    val painter = painterResource(Res.drawable.kesta_logomin)
    val size = Modifier.height(height).aspectRatio(LOGO_ASPECT_RATIO)

    Box(modifier = modifier.padding(outline), contentAlignment = Alignment.Center) {
        if (outline > 0.dp) {
            val tint = ColorFilter.tint(outlineColor, BlendMode.SrcIn)
            repeat(OUTLINE_STEPS) { i ->
                val angle = 2 * PI * i / OUTLINE_STEPS
                Image(
                    painter = painter,
                    contentDescription = null,
                    colorFilter = tint,
                    modifier = size.offset(
                        x = outline * cos(angle).toFloat(),
                        y = outline * sin(angle).toFloat(),
                    ),
                )
            }
        }
        Image(painter = painter, contentDescription = "Kesta", modifier = size)
    }
}

private const val LOGO_ASPECT_RATIO = 337f / 502f
private const val OUTLINE_STEPS = 16
