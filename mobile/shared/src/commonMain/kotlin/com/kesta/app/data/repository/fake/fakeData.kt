package com.kesta.app.data.repository.fake

import com.kesta.app.domain.model.Canal
import com.kesta.app.domain.model.Canasta
import com.kesta.app.domain.model.CanastaItem
import com.kesta.app.domain.model.Categoria
import com.kesta.app.domain.model.Ciudad
import com.kesta.app.domain.model.Fuente
import com.kesta.app.domain.model.Presentacion
import com.kesta.app.domain.model.PrecioEnComercio
import com.kesta.app.domain.model.Producto
import com.kesta.app.domain.model.Ubicacion

/** Datos de ejemplo de la ciudad piloto (Morelia, Michoacán), compartidos por todos los Fakes. */
object FakeData {
    const val CORREO_DEMO = "ana@kesta.mx"
    const val CONTRASENA_DEMO = "Kesta123"

    val centroMorelia = Ubicacion(lat = 19.7027, lng = -101.1925)

    val ciudades = listOf(
        Ciudad(id = 1, nombre = "Morelia, Michoacán", centro = centroMorelia),
    )

    val catAceites = Categoria(id = 1, nombre = "Aceites y grasas")
    val catVerduras = Categoria(id = 2, nombre = "Frutas y verduras")
    val catLacteos = Categoria(id = 3, nombre = "Lácteos")
    val categorias = listOf(catAceites, catVerduras, catLacteos)

    val presAceite = Presentacion(id = 1, marca = "La Costeña", cantidad = 1.0, unidad = "L", producto = "Aceite vegetal")
    val presJitomate = Presentacion(id = 2, marca = "Sin marca", cantidad = 1.0, unidad = "kg", producto = "Jitomate saladette")
    val presLeche = Presentacion(id = 3, marca = "Alpura", cantidad = 1.0, unidad = "L", producto = "Leche entera")
    val presentaciones = listOf(presAceite, presJitomate, presLeche)

    val productos = listOf(
        Producto(id = 1, nombre = "Aceite vegetal", categoria = catAceites, presentaciones = listOf(presAceite)),
        Producto(id = 2, nombre = "Jitomate saladette", categoria = catVerduras, presentaciones = listOf(presJitomate)),
        Producto(id = 3, nombre = "Leche entera", categoria = catLacteos, presentaciones = listOf(presLeche)),
    )

    private const val FECHA = "2026-10-30T10:00:00Z"

    private fun precio(
        comercio: String,
        ubicacionId: Int,
        canal: Canal,
        precio: Double,
        fuente: Fuente,
        distanciaKm: Double,
    ) = PrecioEnComercio(
        comercio = comercio,
        ubicacionId = ubicacionId,
        canal = canal,
        precio = precio,
        fuente = fuente,
        fechaCaptura = FECHA,
        verificado = true,
        distanciaKm = distanciaKm,
    )

    /** Precios por id de presentación. Ubicaciones: 1 = Chedraui, 2 = Tianguis del Pedregal, 3 = Soriana. */
    val precios: Map<Int, List<PrecioEnComercio>> = mapOf(
        presAceite.id to listOf(
            precio("Chedraui", 1, Canal.FORMAL, 45.50, Fuente.SCRAPING, 1.2),
            precio("Tianguis del Pedregal", 2, Canal.INFORMAL, 40.00, Fuente.COMUNIDAD, 3.4),
        ),
        presJitomate.id to listOf(
            precio("Chedraui", 1, Canal.FORMAL, 32.00, Fuente.SCRAPING, 1.2),
            precio("Tianguis del Pedregal", 2, Canal.INFORMAL, 25.00, Fuente.COMUNIDAD, 3.4),
        ),
        // Leche: solo hay precios del canal formal (sirve para probar "falta un canal").
        presLeche.id to listOf(
            precio("Chedraui", 1, Canal.FORMAL, 29.00, Fuente.SCRAPING, 1.2),
            precio("Soriana", 3, Canal.FORMAL, 28.50, Fuente.PROFECO, 2.1),
        ),
    )

    val canastas = listOf(
        Canasta(
            id = 1,
            nombre = "Despensa semanal",
            items = listOf(
                CanastaItem(id = 1, presentacion = presAceite, cantidad = 1.0, precioReferencia = 40.00),
                CanastaItem(id = 2, presentacion = presJitomate, cantidad = 2.0, precioReferencia = 25.00),
            ),
        ),
    )
}