package com.rdhardware.employeeportal.feature.leaves.data

import com.rdhardware.employeeportal.core.network.ApiResult

interface LeavesRepository {
    suspend fun loadLeaves(): ApiResult<MobileLeavesData>
}
