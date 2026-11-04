package com.kesta.app.domain.model

data class Producto(
    val id: Int,
    val nombre: String,
    val categoria: Categoria,
    val presentaciones: List<Presentacion>,
)
