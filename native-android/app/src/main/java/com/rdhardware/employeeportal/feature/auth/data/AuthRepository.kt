package com.rdhardware.employeeportal.feature.auth.data

import com.rdhardware.employeeportal.core.domain.AuthSession
import com.rdhardware.employeeportal.core.network.ApiResult
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    val sessionFlow: Flow<AuthSession?>

    suspend fun getCurrentSession(): AuthSession?

    suspend fun signIn(email: String, password: String): ApiResult<AuthSession>

    suspend fun signOut()
}
