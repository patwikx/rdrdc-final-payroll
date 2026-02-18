package com.rdhardware.employeeportal.feature.overtime.data

import com.rdhardware.employeeportal.core.network.ApiResult
import retrofit2.HttpException
import java.io.IOException

class OvertimeRepositoryImpl(
    private val overtimeApi: OvertimeApi
) : OvertimeRepository {
    override suspend fun loadOvertimeRequests(): ApiResult<List<MobileOvertimeRequest>> {
        return try {
            val response = overtimeApi.getOvertimeRequests()

            if (!response.ok) {
                return ApiResult.Error(response.error ?: response.message ?: "Failed to load overtime requests.")
            }

            ApiResult.Success(response.data ?: emptyList())
        } catch (error: IOException) {
            ApiResult.Error("Network error. Please check your connection and try again.")
        } catch (error: HttpException) {
            ApiResult.Error("Unable to load overtime requests (${error.code()}).", error.code())
        } catch (error: Exception) {
            ApiResult.Error(error.message ?: "Unexpected overtime module error.")
        }
    }
}
