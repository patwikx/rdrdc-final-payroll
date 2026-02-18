package com.rdhardware.employeeportal.feature.payslips.data

import com.rdhardware.employeeportal.core.network.ApiResult

interface PayslipsRepository {
    suspend fun loadPayslips(): ApiResult<MobilePayslipsData>
}
