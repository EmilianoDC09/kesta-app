package com.kesta.app.core.storage

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.kesta.app.platform.KestaAndroid
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

actual fun createSecureStore(): SecureStore = AndroidSecureStore(KestaAndroid.context)

/**
 * Guarda el valor cifrado con AES-256-GCM. La llave vive en el Android Keystore
 * y nunca sale del dispositivo. No usa androidx.security:security-crypto (deprecada).
 *
 * Si el descifrado falla (llave perdida, datos corruptos) se borra el valor y se
 * trata como "sin sesion": el usuario solo tiene que volver a iniciar sesion.
 */
private class AndroidSecureStore(context: Context) : SecureStore {

    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    override fun read(): String? {
        val payload = prefs.getString(KEY, null) ?: return null
        return try {
            val (ivB64, dataB64) = payload.split(SEPARATOR, limit = 2)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                secretKey(),
                GCMParameterSpec(TAG_BITS, Base64.decode(ivB64, Base64.NO_WRAP)),
            )
            cipher.doFinal(Base64.decode(dataB64, Base64.NO_WRAP)).decodeToString()
        } catch (e: Exception) {
            clear()
            null
        }
    }

    override fun write(value: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encrypted = cipher.doFinal(value.encodeToByteArray())
        val payload = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) +
            SEPARATOR + Base64.encodeToString(encrypted, Base64.NO_WRAP)
        check(prefs.edit().putString(KEY, payload).commit()) { "No se pudo escribir la sesion" }
    }

    override fun clear() {
        prefs.edit().remove(KEY).commit()
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "kesta_session_key"
        const val PREFS = "kesta_session"
        const val KEY = "session"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val TAG_BITS = 128
        const val SEPARATOR = ":"
    }
}
