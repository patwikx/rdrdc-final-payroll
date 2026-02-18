package com.rdhardware.employeeportal.core.network

import com.rdhardware.employeeportal.core.data.session.SessionStore
import okhttp3.Interceptor
import okhttp3.Response

class AuthTokenInterceptor(
    private val sessionStore: SessionStore
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = sessionStore.currentAccessTokenOrNull()
        val requestBuilder = chain.request().newBuilder()

        if (!token.isNullOrBlank()) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }

        return chain.proceed(requestBuilder.build())
    }
}
