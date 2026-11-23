package com.kesta.app.ui.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalUriHandler
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.kesta.app.core.ui.UiState
import com.kesta.app.data.location.Location
import com.kesta.app.data.location.rememberLocationProvider
import com.kesta.app.data.location.rememberPermisoUbicacion
import com.kesta.app.data.auth.Usuario
import com.kesta.app.di.AppContainer
import com.kesta.app.ui.comparison.ComparisonViewModel
import com.kesta.app.ui.comparison.MayorAhorroContent
import com.kesta.app.ui.location.LocationViewModel
import com.kesta.app.ui.location.OrigenUbicacion
import com.kesta.app.ui.ofertas.FiltroComercio
import com.kesta.app.ui.ofertas.OrdenOfertas
import com.kesta.app.ui.ofertas.armarHome
import com.kesta.app.ui.ofertas.armarMayorAhorro
import com.kesta.app.ui.ofertas.urlDeRuta
import com.kesta.app.ui.search.SearchViewModel

/** Las pantallas entre las que se puede navegar. */
private enum class Destino { INICIO, MAYOR_AHORRO }

/**
 * Guarda la pantalla actual como texto ("INICIO" o "MAYOR_AHORRO") para que, al girar el teléfono,
 * la app siga en la misma pantalla en lugar de volver al Home.
 */
private val DestinoSaver = Saver<Destino, String>(save = { it.name }, restore = { Destino.valueOf(it) })

/** Texto de la primera opción del filtro de categorías (significa "sin filtro"). */
private const val TODAS_LAS_CATEGORIAS = "Todas"

/**
 * Es el "director de orquesta" de las pantallas. No dibuja nada por sí mismo:
 * conecta las pantallas con sus ViewModels y decide cuál mostrar.
 *
 * - SearchViewModel: lo que se busca y el filtro de categoría.
 * - ComparisonViewModel: la comparación de precios formal vs. informal de los productos encontrados.
 * - LocationViewModel: desde dónde se busca y a qué distancia.
 */
