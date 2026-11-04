package com.kesta.app.ui

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain

/**
 * Los ViewModels lanzan sus tareas en el "hilo principal" de la app, que no existe en una prueba.
 * Estas dos funciones lo reemplazan por uno de prueba (que ejecuta todo de inmediato)
 * y lo restauran al terminar. Cada clase de prueba las llama en @BeforeTest y @AfterTest.
 */
@OptIn(ExperimentalCoroutinesApi::class)
fun prepararDispatcherDePrueba() {
    Dispatchers.setMain(UnconfinedTestDispatcher())
}

@OptIn(ExperimentalCoroutinesApi::class)
fun restaurarDispatcher() {
    Dispatchers.resetMain()
}