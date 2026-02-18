package com.rdhardware.employeeportal.feature.payslips.data

import retrofit2.http.GET

interface PayslipsApi {
    @GET("api/mobile/v1/employee-portal/payslips")
    suspend fun getPayslips(): MobilePayslipsEnvelope
}
