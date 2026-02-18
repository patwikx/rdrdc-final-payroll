package com.rdhardware.employeeportal.feature.overtime

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.rdhardware.employeeportal.core.data.AppGraph
import com.rdhardware.employeeportal.core.network.ApiResult
import com.rdhardware.employeeportal.feature.overtime.data.MobileOvertimeRequest
import com.rdhardware.employeeportal.feature.overtime.data.OvertimeRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class OvertimeUiState(
    val isLoading: Boolean = true,
    val requests: List<MobileOvertimeRequest> = emptyList(),
    val errorMessage: String? = null
)

class OvertimeViewModel(
    private val overtimeRepository: OvertimeRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(OvertimeUiState())
    val uiState: StateFlow<OvertimeUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { state ->
                state.copy(isLoading = true, errorMessage = null)
            }

            when (val result = overtimeRepository.loadOvertimeRequests()) {
                is ApiResult.Success -> {
                    _uiState.update {
                        OvertimeUiState(
                            isLoading = false,
                            requests = result.value,
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
                    if (modelClass.isAssignableFrom(OvertimeViewModel::class.java)) {
                        @Suppress("UNCHECKED_CAST")
                        return OvertimeViewModel(AppGraph.overtimeRepository) as T
                    }
                    throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
                }
            }
        }
    }
}
