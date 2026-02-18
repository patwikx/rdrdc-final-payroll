package com.rdhardware.employeeportal.feature.auth.data

import kotlinx.serialization.Serializable

@Serializable
data class MobileLoginRequest(
    val email: String,
    val password: String
)

@Serializable
data class MobileRefreshRequest(
    val refreshToken: String
)

@Serializable
data class MobileAuthResponseEnvelope(
    val ok: Boolean = false,
    val message: String? = null,
    val error: String? = null,
    val data: MobileAuthResponseData? = null
)

@Serializable
data class MobileAuthResponseData(
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val userId: String? = null,
    val companyId: String? = null
)
