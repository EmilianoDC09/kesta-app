package com.kesta.app.di

import com.kesta.app.core.config.defaultApiBaseUrl
import com.kesta.app.core.location.LocationProvider
import com.kesta.app.core.network.createHttpClient
<<<<<<< Updated upstream
import com.kesta.app.data.repository.ApiStatusRepository
import com.kesta.app.data.repository.AuthRepository
import com.kesta.app.data.repository.BasketRepository
import com.kesta.app.data.repository.CatalogRepository
import com.kesta.app.data.repository.KtorApiStatusRepository
import com.kesta.app.data.repository.PriceRepository
import com.kesta.app.data.repository.fake.FakeAuthRepository
import com.kesta.app.data.repository.fake.FakeBasketRepository
import com.kesta.app.data.repository.fake.FakeCatalogRepository
import com.kesta.app.data.repository.fake.FakeLocationProvider
import com.kesta.app.data.repository.fake.FakePriceRepository
=======
import com.kesta.app.core.storage.createSecureStore
import com.kesta.app.data.auth.KtorSessionRepository
import com.kesta.app.data.auth.SessionRepository
import com.kesta.app.data.auth.TokenStore
import com.kesta.app.data.auth.createApiClient
import com.kesta.app.data.catalog.CatalogRepository
import com.kesta.app.data.catalog.KtorCatalogRepository
import com.kesta.app.data.comparison.KtorPriceRepository
import com.kesta.app.data.comparison.PriceRepository
import com.kesta.app.data.location.LocationProvider
import com.kesta.app.data.location.MoreliaLocation
import com.kesta.app.data.status.ApiStatusRepository
import com.kesta.app.data.status.KtorApiStatusRepository
>>>>>>> Stashed changes

/**
 * Inyeccion manual de dependencias. Suficiente para el MVP; no se agrega
 * Koin hasta que haya una razon concreta.
 */
object AppContainer {
    /**
     * true  = la app usa datos de prueba en memoria (Fakes).
     * false = usara la API real
     */
    val usarDatosDePrueba: Boolean = true

    private val httpClient by lazy { createHttpClient(defaultApiBaseUrl()) }

    val apiStatusRepository: ApiStatusRepository by lazy {
        KtorApiStatusRepository(httpClient)
    }

    val authRepository: AuthRepository by lazy {
        FakeAuthRepository()
    }

    val catalogRepository: CatalogRepository by lazy {
        FakeCatalogRepository()
    }

    val priceRepository: PriceRepository by lazy {
        FakePriceRepository()
    }

    val basketRepository: BasketRepository by lazy {
        FakeBasketRepository()
    }

    /** Ubicacion de prueba */
    val locationProvider: LocationProvider by lazy {
        FakeLocationProvider()
    }

    val catalogRepository: CatalogRepository by lazy {
        KtorCatalogRepository(apiClient)
    }
    val priceRepository: PriceRepository by lazy {
        KtorPriceRepository(apiClient)
    }
}
