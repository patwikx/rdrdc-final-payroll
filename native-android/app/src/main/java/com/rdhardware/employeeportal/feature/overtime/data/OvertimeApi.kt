package com.rdhardware.employeeportal.feature.overtime.data

import retrofit2.http.GET

interface OvertimeApi {
    @GET("api/mobile/v1/employee-portal/overtime")
    suspend fun getOvertimeRequests(): MobileOvertimeEnvelope
}
