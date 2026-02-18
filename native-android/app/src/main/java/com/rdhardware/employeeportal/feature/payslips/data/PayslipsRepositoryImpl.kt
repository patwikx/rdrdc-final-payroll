package com.rdhardware.employeeportal.feature.payslips.data

import com.rdhardware.employeeportal.core.network.ApiResult
import retrofit2.HttpException
import java.io.IOException

class PayslipsRepositoryImpl(
    private val payslipsApi: PayslipsApi
) : PayslipsRepository {
    override suspend fun loadPayslips(): ApiResult<MobilePayslipsData> {
        return try {
            val response = payslipsApi.getPayslips()

            if (!response.ok) {
                return ApiResult.Error(response.error ?: response.message ?: "Failed to load payslips.")
            }

            val payload = response.data ?: return ApiResult.Error("Invalid payslips response payload.")
            ApiResult.Success(payload)
        } catch (error: IOException) {
            ApiResult.Error("Network error. Please check your connection and try again.")
        } catch (error: HttpException) {
            ApiResult.Error("Unable to load payslips (${error.code()}).", error.code())
        } catch (error: Exception) {
            ApiResult.Error(error.message ?: "Unexpected payslips module error.")
        }
    }
}
