package com.rdhardware.employeeportal.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.rdhardware.employeeportal.core.data.AppGraph
import com.rdhardware.employeeportal.core.network.ApiResult
import com.rdhardware.employeeportal.feature.profile.data.MobileProfileData
import com.rdhardware.employeeportal.feature.profile.data.ProfileRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfileUiState(
    val isLoading: Boolean = true,
    val data: MobileProfileData? = null,
    val errorMessage: String? = null
)

class ProfileViewModel(
    private val profileRepository: ProfileRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { state ->
                state.copy(isLoading = true, errorMessage = null)
            }

            when (val result = profileRepository.loadProfile()) {
                is ApiResult.Success -> {
                    _uiState.update {
                        ProfileUiState(
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
                    if (modelClass.isAssignableFrom(ProfileViewModel::class.java)) {
                        @Suppress("UNCHECKED_CAST")
                        return ProfileViewModel(AppGraph.profileRepository) as T
                    }
                    throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
                }
            }
        }
    }
}
