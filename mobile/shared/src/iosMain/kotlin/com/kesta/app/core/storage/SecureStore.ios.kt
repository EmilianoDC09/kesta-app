package com.kesta.app.core.storage

import platform.Foundation.NSUserDefaults

/**
 * Provisional: NSUserDefaults NO esta cifrado. iOS esta fuera del alcance de
 * este entregable; antes de publicar en iOS se debe migrar a Keychain.
 */
actual fun createSecureStore(): SecureStore = object : SecureStore {
    private val defaults = NSUserDefaults.standardUserDefaults
    private val key = "kesta_session"

    override fun read(): String? = defaults.stringForKey(key)
    override fun write(value: String) = defaults.setObject(value, forKey = key)
    override fun clear() = defaults.removeObjectForKey(key)
}
