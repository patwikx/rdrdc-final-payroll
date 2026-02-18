package com.rdhardware.employeeportal.core.network

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>
    data class Error(val message: String, val code: Int? = null) : ApiResult<Nothing>
}
