package com.rdhardware.employeeportal.feature.overtime.data

import com.rdhardware.employeeportal.core.network.ApiResult

interface OvertimeRepository {
    suspend fun loadOvertimeRequests(): ApiResult<List<MobileOvertimeRequest>>
}
