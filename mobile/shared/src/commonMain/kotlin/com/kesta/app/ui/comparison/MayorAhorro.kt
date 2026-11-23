package com.kesta.app.ui.comparison

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.auth.Usuario
import com.kesta.app.ui.components.KestaAvatar
import com.kesta.app.ui.components.KestaBottomBar
import com.kesta.app.ui.components.KestaControlShape
import com.kesta.app.ui.components.KestaSearchField
import com.kesta.app.ui.components.SystemBarsIcons
import com.kesta.app.ui.components.rememberControlBarraInferior
import com.kesta.app.ui.theme.KestaBorder
import com.kesta.app.ui.theme.KestaGold
import com.kesta.app.ui.theme.KestaGoldLight
import com.kesta.app.ui.theme.KestaGreen
import com.kesta.app.ui.theme.KestaGreenLight
import com.kesta.app.ui.theme.KestaTabInactive
import com.kesta.app.ui.theme.KestaTextMuted
import com.kesta.app.ui.theme.KestaTextPrimary
import com.kesta.app.ui.theme.KestaTheme

// Datos que la pantalla va a mostrar (los textos ya vienen con formato: "$65.00", "Ahorro 48%")

data class PrecioOfertaUi(
    val canal: String,
    val informal: Boolean,
    val comercio: String,
    /** "2.2 km · Hoy, hace 5h" o "Profeco / Oficial". */
    val detalle: String,
    val verificado: Boolean,
    val precio: String,
    /** "/kg", "/L"... */
    val unidad: String,
    /** Dónde está el comercio*/
    val lat: Double? = null,
    val lng: Double? = null,
)

data class OfertaAhorroUi(
    val producto: String,
    val icono: String,
    /** "por 1 kg". */
    val presentacion: String,
    /** "Ahorro 48%". */
    val ahorroPorcentaje: String,
    /** "$34.90 MXN". */
    val ahorroPesos: String,
    val mejor: PrecioOfertaUi,
    val comparado: PrecioOfertaUi,
)

/** Un producto que solo tiene precios en un tipo de comercio, se muestra con un aviso en lugar de un ahorro. */
data class SinComparacionUi(
    val producto: String,
    val icono: String,
    /** "Alpura · 1 L". */
    val presentacion: String,
    val aviso: String,
    /** El precio más bajo del único tipo de comercio que tiene precios. */
    val precio: PrecioOfertaUi,
)

private val OpcionesComercio = listOf("Todos", "Supermercado", "Tianguis")
private val OpcionesOrden = listOf("Mayor ahorro", "Menor precio", "Más cercano")

