package com.rdhardware.employeeportal.feature.leaves.data

import com.rdhardware.employeeportal.core.network.ApiResult
import retrofit2.HttpException
import java.io.IOException

class LeavesRepositoryImpl(
    private val leavesApi: LeavesApi
) : LeavesRepository {
    override suspend fun loadLeaves(): ApiResult<MobileLeavesData> {
        return try {
            val response = leavesApi.getLeaves()

            if (!response.ok) {
                return ApiResult.Error(response.error ?: response.message ?: "Failed to load leave requests.")
            }

            val payload = response.data ?: return ApiResult.Error("Invalid leave response payload.")
            ApiResult.Success(payload)
        } catch (error: IOException) {
            ApiResult.Error("Network error. Please check your connection and try again.")
        } catch (error: HttpException) {
            ApiResult.Error("Unable to load leaves (${error.code()}).", error.code())
        } catch (error: Exception) {
            ApiResult.Error(error.message ?: "Unexpected leave module error.")
        }
    }
}
