package com.rdhardware.employeeportal.feature.auth.data

import com.rdhardware.employeeportal.core.data.session.SessionStore
import com.rdhardware.employeeportal.core.domain.AuthSession
import com.rdhardware.employeeportal.core.network.ApiResult
import kotlinx.coroutines.flow.Flow
import retrofit2.HttpException
import java.io.IOException

class AuthRepositoryImpl(
    private val authApi: AuthApi,
    private val sessionStore: SessionStore
) : AuthRepository {
    override val sessionFlow: Flow<AuthSession?>
        get() = sessionStore.sessionFlow

    override suspend fun getCurrentSession(): AuthSession? = sessionStore.getSession()

    override suspend fun signIn(email: String, password: String): ApiResult<AuthSession> {
        return try {
            val response = authApi.login(
                MobileLoginRequest(
                    email = email.trim(),
                    password = password
                )
            )

            if (!response.ok) {
                return ApiResult.Error(response.error ?: response.message ?: "Unable to sign in.")
            }

            val payload = response.data
                ?: return ApiResult.Error("Invalid login response payload.")

            val accessToken = payload.accessToken?.trim().orEmpty()
            if (accessToken.isEmpty()) {
                return ApiResult.Error("Missing access token in login response.")
            }

            val session = AuthSession(
                accessToken = accessToken,
                refreshToken = payload.refreshToken?.trim().orEmpty(),
                userId = payload.userId?.trim().orEmpty(),
                companyId = payload.companyId?.trim().orEmpty()
            )

            sessionStore.saveSession(session)
            ApiResult.Success(session)
        } catch (error: IOException) {
            ApiResult.Error("Network error. Please check your connection and try again.")
        } catch (error: HttpException) {
            ApiResult.Error(
                message = "Authentication failed (${error.code()}).",
                code = error.code()
            )
        } catch (error: Exception) {
            ApiResult.Error(error.message ?: "Unexpected error during sign in.")
        }
    }

    override suspend fun signOut() {
        sessionStore.clearSession()
    }
}
