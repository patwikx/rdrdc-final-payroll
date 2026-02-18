package com.rdhardware.employeeportal.feature.dashboard.data

import com.rdhardware.employeeportal.core.network.ApiResult

interface DashboardRepository {
    suspend fun loadBootstrap(): ApiResult<EmployeePortalBootstrapData>
}