/** Pantalla "Mayor ahorro */
@Composable
fun MayorAhorroContent(
    usuario: Usuario?,
    cerrandoSesion: Boolean,
    onLogout: () -> Unit,
    estado: UiState<List<OfertaAhorroUi>>,
    modifier: Modifier = Modifier,
    /** Productos sin comparación posible; se listan después de las ofertas. */
    sinComparacion: List<SinComparacionUi> = emptyList(),
    categorias: List<String> = emptyList(),
    categoriaElegida: String = "Categorías",
    comercioElegido: String = "Comercio",
    ordenElegido: String = "Mayor ahorro",
    consultaAplicada: String = "",
    onCategoria: (String) -> Unit = {},
    onComercio: (String) -> Unit = {},
    onOrden: (String) -> Unit = {},
    onBuscar: (String) -> Unit = {},
    onVolver: () -> Unit = {},
    onAlertas: () -> Unit = {},
    onReintentar: () -> Unit = {},
    onVerDetalle: (OfertaAhorroUi) -> Unit = {},
    onAgregarACanasta: (OfertaAhorroUi) -> Unit = {},
    onUbicacion: (PrecioOfertaUi) -> Unit = {},
    onInicio: () -> Unit = {},
    onMapa: () -> Unit = {},
    onReportar: () -> Unit = {},
    onCanasta: () -> Unit = {},
    onPerfil: () -> Unit = {},
) {

    SystemBarsIcons(lightIcons = true)
    var consulta by rememberSaveable { mutableStateOf(consultaAplicada) }
    val lista = rememberLazyListState()
    val barra = rememberControlBarraInferior()

    Surface(modifier = modifier.fillMaxSize(), color = Color.White) {
        Column(Modifier.fillMaxSize()) {
            Encabezado(
                usuario = usuario,
                cerrandoSesion = cerrandoSesion,
                consulta = consulta,
                onConsultaChange = { consulta = it },
                // Un texto vacío también busca: así se quita el filtro y vuelve a verse todo.
                onBuscar = { onBuscar(consulta.trim()) },
                onVolver = onVolver,
                onAlertas = onAlertas,
                onLogout = onLogout,
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FiltroDesplegable(categoriaElegida, categorias, onCategoria)
                FiltroDesplegable(comercioElegido, OpcionesComercio, onComercio)
                FiltroDesplegable("Ordenar por: $ordenElegido", OpcionesOrden, onOrden)
            }

            Box(Modifier.weight(1f).fillMaxWidth().nestedScroll(barra)) {
                when (estado) {
                    UiState.Loading -> CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = KestaGreen,
                    )

                    UiState.Idle, UiState.Empty -> Mensaje(
                        if (consultaAplicada.isBlank()) {
                            "Por ahora no hay productos para comparar."
                        } else {
                            "No encontramos productos que coincidan con \"${consultaAplicada.trim()}\"."
                        },
                    )

                    is UiState.Error -> Column(
                        modifier = Modifier.align(Alignment.Center).padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            estado.message,
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.Center,
                        )
                        Button(
                            onClick = onReintentar,
                            shape = KestaControlShape,
                            colors = ButtonDefaults.buttonColors(containerColor = KestaGreen),
                        ) { Text("Reintentar") }
                    }

                    is UiState.Success -> LazyColumn(
                        state = lista,
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 120.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        items(estado.data) { oferta ->
                            OfertaAhorroCard(
                                oferta = oferta,
                                onVerDetalle = { onVerDetalle(oferta) },
                                onAgregarACanasta = { onAgregarACanasta(oferta) },
                                onUbicacion = onUbicacion,
                            )
                        }
                        items(sinComparacion) { SinComparacionCard(it, onUbicacion) }
                    }
                }


                KestaBottomBar(
                    modifier = Modifier.align(Alignment.BottomCenter),
                    selected = null,
                    expandida = barra.expandida || !lista.canScrollBackward,
                    onInicio = onInicio,
                    onUbicacion = onMapa,
                    onReportar = onReportar,
                    onCanasta = onCanasta,
                    onPerfil = onPerfil,
                )
            }
        }
    }
}

// Encabezado y filtros
@Composable
private fun Encabezado(
    usuario: Usuario?,
    cerrandoSesion: Boolean,
    consulta: String,
    onConsultaChange: (String) -> Unit,
    onBuscar: () -> Unit,
    onVolver: () -> Unit,
    onAlertas: () -> Unit,
    onLogout: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(KestaGreen)
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).clickable(onClick = onVolver),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = Color.White)
            }
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text("Mayor ahorro", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("Mejores ofertas en tu zona", color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp)
            }
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.2f))
                    .clickable(onClick = onAlertas),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Notifications, contentDescription = "Alertas", tint = Color.White)
            }
            Spacer(Modifier.width(10.dp))
            KestaAvatar(usuario, cerrandoSesion, onLogout)
        }
        Spacer(Modifier.height(14.dp))
        KestaSearchField(value = consulta, onValueChange = onConsultaChange, onSearch = onBuscar)
    }
}

@Composable
private fun FiltroDesplegable(
    etiqueta: String,
    opciones: List<String>,
    onElegir: (String) -> Unit,
) {
    var abierto by remember { mutableStateOf(false) }
    val forma = RoundedCornerShape(8.dp)
    Box {
        Row(
            modifier = Modifier
                .clip(forma)
                .border(1.dp, KestaBorder, forma)
                .clickable(enabled = opciones.isNotEmpty()) { abierto = true }
                .padding(start = 12.dp, end = 6.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(etiqueta, fontSize = 13.sp, color = KestaTextPrimary)
            Icon(
                Icons.Filled.KeyboardArrowDown,
                contentDescription = null,
                tint = KestaTextMuted,
                modifier = Modifier.size(18.dp),
            )
        }
        DropdownMenu(expanded = abierto, onDismissRequest = { abierto = false }) {
            opciones.forEach { opcion ->
                DropdownMenuItem(
                    text = { Text(opcion) },
                    onClick = {
                        abierto = false
                        onElegir(opcion)
                    },
                )
            }
        }
    }
}

@Composable
private fun Mensaje(texto: String) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Text(texto, color = KestaTextMuted, fontSize = 15.sp, textAlign = TextAlign.Center)
    }
}

