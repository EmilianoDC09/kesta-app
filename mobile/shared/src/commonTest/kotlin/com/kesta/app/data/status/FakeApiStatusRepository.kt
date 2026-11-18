package com.kesta.app.data.status

class FakeApiStatusRepository(private val result: Result<ApiStatus>) : ApiStatusRepository {
    override suspend fun check(): Result<ApiStatus> = result
}
