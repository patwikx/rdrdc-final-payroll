package com.rdhardware.employeeportal.feature.profile.data

import com.rdhardware.employeeportal.core.network.ApiResult
import retrofit2.HttpException
import java.io.IOException

class ProfileRepositoryImpl(
    private val profileApi: ProfileApi
) : ProfileRepository {
    override suspend fun loadProfile(): ApiResult<MobileProfileData> {
        return try {
            val response = profileApi.getProfile()

            if (!response.ok) {
                return ApiResult.Error(response.error ?: response.message ?: "Failed to load profile.")
            }

            val payload = response.data ?: return ApiResult.Error("Invalid profile response payload.")
            ApiResult.Success(payload)
        } catch (error: IOException) {
            ApiResult.Error("Network error. Please check your connection and try again.")
        } catch (error: HttpException) {
            ApiResult.Error("Unable to load profile (${error.code()}).", error.code())
        } catch (error: Exception) {
            ApiResult.Error(error.message ?: "Unexpected profile module error.")
        }
    }
}
