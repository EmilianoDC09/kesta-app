package com.kesta.app.data.repository.fake

import com.kesta.app.data.repository.BasketRepository
import com.kesta.app.domain.model.Canasta
import com.kesta.app.domain.model.CanastaItem
import com.kesta.app.domain.model.OptimizacionCanasta
import com.kesta.app.domain.model.PrecioEnComercio
import com.kesta.app.domain.model.TiendaRecomendada
import com.kesta.app.domain.model.Ubicacion

/**
 * Canastas de prueba que viven en memoria: lo que creas, agregas o quitas
 * se conserva mientras la app esté abierta
 */
class FakeBasketRepository(
    canastasIniciales: List<Canasta> = FakeData.canastas,
    private val fallo: Throwable? = null,
    private val retrasoMs: Long = 0,
) : BasketRepository {

    private val almacen = canastasIniciales.toMutableList()
    private var siguienteCanastaId = (canastasIniciales.maxOfOrNull { it.id } ?: 0) + 1
    private var siguienteItemId = (canastasIniciales.flatMap { it.items }.maxOfOrNull { it.id } ?: 0) + 1

    private fun noEncontrada() = Exception("No se encontró la canasta")

    private fun reemplazar(canastaId: Int, cambio: (Canasta) -> Canasta): Result<Canasta> {
        val indice = almacen.indexOfFirst { it.id == canastaId }
        if (indice < 0) return Result.failure(noEncontrada())
        val nueva = cambio(almacen[indice])
        almacen[indice] = nueva
        return Result.success(nueva)
    }

    override suspend fun canastas(): Result<List<Canasta>> =
        respuestaSimulada(retrasoMs, fallo) { Result.success(almacen.toList()) }

    override suspend fun canasta(canastaId: Int): Result<Canasta> = respuestaSimulada(retrasoMs, fallo) {
        val canasta = almacen.firstOrNull { it.id == canastaId }
        if (canasta == null) Result.failure(noEncontrada()) else Result.success(canasta)
    }

    override suspend fun crear(nombre: String): Result<Canasta> = respuestaSimulada(retrasoMs, fallo) {
        val nueva = Canasta(id = siguienteCanastaId++, nombre = nombre, items = emptyList())
        almacen.add(nueva)
        Result.success(nueva)
    }

    override suspend fun agregarProducto(
        canastaId: Int,
        presentacionId: Int,
        cantidad: Double,
    ): Result<Canasta> = respuestaSimulada(retrasoMs, fallo) {
        val presentacion = FakeData.presentaciones.firstOrNull { it.id == presentacionId }
        if (presentacion == null) {
            Result.failure(Exception("No se encontró el producto"))
        } else {
            reemplazar(canastaId) { canasta ->
                val existente = canasta.items.firstOrNull { it.presentacion.id == presentacionId }
                if (existente != null) {
                    canasta.copy(
                        items = canasta.items.map {
                            if (it.id == existente.id) it.copy(cantidad = it.cantidad + cantidad) else it
                        },
                    )
                } else {
                    val referencia = FakeData.precios[presentacionId]?.minOfOrNull { it.precio }
                    val item = CanastaItem(
                        id = siguienteItemId++,
                        presentacion = presentacion,
                        cantidad = cantidad,
                        precioReferencia = referencia,
                    )
                    canasta.copy(items = canasta.items + item)
                }
            }
        }
    }

    override suspend fun cambiarCantidad(
        canastaId: Int,
        itemId: Int,
        cantidad: Double,
    ): Result<Canasta> = respuestaSimulada(retrasoMs, fallo) {
        reemplazar(canastaId) { canasta ->
            canasta.copy(items = canasta.items.map { if (it.id == itemId) it.copy(cantidad = cantidad) else it })
        }
    }

    override suspend fun quitarProducto(canastaId: Int, itemId: Int): Result<Canasta> =
        respuestaSimulada(retrasoMs, fallo) {
            reemplazar(canastaId) { canasta -> canasta.copy(items = canasta.items.filter { it.id != itemId }) }
        }

    override suspend fun eliminar(canastaId: Int): Result<Unit> = respuestaSimulada(retrasoMs, fallo) {
        if (almacen.removeAll { it.id == canastaId }) Result.success(Unit) else Result.failure(noEncontrada())
    }

    override suspend fun optimizar(
        canastaId: Int,
        centro: Ubicacion,
        radioKm: Int,
        unaSolaTienda: Boolean,
    ): Result<OptimizacionCanasta> = respuestaSimulada(retrasoMs, fallo) {
        val canasta = almacen.firstOrNull { it.id == canastaId }
        if (canasta == null) {
            Result.failure(noEncontrada())
        } else {
            Result.success(calcularOptimizacion(canasta, radioKm, unaSolaTienda))
        }
    }

    /** Un producto de la canasta junto con el precio que tiene en una tienda. */
    private class Linea(val item: CanastaItem, val precio: PrecioEnComercio)

    private fun subtotal(lineas: List<Linea>): Double =
        redondear(lineas.sumOf { it.precio.precio * it.item.cantidad })

    private fun tienda(lineas: List<Linea>): TiendaRecomendada {
        val ref = lineas.first().precio
        return TiendaRecomendada(
            comercio = ref.comercio,
            ubicacionId = ref.ubicacionId,
            canal = ref.canal,
            distanciaKm = ref.distanciaKm,
            subtotal = subtotal(lineas),
        )
    }

    private fun calcularOptimizacion(
        canasta: Canasta,
        radioKm: Int,
        unaSolaTienda: Boolean,
    ): OptimizacionCanasta {
        // Precios disponibles de cada producto dentro del radio.
        val preciosPorItem = canasta.items.map { item ->
            item to FakeData.precios[item.presentacion.id].orEmpty().filter { it.distanciaKm <= radioKm }
        }
        val sinPrecio = preciosPorItem.filter { it.second.isEmpty() }.map { it.first.presentacion.id }
        val conPrecio = preciosPorItem.filter { it.second.isNotEmpty() }
        if (conPrecio.isEmpty()) {
            return OptimizacionCanasta(emptyList(), 0.0, null, sinPrecio)
        }

        // Tiendas que tienen TODOS los productos con precio.
        val ubicaciones = conPrecio.flatMap { it.second }.map { it.ubicacionId }.distinct()
        val completas: List<List<Linea>> = ubicaciones.mapNotNull { ubicacionId ->
            val lineas = conPrecio.mapNotNull { (item, precios) ->
                precios.firstOrNull { it.ubicacionId == ubicacionId }?.let { Linea(item, it) }
            }
            if (lineas.size == conPrecio.size) lineas else null
        }

        val tiendas: List<TiendaRecomendada> = if (unaSolaTienda) {
            val mejor = completas.minByOrNull { subtotal(it) } ?: return OptimizacionCanasta(
                tiendasRecomendadas = emptyList(),
                costoTotal = 0.0,
                ahorroVsMasCara = null,
                productosSinPrecio = sinPrecio + conPrecio.map { it.first.presentacion.id },
            )
            listOf(tienda(mejor))
        } else {
            // Cada producto se compra donde sea más barato.
            conPrecio
                .map { (item, precios) -> Linea(item, precios.minBy { it.precio }) }
                .groupBy { it.precio.ubicacionId }
                .values
                .map { tienda(it) }
        }

        val costoTotal = redondear(tiendas.sumOf { it.subtotal })
        val ahorro = if (completas.size >= 2) {
            redondear(completas.maxOf { subtotal(it) } - costoTotal)
        } else {
            null
        }
        return OptimizacionCanasta(tiendas, costoTotal, ahorro, sinPrecio)
    }
}