@Composable
fun MainFlow(usuario: Usuario?, cerrandoSesion: Boolean, onLogout: () -> Unit) {
    // Pantalla que se está viendo.
    var destino by rememberSaveable(stateSaver = DestinoSaver) { mutableStateOf(Destino.INICIO) }
    var comercioNombre by rememberSaveable { mutableStateOf(FiltroComercio.TODOS.name) }
    var ordenNombre by rememberSaveable { mutableStateOf(OrdenOfertas.MAYOR_AHORRO.name) }
    val comercio = FiltroComercio.valueOf(comercioNombre)
    val orden = OrdenOfertas.valueOf(ordenNombre)

    // ViewModel de la búsqueda
    val searchVm: SearchViewModel = viewModel(
        factory = viewModelFactory { initializer { SearchViewModel(AppContainer.catalogRepository) } },
    )
    // El GPS y el permiso dependen del teléfono, por eso vienen de cada plataforma (Android / iOS).
    val locationProvider = rememberLocationProvider()
    // ViewModel de la ubicación
    val locationVm: LocationViewModel = viewModel(
        factory = viewModelFactory { initializer { LocationViewModel(locationProvider) } },
    )

    // Permiso de ubicación.
    val permiso = rememberPermisoUbicacion { aceptado ->
        // Si lo niega se queda en el centro de Morelia.
        if (aceptado) locationVm.usarUbicacionActual()
    }

    // ViewModel de la comparación de precios formal vs informal.
    val comparisonVm: ComparisonViewModel = viewModel(
        factory = viewModelFactory { initializer { ComparisonViewModel(AppContainer.priceRepository) } },
    )

    val search by searchVm.state.collectAsStateWithLifecycle()
    val ubicacion by locationVm.state.collectAsStateWithLifecycle()
    val listado by comparisonVm.listado.collectAsStateWithLifecycle()
    val home = armarHome(search.resultados, listado)
    val uriHandler = LocalUriHandler.current

    // Cada vez que cambian los productos encontrados (o la ubicación o el radio), se piden sus precios.
    // Si ya se pidió exactamente lo mismo, el ViewModel no lo repite.
    val productos = (search.resultados as? UiState.Success)?.data
    LaunchedEffect(productos, ubicacion.ubicacion, ubicacion.radioKm) {
        if (productos != null) {
            // Un producto puede tener varias presentaciones (1 kg, 500 g...), se compara cada una.
            val ids = productos.flatMap { p -> p.presentaciones.map { it.id } }
            comparisonVm.cargarListado(ids, ubicacion.ubicacion, ubicacion.radioKm)
        }
    }

    // Al abrir la app, con permiso ya concedido se usa la ubicación del teléfono; si nunca se
    // ha pedido (primera vez tras instalar), se muestra la ventana de permiso.
    LaunchedEffect(Unit) {
        if (permiso.concedido()) {
            locationVm.arrancarConUbicacionActual()
        } else if (!permiso.yaSePregunto()) {
            permiso.solicitar()
        }
    }

    // Volver al Home deja la búsqueda en blanco, para que el Home muestre todos los productos.
    fun irAlInicio() {
        searchVm.nuevaBusqueda("")
        destino = Destino.INICIO
    }

    // Muestra la pantalla que corresponda según [destino].
    when (destino) {
        Destino.INICIO -> HomeContent(
            usuario = usuario,
            cerrandoSesion = cerrandoSesion,
            onLogout = onLogout,
            ubicacion = when {
                ubicacion.buscando -> "Buscando…"
                ubicacion.origen == OrigenUbicacion.UBICACION_ACTUAL -> ubicacion.direccion?.titulo ?: "Mi ubicación actual"
                else -> "Centro de Morelia"
            },
            usandoUbicacionActual = ubicacion.origen == OrigenUbicacion.UBICACION_ACTUAL,
            direccionActual = ubicacion.direccion?.titulo ?: "Mi ubicación actual",
            detalleDireccionActual = ubicacion.direccion?.detalle ?: "Usar el GPS del teléfono",
            onElegirUbicacion = { usarActual ->
                when {
                    !usarActual -> locationVm.usarCentroDeMorelia()
                    permiso.concedido() -> locationVm.usarUbicacionActual()
                    else -> permiso.solicitar() // al aceptar, el resultado activa la ubicación actual
                }
            },
            ofertas = home.ofertas,
            frecuentes = home.frecuentes,
            mensajeEstado = home.mensaje,
            onReintentar = if (home.hayError) {
                { if (search.resultados is UiState.Error) searchVm.reintentar() else comparisonVm.reintentarListado() }
            } else null,
            // El buscador del Home abre "Mayor ahorro" con lo que se escribió.
            onBuscar = { texto ->
                searchVm.nuevaBusqueda(texto)
                destino = Destino.MAYOR_AHORRO
            },
            onProductoClick = { nombre ->
                searchVm.nuevaBusqueda(nombre)
                destino = Destino.MAYOR_AHORRO
            },
            onVerMayorAhorro = {
                searchVm.nuevaBusqueda("")
                destino = Destino.MAYOR_AHORRO
            },
        )

        Destino.MAYOR_AHORRO -> {
            val pantalla = armarMayorAhorro(search.resultados, listado, comercio, orden)
            MayorAhorroContent(
                usuario = usuario,
                cerrandoSesion = cerrandoSesion,
                onLogout = onLogout,
                estado = pantalla.estado,
                sinComparacion = pantalla.sinComparacion,
                categorias = listOf(TODAS_LAS_CATEGORIAS) + search.categorias.map { it.nombre },
                categoriaElegida = search.categorias.firstOrNull { it.id == search.categoriaId }?.nombre ?: "Categorías",
                comercioElegido = if (comercio == FiltroComercio.TODOS) "Comercio" else comercio.etiqueta,
                ordenElegido = orden.etiqueta,
                consultaAplicada = search.consulta,
                onBuscar = searchVm::buscar,
                // "Ubicación", abre la ruta desde donde está el usuario hasta el comercio
                onUbicacion = { precio ->
                    val lat = precio.lat
                    val lng = precio.lng
                    if (lat != null && lng != null) {
                        runCatching { uriHandler.openUri(
                            urlDeRuta(
                                ubicacion.ubicacion,
                                Location(lat, lng)
                            )
                        ) }
                    }
                },
                onCategoria = { nombre ->
                    searchVm.elegirCategoria(search.categorias.firstOrNull { it.nombre == nombre }?.id)
                },
                onComercio = { etiqueta -> comercioNombre = FiltroComercio.entries.first { it.etiqueta == etiqueta }.name },
                onOrden = { etiqueta -> ordenNombre = OrdenOfertas.entries.first { it.etiqueta == etiqueta }.name },
                onReintentar = {
                    if (search.resultados is UiState.Error) searchVm.reintentar() else comparisonVm.reintentarListado()
                },
                onVolver = ::irAlInicio,
                onInicio = ::irAlInicio,
            )
        }
    }
}