package com.rdhardware.employeeportal.feature.profile.data

import retrofit2.http.GET

interface ProfileApi {
    @GET("api/mobile/v1/employee-portal/profile")
    suspend fun getProfile(): MobileProfileEnvelope
}
