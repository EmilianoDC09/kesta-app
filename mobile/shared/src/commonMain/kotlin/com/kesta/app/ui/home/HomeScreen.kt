package com.kesta.app.ui.home

<<<<<<< Updated upstream
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeContentPadding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
=======
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
>>>>>>> Stashed changes
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
<<<<<<< Updated upstream
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.repository.ApiStatus
import com.kesta.app.di.AppContainer
import com.kesta.app.ui.theme.KestaGold
=======
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
import com.kesta.app.data.auth.Usuario
import com.kesta.app.ui.components.KestaAvatar
import com.kesta.app.ui.components.KestaBottomBar
import com.kesta.app.ui.components.KestaSearchField
import com.kesta.app.ui.components.KestaTab
import com.kesta.app.ui.components.SystemBarsIcons
import com.kesta.app.ui.components.rememberControlBarraInferior
import com.kesta.app.ui.theme.KestaBorder
import com.kesta.app.ui.theme.KestaGold
import com.kesta.app.ui.theme.KestaGreen
import com.kesta.app.ui.theme.KestaRed
import com.kesta.app.ui.theme.KestaTextMuted
import com.kesta.app.ui.theme.KestaTextPrimary
import com.kesta.app.ui.theme.KestaTheme
>>>>>>> Stashed changes


data class OfertaUi(
    val nombre: String,
    val precio: String,
    val precioAnterior: String,
    val ahorro: String,
    val comercio: String,
    val icono: String,
)

data class AlertaUi(
    val nombre: String,
    val lugar: String,
    val cambio: String,
    val subio: Boolean,
    val icono: String,
)

data class ProductoFrecuenteUi(
    val nombre: String,
    val precio: String,
    val icono: String,
)

data class ServicioUi(
    val nombre: String,
    val precio: String,
    val icono: String,
)

/**
 * Pantalla de inicio. Conserva los tres datos que le da App (usuario, cerrandoSesion, onLogout)
 * para no tocar la navegación de sesión
 *
 * La navegación entre Home y Mayor ahorro vive en MainFlow.
 */
@Composable
fun HomeScreen(
<<<<<<< Updated upstream
    viewModel: HomeViewModel = viewModel<HomeViewModel>(
        factory = viewModelFactory {
            initializer { HomeViewModel(AppContainer.apiStatusRepository) }
        }
    ),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeContent(state = state, onCheckConnection = viewModel::checkConnection)
=======
    usuario: Usuario?,
    cerrandoSesion: Boolean,
    onLogout: () -> Unit,
) {
    MainFlow(
        usuario = usuario,
        cerrandoSesion = cerrandoSesion,
        onLogout = onLogout,
    )
>>>>>>> Stashed changes
}

