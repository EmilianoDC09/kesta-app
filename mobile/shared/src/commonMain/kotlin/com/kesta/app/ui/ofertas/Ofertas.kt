package com.kesta.app.ui.ofertas

import com.kesta.app.core.ui.UiState
import com.kesta.app.data.catalog.Presentacion
import com.kesta.app.data.catalog.Producto
import com.kesta.app.data.comparison.Canal
import com.kesta.app.data.comparison.Comparacion
import com.kesta.app.data.comparison.PrecioEnComercio
import com.kesta.app.ui.comparison.OfertaAhorroUi
import com.kesta.app.ui.comparison.PrecioOfertaUi
import com.kesta.app.ui.comparison.SinComparacionUi
import com.kesta.app.ui.home.OfertaUi
import com.kesta.app.ui.home.ProductoFrecuenteUi

/*
 * Convierte lo que responde la base de datos (productos y sus precios) en las ofertas que se muestran
 */

/** Un producto con los precios que se encontraron cerca del usuario. */
data class DatosPrecio(
    val producto: Producto,
    val presentacion: Presentacion,
    val comparacion: Comparacion,
)

/** Una oferta: el precio más bajo de un tipo de comercio frente al más bajo del otro tipo. */
data class Oferta(
    val producto: Producto,
    val presentacion: Presentacion,
    val mejor: PrecioEnComercio,
    val comparado: PrecioEnComercio,
) {
    val ahorroPesos: Double get() = comparado.precio - mejor.precio
    val ahorroPorcentaje: Double get() = ahorroPesos / comparado.precio * 100.0
}

/**
 * Arma las comparaciones, solo cuentan los productos que tienen precio en supermercado Y en tianguis/mercado.*/
fun construirOfertas(datos: List<DatosPrecio>): List<Oferta> =
    datos.mapNotNull { d ->
        // La lista de comercios viene ordenada por cercanía: si hay empate de precio, gana el más cercano.
        val formal = d.comparacion.comercios.filter { it.canal == Canal.FORMAL }.minByOrNull { it.precio }
        val informal = d.comparacion.comercios.filter { it.canal == Canal.INFORMAL }.minByOrNull { it.precio }
        if (formal == null || informal == null) return@mapNotNull null
        val (mejor, comparado) = if (informal.precio < formal.precio) informal to formal else formal to informal
        Oferta(d.producto, d.presentacion, mejor, comparado)
    }.sortedByDescending { it.ahorroPorcentaje }

/** Un producto que solo tiene precios en un tipo de comercio de la zona: no se puede calcular un ahorro. */
data class SinComparacion(
    val producto: Producto,
    val presentacion: Presentacion,
    /** El precio más bajo del único tipo de comercio que sí tiene precios. */
    val precio: PrecioEnComercio,
)

/** Los productos que tienen precios en un solo tipo de comercio (la app avisa que falta el otro). */
fun construirSinComparacion(datos: List<DatosPrecio>): List<SinComparacion> =
    datos.mapNotNull { d ->
        val formal = d.comparacion.comercios.filter { it.canal == Canal.FORMAL }.minByOrNull { it.precio }
        val informal = d.comparacion.comercios.filter { it.canal == Canal.INFORMAL }.minByOrNull { it.precio }
        val unico = when {
            formal != null && informal == null -> formal
            informal != null && formal == null -> informal
            else -> return@mapNotNull null
        }
        SinComparacion(d.producto, d.presentacion, unico)
    }

/** Qué tipo de comercio ve el filtro "Comercio" de Mayor ahorro. */
enum class FiltroComercio(val etiqueta: String, val canal: Canal?) {
    TODOS("Todos", null),
    SUPERMERCADO("Supermercado", Canal.FORMAL),
    TIANGUIS("Tianguis", Canal.INFORMAL),
}

enum class OrdenOfertas(val etiqueta: String) {
    MAYOR_AHORRO("Mayor ahorro"),
    MENOR_PRECIO("Menor precio"),
    MAS_CERCANO("Más cercano"),
}

/**
 * Aplica "Comercio" y "Ordenar por". La búsqueda y la categoría ya las resolvió el servidor.
 * "Comercio" deja las ofertas cuyo precio más bajo es de ese tipo de comercio.
 */
