package com.rdhardware.employeeportal.feature.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.rdhardware.employeeportal.core.data.AppGraph
import com.rdhardware.employeeportal.core.network.ApiResult
import com.rdhardware.employeeportal.feature.dashboard.data.DashboardRepository
import com.rdhardware.employeeportal.feature.dashboard.data.EmployeePortalBootstrapData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DashboardUiState(
    val isLoading: Boolean = true,
    val bootstrap: EmployeePortalBootstrapData? = null,
    val errorMessage: String? = null
)

class DashboardViewModel(
    private val dashboardRepository: DashboardRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { state ->
                state.copy(
                    isLoading = true,
                    errorMessage = null
                )
            }

            when (val result = dashboardRepository.loadBootstrap()) {
                is ApiResult.Success -> {
                    _uiState.update {
                        DashboardUiState(
                            isLoading = false,
                            bootstrap = result.value,
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
                    if (modelClass.isAssignableFrom(DashboardViewModel::class.java)) {
                        @Suppress("UNCHECKED_CAST")
                        return DashboardViewModel(AppGraph.dashboardRepository) as T
                    }
                    throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
                }
            }
        }
    }
}
