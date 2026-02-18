package com.rdhardware.employeeportal.feature.leaves.data

import retrofit2.http.GET
import retrofit2.http.Query

interface LeavesApi {
    @GET("api/mobile/v1/employee-portal/leaves")
    suspend fun getLeaves(
        @Query("year") year: Int? = null
    ): MobileLeavesEnvelope
}
