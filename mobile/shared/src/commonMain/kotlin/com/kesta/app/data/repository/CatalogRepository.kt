package com.kesta.app.data.repository

import com.kesta.app.domain.model.Categoria
import com.kesta.app.domain.model.Ciudad
import com.kesta.app.domain.model.Producto

/** Ciudades, categorías y búsqueda de productos */
interface CatalogRepository {
    suspend fun ciudades(): Result<List<Ciudad>>

    suspend fun categorias(): Result<List<Categoria>>

    suspend fun buscarProductos(
        consulta: String,
        categoriaId: Int?,
        pagina: Int,
    ): Result<List<Producto>>
}