/** Sin ViewModel: fácil de previsualizar. Cada acción del usuario sale por una función. */
@Composable
fun HomeContent(
<<<<<<< Updated upstream
    state: UiState<ApiStatus>,
    onCheckConnection: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().safeContentPadding().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = buildAnnotatedString {
                    append("ke")
                    withStyle(SpanStyle(color = KestaGold)) { append("S") }
                    append("ta")
                },
                fontSize = 56.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Compara precios entre tiendas y tianguis para ahorrar y comprar mejor.",
                style = MaterialTheme.typography.bodyLarge,
            )
            Spacer(Modifier.height(32.dp))
            Button(
                onClick = onCheckConnection,
                enabled = state !is UiState.Loading,
            ) {
                Text("Probar conexion con el servidor")
            }
            Spacer(Modifier.height(16.dp))
            when (state) {
                UiState.Idle -> Unit
                UiState.Loading -> CircularProgressIndicator()
                UiState.Empty -> Text("Sin datos")
                is UiState.Success -> Text("Servidor disponible (HTTP ${state.data.httpCode})")
                is UiState.Error -> Text(
                    text = "Error: ${state.message}",
                    color = MaterialTheme.colorScheme.error,
=======
    usuario: Usuario?,
    cerrandoSesion: Boolean,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
    /** Texto que se ve en el encabezado: "Centro de Morelia", "Mi ubicación actual" o "Buscando…". */
    ubicacion: String = "Centro de Morelia",
    /** true si se está usando la ubicación del teléfono (marca la opción elegida en el menú). */
    usandoUbicacionActual: Boolean = false,
    /** Calle y número del teléfono (ej. "Calle Fresa 9") y debajo código postal y ciudad. */
    direccionActual: String = "Mi ubicación actual",
    detalleDireccionActual: String = "Usar el GPS del teléfono",
    ofertas: List<OfertaUi> = emptyList(),
    alertas: List<AlertaUi> = emptyList(),
    frecuentes: List<ProductoFrecuenteUi> = emptyList(),
    servicios: List<ServicioUi> = emptyList(),
    /** "Cargando…" o el error cuando no hay secciones que mostrar. Null = el texto de ayuda de siempre. */
    mensajeEstado: String? = null,
    /** Si no es null, se muestra el botón "Reintentar". */
    onReintentar: (() -> Unit)? = null,
    onBuscar: (String) -> Unit = {},
    /** El usuario eligió una opción del menú: true = mi ubicación actual, false = centro de Morelia. */
    onElegirUbicacion: (usarUbicacionActual: Boolean) -> Unit = {},
    onAlertas: () -> Unit = {},
    onVerMayorAhorro: () -> Unit = {},
    onVerAlertas: () -> Unit = {},
    onVerServicios: () -> Unit = {},
    onProductoClick: (String) -> Unit = {},
    onMapa: () -> Unit = {},
    onReportar: () -> Unit = {},
    onCanasta: () -> Unit = {},
    onPerfil: () -> Unit = {},
) {
    SystemBarsIcons(lightIcons = true)
    var consulta by rememberSaveable { mutableStateOf("") }
    val buscar = { if (consulta.isNotBlank()) onBuscar(consulta.trim()) }
    val scroll = rememberScrollState()
    val barra = rememberControlBarraInferior()

    Surface(modifier = modifier.fillMaxSize(), color = Color.White) {
        Column(Modifier.fillMaxSize()) {
            HomeHeader(
                usuario = usuario,
                cerrandoSesion = cerrandoSesion,
                ubicacion = ubicacion,
                usandoUbicacionActual = usandoUbicacionActual,
                direccionActual = direccionActual,
                detalleDireccionActual = detalleDireccionActual,
                consulta = consulta,
                onConsultaChange = { consulta = it },
                onBuscar = buscar,
                onElegirUbicacion = onElegirUbicacion,
                onAlertas = onAlertas,
                onLogout = onLogout,
            )

            Box(Modifier.weight(1f).fillMaxWidth().nestedScroll(barra)) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scroll)
                        .padding(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 120.dp),
                    verticalArrangement = Arrangement.spacedBy(22.dp),
                ) {
                    if (ofertas.isNotEmpty()) {
                        Seccion("Mayor ahorro", onVerMas = onVerMayorAhorro) {
                            FilaDesplazable { ofertas.forEach { OfertaCard(it) } }
                        }
                    }
                    if (alertas.isNotEmpty()) {
                        Seccion("Alertas Recientes", onVerMas = onVerAlertas) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                alertas.forEach { AlertaCard(it) }
                            }
                        }
                    }
                    if (frecuentes.isNotEmpty()) {
                        Seccion("Productos frecuentes") {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                frecuentes.chunked(3).forEach { fila ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    ) {
                                        fila.forEach { ProductoFrecuenteCard(it, Modifier.weight(1f), onProductoClick) }
                                        repeat(3 - fila.size) { Spacer(Modifier.weight(1f)) }
                                    }
                                }
                            }
                        }
                    }
                    if (servicios.isNotEmpty()) {
                        Seccion("Servicios del hogar", onVerMas = onVerServicios) {
                            FilaDesplazable { servicios.forEach { ServicioCard(it) } }
                        }
                    }
                    if (ofertas.isEmpty() && alertas.isEmpty() && frecuentes.isEmpty() && servicios.isEmpty()) {
                        Text(
                            text = mensajeEstado ?: "Escribe un producto arriba para comparar su precio entre supermercados y tianguis.",
                            color = KestaTextMuted,
                            fontSize = 15.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth().padding(top = 40.dp),
                        )
                        if (onReintentar != null) {
                            Text(
                                text = "Reintentar",
                                color = KestaGreen,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().clickable(onClick = onReintentar).padding(12.dp),
                            )
                        }
                    }
                }

                KestaBottomBar(
                    modifier = Modifier.align(Alignment.BottomCenter),
                    selected = KestaTab.INICIO,
                    // Las opciones se juntan al hacer scroll y reaparecen cuando se vuelve hasta arriba.
                    expandida = barra.expandida || !scroll.canScrollBackward,
                    onInicio = {},
                    onUbicacion = onMapa,
                    onReportar = onReportar,
                    onCanasta = onCanasta,
                    onPerfil = onPerfil,
>>>>>>> Stashed changes
                )
            }
        }
    }
}

