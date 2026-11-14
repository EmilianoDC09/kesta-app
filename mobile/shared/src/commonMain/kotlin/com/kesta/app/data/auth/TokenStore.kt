package com.kesta.app.data.auth

import com.kesta.app.core.network.KestaJson
import com.kesta.app.core.storage.SecureStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * Fuente unica de verdad de los tokens. Cache en memoria + SecureStore.
 * El Mutex evita que una renovacion y un logout escriban al mismo tiempo.
 */
class TokenStore(private val secureStore: SecureStore) {

    private val mutex = Mutex()
    private var loaded = false
    private var cache: StoredSession? = null

    /** Lo asigna el repositorio de sesion; se invoca cuando la renovacion es rechazada. */
    var onSessionExpired: (() -> Unit)? = null

    suspend fun get(): StoredSession? = mutex.withLock { loadLocked() }

    suspend fun save(session: StoredSession) {
        mutex.withLock { persistLocked(session) }
    }

    /** El backend rota el refreshToken: hay que guardar SIEMPRE el nuevo. */
    suspend fun updateTokens(accessToken: String, refreshToken: String) {
        mutex.withLock {
            val current = loadLocked() ?: return@withLock
            persistLocked(current.copy(accessToken = accessToken, refreshToken = refreshToken))
        }
    }

    suspend fun clear() {
        mutex.withLock {
            withContext(Dispatchers.Default) { secureStore.clear() }
            cache = null
            loaded = true
        }
    }

    fun notifySessionExpired() {
        onSessionExpired?.invoke()
    }

    private suspend fun loadLocked(): StoredSession? {
        if (!loaded) {
            val raw = withContext(Dispatchers.Default) { secureStore.read() }
            cache = raw?.let {
                try {
                    KestaJson.decodeFromString(StoredSession.serializer(), it)
                } catch (e: Exception) {
                    null
                }
            }
            loaded = true
        }
        return cache
    }

    private suspend fun persistLocked(session: StoredSession) {
        val raw = KestaJson.encodeToString(StoredSession.serializer(), session)
        withContext(Dispatchers.Default) { secureStore.write(raw) }
        cache = session
        loaded = true
    }
}
