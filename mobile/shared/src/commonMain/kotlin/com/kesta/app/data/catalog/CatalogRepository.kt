package com.kesta.app.data.catalog

import com.kesta.app.data.catalog.Categoria
import com.kesta.app.data.catalog.Producto

/**
 * Pregunta de la app: "¿qué productos existen?".
 * Cada función devuelve Result: éxito con datos, o fallo con la causa. Nunca lanza excepciones hacia afuera.
 */
interface CatalogRepository {
    suspend fun categorias(): Result<List<Categoria>>
    /**Busca por texto (nombre del producto o marca) y/o por categoría */
    suspend fun buscarProductos(
        consulta: String,
        categoriaId: Int?,
        pagina: Int,
    ): Result<List<Producto>>
}