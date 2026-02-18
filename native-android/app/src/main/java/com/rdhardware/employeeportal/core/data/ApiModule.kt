package com.rdhardware.employeeportal.core.data

import com.rdhardware.employeeportal.BuildConfig

object ApiModule {
    fun baseUrl(): String {
        val raw = BuildConfig.EMPLOYEE_PORTAL_API_BASE_URL.trim()
        if (raw.isEmpty()) {
            return "https://hris.rdhardware.com/"
        }
        return if (raw.endsWith('/')) raw else "$raw/"
    }
}
