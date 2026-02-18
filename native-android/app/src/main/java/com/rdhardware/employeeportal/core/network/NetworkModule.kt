package com.rdhardware.employeeportal.core.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.rdhardware.employeeportal.core.data.session.SessionStore
import com.rdhardware.employeeportal.feature.auth.data.AuthApi
import com.rdhardware.employeeportal.feature.dashboard.data.BootstrapApi
import com.rdhardware.employeeportal.feature.leaves.data.LeavesApi
import com.rdhardware.employeeportal.feature.overtime.data.OvertimeApi
import com.rdhardware.employeeportal.feature.payslips.data.PayslipsApi
import com.rdhardware.employeeportal.feature.profile.data.ProfileApi
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit

@OptIn(ExperimentalSerializationApi::class)
class NetworkModule(
    baseUrl: String,
    sessionStore: SessionStore
) {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        isLenient = true
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BASIC
    }

    private val httpClient = OkHttpClient.Builder()
        .addInterceptor(AuthTokenInterceptor(sessionStore))
        .addInterceptor(loggingInterceptor)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .client(httpClient)
        .build()

    val authApi: AuthApi by lazy {
        retrofit.create(AuthApi::class.java)
    }

    val bootstrapApi: BootstrapApi by lazy {
        retrofit.create(BootstrapApi::class.java)
    }

    val leavesApi: LeavesApi by lazy {
        retrofit.create(LeavesApi::class.java)
    }

    val overtimeApi: OvertimeApi by lazy {
        retrofit.create(OvertimeApi::class.java)
    }

    val payslipsApi: PayslipsApi by lazy {
        retrofit.create(PayslipsApi::class.java)
    }

    val profileApi: ProfileApi by lazy {
        retrofit.create(ProfileApi::class.java)
    }
}
