package com.kesta.app.domain.model

data class Ciudad(
    val id: Int,
    val nombre: String,
    /** Punto central de la ciudad; se usa cuando el usuario no comparte su GPS. */
    val centro: Ubicacion,
)