package com.rdhardware.employeeportal.core.domain

data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val companyId: String
)