fun filtrarOfertas(
    ofertas: List<Oferta>,
    comercio: FiltroComercio,
    orden: OrdenOfertas,
): List<Oferta> {
    val filtradas = ofertas.filter { o -> comercio.canal == null || o.mejor.canal == comercio.canal }
    return when (orden) {
        OrdenOfertas.MAYOR_AHORRO -> filtradas.sortedByDescending { it.ahorroPorcentaje }
        OrdenOfertas.MENOR_PRECIO -> filtradas.sortedBy { it.mejor.precio }
        OrdenOfertas.MAS_CERCANO -> filtradas.sortedBy { it.mejor.distanciaKm ?: Double.MAX_VALUE }
    }
}

// ---------------------------------------------------------------------------
// De oferta a lo que dibujan las pantallas (textos ya con formato)
// ---------------------------------------------------------------------------

/** Emoji del producto según su nombre; 🛒 si no se reconoce. */
fun iconoDe(nombre: String): String {
    val n = nombre.lowercase()
    return when {
        "aceite" in n -> "🫒"
        "jitomate" in n || "tomate" in n -> "🍅"
        "leche" in n -> "🥛"
        "huevo" in n -> "🥚"
        "frijol" in n -> "🫘"
        "aguacate" in n -> "🥑"
        "tortilla" in n -> "🫓"
        "arroz" in n -> "🍚"
        "azucar" in n || "azúcar" in n -> "🍬"
        "cebolla" in n -> "🧅"
        "limon" in n || "limón" in n -> "🍋"
        else -> "🛒"
    }
}

private fun PrecioEnComercio.detalle(): String =
    listOfNotNull(distanciaKm?.comoKm(), "${fuente.etiqueta}, ${
        fechaCorta(
            fechaCaptura
        )
    }").joinToString(" · ")

private fun PrecioEnComercio.aPrecioOfertaUi(unidad: String) = PrecioOfertaUi(
    canal = canal.etiqueta,
    informal = canal == Canal.INFORMAL,
    comercio = comercio,
    detalle = detalle(),
    verificado = verificado,
    precio = precio.comoPesos(),
    unidad = "/$unidad",
    lat = ubicacion.lat,
    lng = ubicacion.lng,
)

fun Oferta.aOfertaAhorroUi() = OfertaAhorroUi(
    producto = producto.nombre,
    icono = iconoDe(producto.nombre),
    presentacion = "por ${presentacion.cantidad.comoCantidad()} ${presentacion.unidad}",
    ahorroPorcentaje = "Ahorro ${ahorroPorcentaje.comoPorcentaje()}",
    ahorroPesos = "${ahorroPesos.comoPesos()} MXN",
    mejor = mejor.aPrecioOfertaUi(presentacion.unidad),
    comparado = comparado.aPrecioOfertaUi(presentacion.unidad),
)

/** La versión corta de la oferta para las tarjetas del Home. */
fun Oferta.aOfertaUi() = OfertaUi(
    nombre = producto.nombre,
    precio = mejor.precio.comoPesos(),
    precioAnterior = comparado.precio.comoPesos(),
    ahorro = "Ahorro ${ahorroPorcentaje.comoPorcentaje()}",
    comercio = mejor.comercio,
    icono = iconoDe(producto.nombre),
)

/** Un producto para "Productos frecuentes": su precio más bajo. Null si no tiene precios. */
fun DatosPrecio.aProductoFrecuenteUi(): ProductoFrecuenteUi? {
    val precio = comparacion.comercios.minOfOrNull { it.precio } ?: return null
    return ProductoFrecuenteUi(
        nombre = producto.nombre,
        precio = precio.comoPesos(),
        icono = iconoDe(producto.nombre)
    )
}

fun SinComparacion.aSinComparacionUi(): SinComparacionUi {
    val falta = if (precio.canal == Canal.FORMAL) Canal.INFORMAL else Canal.FORMAL
    return SinComparacionUi(
        producto = producto.nombre,
        icono = iconoDe(producto.nombre),
        presentacion = etiquetaPresentacion(
            presentacion.marca,
            presentacion.cantidad,
            presentacion.unidad
        ),
        aviso = "Todavía no hay precios de ${falta.etiqueta.lowercase()} en tu zona, así que no podemos calcular el ahorro.",
        precio = precio.aPrecioOfertaUi(presentacion.unidad),
    )
}

/** Lo que dibuja "Mayor ahorro": la lista de ofertas y, aparte, los productos que no se pueden comparar. */
data class PantallaMayorAhorro(
    val estado: UiState<List<OfertaAhorroUi>>,
    val sinComparacion: List<SinComparacionUi> = emptyList(),
)

