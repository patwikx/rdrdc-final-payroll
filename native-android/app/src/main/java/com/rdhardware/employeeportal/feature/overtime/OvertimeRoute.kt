package com.rdhardware.employeeportal.feature.overtime

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
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
fun OvertimeRoute() {
    val viewModel: OvertimeViewModel = viewModel(factory = OvertimeViewModel.factory())
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (state.isLoading) {
            CircularProgressIndicator()
            Text("Loading overtime requests...")
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
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Recent Overtime Requests",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )

                if (state.requests.isEmpty()) {
                    Text(
                        text = "No overtime requests yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    state.requests.take(20).forEach { request ->
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
                                text = "${request.overtimeDate} • ${request.hours} hour(s)",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}
