package com.kesta.app.data.repository.fake

import com.kesta.app.data.repository.CatalogRepository
import com.kesta.app.domain.model.Categoria
import com.kesta.app.domain.model.Ciudad
import com.kesta.app.domain.model.Producto

/**
 * Catálogo de pruebaa.
 * Para simular estados: lista vacía => "vacío"; [fallo] => "error"; [retrasoMs] => "cargando".
 */
class FakeCatalogRepository(
    private val ciudades: List<Ciudad> = FakeData.ciudades,
    private val categorias: List<Categoria> = FakeData.categorias,
    private val productos: List<Producto> = FakeData.productos,
    private val fallo: Throwable? = null,
    private val retrasoMs: Long = 0,
) : CatalogRepository {

    override suspend fun ciudades(): Result<List<Ciudad>> =
        respuestaSimulada(retrasoMs, fallo) { Result.success(ciudades) }

    override suspend fun categorias(): Result<List<Categoria>> =
        respuestaSimulada(retrasoMs, fallo) { Result.success(categorias) }

    override suspend fun buscarProductos(
        consulta: String,
        categoriaId: Int?,
        pagina: Int,
    ): Result<List<Producto>> = respuestaSimulada(retrasoMs, fallo) {
        val texto = consulta.trim()
        val encontrados = if (pagina > 1) {
            emptyList() // Los datos de ejemplo caben en una sola página.
        } else {
            productos.filter { producto ->
                (texto.isEmpty() || producto.nombre.contains(texto, ignoreCase = true)) &&
                        (categoriaId == null || producto.categoria.id == categoriaId)
            }
        }
        Result.success(encontrados)
    }
}
