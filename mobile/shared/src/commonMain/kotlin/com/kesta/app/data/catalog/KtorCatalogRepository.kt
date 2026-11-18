package com.kesta.app.data.catalog

import com.kesta.app.core.error.AppError
import com.kesta.app.core.error.AppException
import com.kesta.app.core.network.bodyOrNull
import com.kesta.app.core.network.safeRequest
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.parameter

/**
 * CAT-02 (categorías) y CAT-03 (búsqueda de productos). Son rutas públicas: funcionan también
 * en modo invitado, porque el cliente solo manda el token cuando hay sesión.
 */
class KtorCatalogRepository(private val client: HttpClient) : CatalogRepository {

    override suspend fun categorias(): Result<List<Categoria>> {
        val response = safeRequest { client.get("categorias") }
            .getOrElse { return Result.failure(it) }
        val cuerpo = response.bodyOrNull<CategoriasRespuestaDto>()
            ?: return Result.failure(AppException(AppError.RespuestaInvalida))
        return Result.success(cuerpo.datos.map { it.aCategoria() })
    }

    override suspend fun buscarProductos(
        consulta: String,
        categoriaId: Int?,
        pagina: Int,
    ): Result<List<Producto>> {
        val response = safeRequest {
            client.get("productos") {
                if (consulta.isNotBlank()) parameter("q", consulta.trim())
                if (categoriaId != null) parameter("categoriaId", categoriaId)
                parameter("pagina", pagina)
            }
        }.getOrElse { return Result.failure(it) }
        val cuerpo = response.bodyOrNull<ProductosRespuestaDto>()
            ?: return Result.failure(AppException(AppError.RespuestaInvalida))
        return Result.success(cuerpo.datos.map { it.aProducto() })
    }
}