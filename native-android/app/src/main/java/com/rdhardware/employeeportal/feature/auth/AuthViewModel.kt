package com.rdhardware.employeeportal.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.rdhardware.employeeportal.core.data.AppGraph
import com.rdhardware.employeeportal.core.network.ApiResult
import com.rdhardware.employeeportal.feature.auth.data.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val isAuthenticated: Boolean = false,
    val errorMessage: String? = null
)

class AuthViewModel(
    private val authRepository: AuthRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val existingSession = authRepository.getCurrentSession()
            if (existingSession != null) {
                _uiState.update { state ->
                    state.copy(isAuthenticated = true)
                }
            }
        }
    }

    fun onEmailChanged(value: String) {
        _uiState.update { state ->
            state.copy(
                email = value,
                errorMessage = null
            )
        }
    }

    fun onPasswordChanged(value: String) {
        _uiState.update { state ->
            state.copy(
                password = value,
                errorMessage = null
            )
        }
    }

    fun signIn() {
        val email = _uiState.value.email.trim()
        val password = _uiState.value.password

        if (email.isEmpty() || password.isEmpty()) {
            _uiState.update { state ->
                state.copy(errorMessage = "Email and password are required.")
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { state ->
                state.copy(isLoading = true, errorMessage = null)
            }

            when (val result = authRepository.signIn(email, password)) {
                is ApiResult.Success -> {
                    _uiState.update { state ->
                        state.copy(
                            isLoading = false,
                            isAuthenticated = true,
                            errorMessage = null
                        )
                    }
                }
                is ApiResult.Error -> {
                    _uiState.update { state ->
                        state.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }

    companion object {
        fun factory(): ViewModelProvider.Factory {
            return object : ViewModelProvider.Factory {
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    if (modelClass.isAssignableFrom(AuthViewModel::class.java)) {
                        @Suppress("UNCHECKED_CAST")
                        return AuthViewModel(AppGraph.authRepository) as T
                    }
                    throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
                }
            }
        }
    }
}