// Tarjeta de oferta
@Composable
private fun OfertaAhorroCard(
    oferta: OfertaAhorroUi,
    onVerDetalle: () -> Unit,
    onAgregarACanasta: () -> Unit,
    onUbicacion: (PrecioOfertaUi) -> Unit,
) {
    val forma = RoundedCornerShape(14.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(forma)
            .background(Color.White)
            .border(1.dp, KestaBorder, forma)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(oferta.icono, fontSize = 30.sp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(oferta.producto, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = KestaTextPrimary)
                Text(oferta.presentacion, fontSize = 12.sp, color = KestaTextMuted)
            }
            Column(
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(KestaGold).padding(horizontal = 10.dp, vertical = 5.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(oferta.ahorroPorcentaje, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text(oferta.ahorroPesos, color = Color.White, fontSize = 10.sp)
            }
        }

        PrecioFila(oferta.mejor, destacado = true, onUbicacion = onUbicacion)

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            HorizontalDivider(Modifier.weight(1f), color = KestaBorder)
            Text("VS", fontSize = 11.sp, color = KestaTextMuted)
            HorizontalDivider(Modifier.weight(1f), color = KestaBorder)
        }

        PrecioFila(oferta.comparado, destacado = false, onUbicacion = onUbicacion)

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = onVerDetalle,
                shape = KestaControlShape,
                border = BorderStroke(1.dp, KestaGreen),
                modifier = Modifier.weight(1f).height(44.dp),
            ) { Text("Ver detalle", color = KestaGreen, fontWeight = FontWeight.Bold, fontSize = 13.sp) }
            Button(
                onClick = onAgregarACanasta,
                shape = KestaControlShape,
                colors = ButtonDefaults.buttonColors(containerColor = KestaGreen, contentColor = Color.White),
                contentPadding = PaddingValues(horizontal = 8.dp),
                modifier = Modifier.weight(1f).height(44.dp),
            ) { Text("+ Agregar a canasta", fontWeight = FontWeight.Bold, fontSize = 13.sp) }
        }
    }
}

@Composable
private fun SinComparacionCard(item: SinComparacionUi, onUbicacion: (PrecioOfertaUi) -> Unit) {
    val forma = RoundedCornerShape(14.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(forma)
            .background(Color.White)
            .border(1.dp, KestaBorder, forma)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(item.icono, fontSize = 30.sp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(item.producto, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = KestaTextPrimary)
                Text(item.presentacion, fontSize = 12.sp, color = KestaTextMuted)
            }
        }
        Text(
            item.aviso,
            fontSize = 12.sp,
            color = KestaTextPrimary,
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(KestaGoldLight)
                .padding(10.dp),
        )
        PrecioFila(item.precio, destacado = true, onUbicacion = onUbicacion, mostrarMejorPrecio = false)
    }
}

@Composable
private fun PrecioFila(
    precio: PrecioOfertaUi,
    destacado: Boolean,
    onUbicacion: (PrecioOfertaUi) -> Unit,
    /** La etiqueta "Mejor precio" solo tiene sentido cuando hay otro precio con el que compararlo. */
    mostrarMejorPrecio: Boolean = destacado,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (destacado) KestaGreenLight else KestaTabInactive)
            .padding(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                EtiquetaCanal(precio.canal, precio.informal)
                if (mostrarMejorPrecio) Text("Mejor precio", fontSize = 10.sp, color = KestaGreen, fontWeight = FontWeight.Bold)
            }
            Text(
                precio.comercio,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = if (destacado) KestaTextPrimary else KestaTextMuted,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Place, contentDescription = null, tint = KestaTextMuted, modifier = Modifier.size(12.dp))
                Spacer(Modifier.width(2.dp))
                Text(precio.detalle, fontSize = 11.sp, color = KestaTextMuted)
            }
            if (precio.verificado) {
                Text("✓ Comunidad verificada", fontSize = 10.sp, color = KestaGreen)
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    precio.precio,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (destacado) KestaTextPrimary else KestaTextMuted,
                    textDecoration = if (destacado) TextDecoration.None else TextDecoration.LineThrough,
                )
                Text(precio.unidad, fontSize = 12.sp, color = KestaTextMuted)
            }
            Text(
                text = "Ubicación",
                fontSize = 11.sp,
                color = KestaTextPrimary,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .border(1.dp, KestaBorder, RoundedCornerShape(6.dp))
                    .clickable { onUbicacion(precio) }
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            )
        }
    }
}

/** Pastilla de color que distingue el canal, dorada para tianguis, verde para supermercado. */
@Composable
private fun EtiquetaCanal(texto: String, informal: Boolean) {
    val color = if (informal) KestaGold else KestaGreen
    val forma = RoundedCornerShape(50)
    Text(
        text = texto,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        color = color,
        modifier = Modifier
            .clip(forma)
            .background(if (informal) KestaGoldLight else Color.White)
            .border(1.dp, color, forma)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}
