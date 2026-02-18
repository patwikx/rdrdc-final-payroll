package com.rdhardware.employeeportal.feature.leaves

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.rdhardware.employeeportal.core.data.AppGraph
import com.rdhardware.employeeportal.core.network.ApiResult
import com.rdhardware.employeeportal.feature.leaves.data.LeavesRepository
import com.rdhardware.employeeportal.feature.leaves.data.MobileLeavesData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LeavesUiState(
    val isLoading: Boolean = true,
    val data: MobileLeavesData? = null,
    val errorMessage: String? = null
)

class LeavesViewModel(
    private val leavesRepository: LeavesRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(LeavesUiState())
    val uiState: StateFlow<LeavesUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { state ->
                state.copy(isLoading = true, errorMessage = null)
            }

            when (val result = leavesRepository.loadLeaves()) {
                is ApiResult.Success -> {
                    _uiState.update {
                        LeavesUiState(
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
                    if (modelClass.isAssignableFrom(LeavesViewModel::class.java)) {
                        @Suppress("UNCHECKED_CAST")
                        return LeavesViewModel(AppGraph.leavesRepository) as T
                    }
                    throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
                }
            }
        }
    }
}
