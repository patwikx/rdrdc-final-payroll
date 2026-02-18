package com.rdhardware.employeeportal.feature.auth.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("api/mobile/v1/auth/login")
    suspend fun login(
        @Body body: MobileLoginRequest
    ): MobileAuthResponseEnvelope

    @POST("api/mobile/v1/auth/refresh")
    suspend fun refresh(
        @Body body: MobileRefreshRequest
    ): MobileAuthResponseEnvelope

    @GET("api/mobile/v1/auth/session")
    suspend fun session(): MobileAuthResponseEnvelope
}
