package com.kesta.app.core.storage

/**
 * Almacenamiento de un solo valor de texto, persistente entre aperturas.
 * Android: SharedPreferences cifrado con una llave AES del Android Keystore.
 * iOS: NSUserDefaults (pendiente migrar a Keychain cuando iOS entre al alcance).
 *
 * Las operaciones son bloqueantes; quien las llama debe usar un dispatcher de fondo.
 */
interface SecureStore {
    fun read(): String?
    fun write(value: String)
    fun clear()
}

expect fun createSecureStore(): SecureStore
