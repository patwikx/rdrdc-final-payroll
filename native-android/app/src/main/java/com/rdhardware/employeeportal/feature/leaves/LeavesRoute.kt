package com.rdhardware.employeeportal.feature.leaves

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun LeavesRoute() {
    val viewModel: LeavesViewModel = viewModel(factory = LeavesViewModel.factory())
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (state.isLoading) {
            CircularProgressIndicator()
            Text("Loading leaves...")
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
            visible = state.data != null && !state.isLoading,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            val model = state.data ?: return@AnimatedVisibility

            Text(
                text = "Leave Balances",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            if (model.leaveBalances.isEmpty()) {
                Text(
                    text = "No leave balances available.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                model.leaveBalances.take(6).forEach { balance ->
                    Text(
                        text = "${balance.leaveTypeName}: ${balance.availableBalance}",
                        modifier = Modifier.fillMaxWidth(),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            Text(
                text = "Recent Requests",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 8.dp)
            )

            if (model.requests.isEmpty()) {
                Text(
                    text = "No leave requests yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                model.requests.take(20).forEach { request ->
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Text(
                            text = "${request.requestNumber} • ${request.statusCode}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "${request.leaveTypeName}: ${request.startDate} - ${request.endDate}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
