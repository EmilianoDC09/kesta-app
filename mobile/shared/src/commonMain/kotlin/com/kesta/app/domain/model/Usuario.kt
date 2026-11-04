package com.kesta.app.domain.model

data class Usuario(
    val id: Int,
    val nombre: String,
    val ciudadId: Int,
    val radioKmPorDefecto: Int,
    val rol: String,
)
