package com.rdhardware.employeeportal.feature.profile.data

import com.rdhardware.employeeportal.core.network.ApiResult

interface ProfileRepository {
    suspend fun loadProfile(): ApiResult<MobileProfileData>
}
