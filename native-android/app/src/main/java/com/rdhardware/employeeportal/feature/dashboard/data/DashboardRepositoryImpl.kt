package com.rdhardware.employeeportal.feature.dashboard.data

import com.rdhardware.employeeportal.core.network.ApiResult
import retrofit2.HttpException
import java.io.IOException

class DashboardRepositoryImpl(
    private val bootstrapApi: BootstrapApi
) : DashboardRepository {
    override suspend fun loadBootstrap(): ApiResult<EmployeePortalBootstrapData> {
        return try {
            val response = bootstrapApi.bootstrap()

            if (!response.ok) {
                return ApiResult.Error(response.error ?: response.message ?: "Failed to load dashboard context.")
            }

            val payload = response.data ?: return ApiResult.Error("Invalid bootstrap response payload.")
            ApiResult.Success(payload)
        } catch (error: IOException) {
            ApiResult.Error("Network error. Please check your connection and try again.")
        } catch (error: HttpException) {
            ApiResult.Error("Unable to load bootstrap (${error.code()}).", error.code())
        } catch (error: Exception) {
            ApiResult.Error(error.message ?: "Unexpected bootstrap error.")
        }
    }
}