// Encabezado

@Composable
private fun OpcionUbicacion(titulo: String, detalle: String, elegida: Boolean, onClick: () -> Unit) {
    DropdownMenuItem(
        modifier = Modifier.background(if (elegida) Color(0xFFF5F5F5) else Color.White),
        leadingIcon = {
            Icon(
                imageVector = if (elegida) Icons.Filled.LocationOn else Icons.Outlined.LocationOn,
                contentDescription = null,
                tint = KestaTextPrimary,
            )
        },
        text = {
            Column {
                Text(titulo, color = KestaTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text(detalle, color = KestaTextMuted, fontSize = 13.sp)
            }
        },
        onClick = onClick,
    )
}

@Composable
private fun HomeHeader(
    usuario: Usuario?,
    cerrandoSesion: Boolean,
    ubicacion: String,
    usandoUbicacionActual: Boolean,
    direccionActual: String,
    detalleDireccionActual: String,
    consulta: String,
    onConsultaChange: (String) -> Unit,
    onBuscar: () -> Unit,
    onElegirUbicacion: (Boolean) -> Unit,
    onAlertas: () -> Unit,
    onLogout: () -> Unit,
) {
    var menuUbicacion by remember { mutableStateOf(false) }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(KestaGreen)
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) {
                Column(Modifier.clickable { menuUbicacion = true }) {
                    Text("Ubicación actual", color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(ubicacion, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        Icon(
                            Icons.Filled.KeyboardArrowDown,
                            contentDescription = "Cambiar ubicación",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
                DropdownMenu(
                    expanded = menuUbicacion,
                    onDismissRequest = { menuUbicacion = false },
                    containerColor = Color.White,
                    modifier = Modifier.widthIn(min = 300.dp),
                ) {
                    OpcionUbicacion("Centro de Morelia", "Morelia, Michoacán de Ocampo", elegida = !usandoUbicacionActual) {
                        menuUbicacion = false
                        onElegirUbicacion(false)
                    }
                    HorizontalDivider(color = KestaBorder)
                    OpcionUbicacion(direccionActual, detalleDireccionActual, elegida = usandoUbicacionActual) {
                        menuUbicacion = false
                        onElegirUbicacion(true)
                    }
                }
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

// Secciones y tarjetas

private val FormaTarjeta = RoundedCornerShape(14.dp)

private fun Modifier.tarjeta() = this
    .clip(FormaTarjeta)
    .background(Color.White)
    .border(1.dp, KestaBorder, FormaTarjeta)

@Composable
private fun Seccion(
    titulo: String,
    onVerMas: (() -> Unit)? = null,
    contenido: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .then(if (onVerMas != null) Modifier.clickable(onClick = onVerMas) else Modifier),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(titulo, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = KestaTextPrimary)
            if (onVerMas != null) {
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Ver todo", tint = KestaTextPrimary)
            }
        }
        contenido()
    }
}

@Composable
private fun FilaDesplazable(contenido: @Composable () -> Unit) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) { contenido() }
}

@Composable
private fun OfertaCard(oferta: OfertaUi) {
    Column(
        modifier = Modifier.width(140.dp).tarjeta().padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(oferta.icono, fontSize = 26.sp)
        Text(oferta.nombre, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = KestaTextPrimary)
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(oferta.precio, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = KestaTextPrimary)
            Text(
                oferta.precioAnterior,
                fontSize = 10.sp,
                color = KestaTextMuted,
                textDecoration = TextDecoration.LineThrough,
            )
        }
        Text(
            text = oferta.ahorro,
            fontSize = 10.sp,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(KestaGold).padding(horizontal = 6.dp, vertical = 2.dp),
        )
        Text(oferta.comercio, fontSize = 10.sp, color = KestaTextMuted)
    }
}

@Composable
private fun AlertaCard(alerta: AlertaUi) {
    val color = if (alerta.subio) KestaRed else KestaGreen
    Row(
        modifier = Modifier.fillMaxWidth().tarjeta().padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(alerta.icono, fontSize = 26.sp)
        Column(Modifier.weight(1f)) {
            Text(alerta.nombre, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = KestaTextPrimary)
            Text(alerta.lugar, fontSize = 12.sp, color = KestaTextMuted)
        }
        Text(if (alerta.subio) "▲" else "▼", color = color, fontSize = 12.sp)
        Text(alerta.cambio, color = color, fontWeight = FontWeight.Bold, fontSize = 15.sp)
    }
}

@Composable
private fun ProductoFrecuenteCard(
    producto: ProductoFrecuenteUi,
    modifier: Modifier,
    onClick: (String) -> Unit,
) {
    Column(
        modifier = modifier
            .tarjeta()
            .clickable { onClick(producto.nombre) }
            .padding(vertical = 12.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(producto.icono, fontSize = 28.sp)
        Text(
            producto.nombre,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = KestaTextPrimary,
            textAlign = TextAlign.Center,
        )
        Text(producto.precio, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = KestaTextPrimary)
    }
}

@Composable
private fun ServicioCard(servicio: ServicioUi) {
    Row(
        modifier = Modifier.width(190.dp).tarjeta().padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(servicio.icono, fontSize = 24.sp)
        Column {
            Text(servicio.nombre, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = KestaTextPrimary)
            Text("desde ${servicio.precio}", fontSize = 12.sp, color = KestaTextMuted)
        }
    }
}

// ---------------------------------------------------------------------------
// Vistas previas (solo para ver el diseño en Android Studio; no se usan en la app)
// ---------------------------------------------------------------------------

private val EjemploOfertas = listOf(
    OfertaUi("Aguacate", "$45", "$54", "Ahorro 48%", "Tianguis del Tec", "🥑"),
    OfertaUi("Jitomate", "$18", "$35", "Ahorro 48%", "Walmart", "🍅"),
    OfertaUi("Gasolina premium", "$30", "$32", "Ahorro 6%", "Gasolinera Pemex", "⛽"),
)
private val EjemploAlertas = listOf(AlertaUi("Frijol Junio", "Morelia", "25%", subio = true, icono = "🫘"))
private val EjemploFrecuentes = listOf(
    ProductoFrecuenteUi("Frijol Junio", "$18", "🫘"),
    ProductoFrecuenteUi("Huevo", "$30", "🥚"),
    ProductoFrecuenteUi("Aguacate", "$54", "🥑"),
    ProductoFrecuenteUi("Jitomate", "$25", "🍅"),
    ProductoFrecuenteUi("Gasolina premium", "$26", "⛽"),
    ProductoFrecuenteUi("Leche", "$22", "🥛"),
)
private val EjemploServicios = listOf(
    ServicioUi("Gasolina premium", "$25 /lt", "⛽"),
    ServicioUi("Gas LP", "$15 /kg", "💧"),
)

@Preview
@Composable
private fun HomeConContenidoPreview() {
    KestaTheme {
        HomeContent(
            usuario = null,
            cerrandoSesion = false,
            onLogout = {},
            ofertas = EjemploOfertas,
            alertas = EjemploAlertas,
            frecuentes = EjemploFrecuentes,
            servicios = EjemploServicios,
        )
    }
}

@Preview
@Composable
private fun HomeSinDatosPreview() {
    KestaTheme {
        HomeContent(usuario = null, cerrandoSesion = false, onLogout = {})
    }
}