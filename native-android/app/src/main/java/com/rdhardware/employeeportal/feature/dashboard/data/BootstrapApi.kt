package com.rdhardware.employeeportal.feature.dashboard.data

import retrofit2.http.GET

interface BootstrapApi {
    @GET("api/mobile/v1/employee-portal/bootstrap")
    suspend fun bootstrap(): MobileBootstrapResponseEnvelope
}