/** Junta cada presentación de los productos con su comparación de precios (las que ya llegaron). */
fun datosDe(productos: List<Producto>, comparaciones: Map<Int, Comparacion>): List<DatosPrecio> =
    productos.flatMap { p -> p.presentaciones.mapNotNull { pr -> comparaciones[pr.id]?.let { DatosPrecio(p, pr, it) } } }

/** Lo que dibuja el Home: las mejores ofertas y los productos con su precio más bajo. */
data class PantallaHome(
    val ofertas: List<com.kesta.app.ui.home.OfertaUi> = emptyList(),
    val frecuentes: List<com.kesta.app.ui.home.ProductoFrecuenteUi> = emptyList(),
    /** "Cargando…" o el error, para no dejar el Home en blanco sin explicación. Null = nada que avisar. */
    val mensaje: String? = null,
    val hayError: Boolean = false,
)

/**
 * Decide qué se ve en el Home. Mientras carga, o si algo falla, el Home queda sin esas secciones
 * (no hay estados de carga propios en el Home). Muestra hasta 5 ofertas y 6 productos.
 */
fun armarHome(
    resultados: UiState<List<Producto>>,
    listado: UiState<Map<Int, Comparacion>>,
): PantallaHome {
    val (mensaje, hayError) = when {
        resultados is UiState.Error -> resultados.message to true
        resultados is UiState.Success && listado is UiState.Error -> listado.message to true
        resultados is UiState.Idle || resultados is UiState.Loading -> "Cargando productos…" to false
        resultados is UiState.Success && (listado is UiState.Idle || listado is UiState.Loading) -> "Cargando productos…" to false
        else -> null to false
    }
    if (resultados !is UiState.Success || listado !is UiState.Success) return PantallaHome(mensaje = mensaje, hayError = hayError)
    val datos = datosDe(resultados.data, listado.data)
    return PantallaHome(
        ofertas = construirOfertas(datos).take(5).map { it.aOfertaUi() },
        frecuentes = datos.mapNotNull { it.aProductoFrecuenteUi() }.distinctBy { it.nombre }.take(6),
    )
}

/**
 * Decide qué se ve en "Mayor ahorro" a partir de:
 * - [resultados]: los productos que encontró la búsqueda (ya con texto y categoría aplicados);
 * - [listado]: la comparación de precios de cada presentación de esos productos.
 * [comercio] y [orden] se aplican aquí porque no los conoce el servidor.
 */
fun armarMayorAhorro(
    resultados: UiState<List<Producto>>,
    listado: UiState<Map<Int, Comparacion>>,
    comercio: FiltroComercio,
    orden: OrdenOfertas,
): PantallaMayorAhorro = when (resultados) {
    UiState.Idle, UiState.Loading -> PantallaMayorAhorro(UiState.Loading)
    UiState.Empty -> PantallaMayorAhorro(UiState.Empty)
    is UiState.Error -> PantallaMayorAhorro(UiState.Error(resultados.message))
    is UiState.Success -> when (listado) {
        UiState.Idle, UiState.Loading -> PantallaMayorAhorro(UiState.Loading)
        UiState.Empty -> PantallaMayorAhorro(UiState.Empty)
        is UiState.Error -> PantallaMayorAhorro(UiState.Error(listado.message))
        is UiState.Success -> {
            val ids = resultados.data.flatMap { p -> p.presentaciones.map { it.id } }
            if (ids.none { it in listado.data }) {
                // Todavía son las comparaciones de la búsqueda anterior: se espera a las nuevas.
                PantallaMayorAhorro(UiState.Loading)
            } else {
                val datos = datosDe(resultados.data, listado.data)
                val ofertas = filtrarOfertas(construirOfertas(datos), comercio, orden)
                val sin = construirSinComparacion(datos)
                    .filter { comercio.canal == null || it.precio.canal == comercio.canal }
                if (ofertas.isEmpty() && sin.isEmpty()) {
                    PantallaMayorAhorro(UiState.Empty)
                } else {
                    PantallaMayorAhorro(
                        estado = UiState.Success(ofertas.map { it.aOfertaAhorroUi() }),
                        sinComparacion = sin.map { it.aSinComparacionUi() },
                    )
                }
            }
        }
    }
}