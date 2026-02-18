package com.rdhardware.employeeportal.feature.profile

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun ProfileRoute() {
    val viewModel: ProfileViewModel = viewModel(factory = ProfileViewModel.factory())
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (state.isLoading) {
            CircularProgressIndicator()
            Text("Loading profile...")
        }

        if (!state.errorMessage.isNullOrBlank()) {
            Text(
                text = state.errorMessage.orEmpty(),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium
            )
            Button(onClick = { viewModel.refresh() }) {
                Text("Retry")
            }
        }

        AnimatedVisibility(
            visible = !state.isLoading && state.errorMessage.isNullOrBlank(),
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            val profile = state.data ?: return@AnimatedVisibility

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "${profile.firstName} ${profile.lastName}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text("Employee #: ${profile.employeeNumber}")
                Text("Department: ${profile.department?.name ?: "N/A"}")
                Text("Position: ${profile.position?.name ?: "N/A"}")

                val email = profile.emails.firstOrNull { it.isPrimary } ?: profile.emails.firstOrNull()
                val phone = profile.contacts.firstOrNull { it.isPrimary } ?: profile.contacts.firstOrNull()
                val address = profile.addresses.firstOrNull { it.isPrimary } ?: profile.addresses.firstOrNull()

                Text("Email: ${email?.email ?: "N/A"}")
                Text("Phone: ${phone?.countryCode.orEmpty()} ${phone?.number ?: "N/A"}")
                Text(
                    text = "Address: ${listOf(address?.street, address?.barangay, address?.city, address?.province).filterNotNull().joinToString(", ").ifBlank { "N/A" }}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
