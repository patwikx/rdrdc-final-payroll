package com.rdhardware.employeeportal.feature.payslips

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.rdhardware.employeeportal.core.data.AppGraph
import com.rdhardware.employeeportal.core.network.ApiResult
import com.rdhardware.employeeportal.feature.payslips.data.MobilePayslipsData
import com.rdhardware.employeeportal.feature.payslips.data.PayslipsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PayslipsUiState(
    val isLoading: Boolean = true,
    val data: MobilePayslipsData? = null,
    val errorMessage: String? = null
)

class PayslipsViewModel(
    private val payslipsRepository: PayslipsRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(PayslipsUiState())
    val uiState: StateFlow<PayslipsUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { state ->
                state.copy(isLoading = true, errorMessage = null)
            }

            when (val result = payslipsRepository.loadPayslips()) {
                is ApiResult.Success -> {
                    _uiState.update {
                        PayslipsUiState(
                            isLoading = false,
                            data = result.value,
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
                    if (modelClass.isAssignableFrom(PayslipsViewModel::class.java)) {
                        @Suppress("UNCHECKED_CAST")
                        return PayslipsViewModel(AppGraph.payslipsRepository) as T
                    }
                    throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
                }
            }
        }
    }
}
