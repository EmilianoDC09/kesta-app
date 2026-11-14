package com.kesta.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kesta.app.ui.theme.KestaGold
import com.kesta.app.ui.theme.KestaGreen
import com.kesta.app.ui.theme.KestaTextMuted

/** Accion principal de una pantalla: verde, ancho completo, con estado de carga. */
@Composable
fun KestaPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        shape = KestaControlShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = KestaGreen,
            contentColor = Color.White,
            disabledContainerColor = KestaGreen.copy(alpha = 0.7f),
            disabledContentColor = Color.White,
        ),
        modifier = modifier.fillMaxWidth().height(50.dp),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                strokeWidth = 2.dp,
                color = Color.White,
            )
        } else {
            Text(text, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
    }
}

/** Accion secundaria: borde y texto dorados. */
@Composable
fun KestaSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = KestaControlShape,
        border = BorderStroke(1.dp, KestaGold),
        modifier = modifier.fillMaxWidth().height(50.dp),
    ) {
        Text(text = text, color = KestaGold, fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}

/** Separador horizontal con un texto al centro ("o"). */
@Composable
fun KestaLabeledDivider(label: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        HorizontalDivider(modifier = Modifier.weight(1f), color = KestaTextMuted)
        Text(label, color = KestaTextMuted, fontSize = 14.sp)
        HorizontalDivider(modifier = Modifier.weight(1f), color = KestaTextMuted)
    }
}
