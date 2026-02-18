package com.rdhardware.employeeportal.feature.payslips

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
fun PayslipsRoute() {
    val viewModel: PayslipsViewModel = viewModel(factory = PayslipsViewModel.factory())
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (state.isLoading) {
            CircularProgressIndicator()
            Text("Loading payslips...")
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
            val payslips = state.data?.rows ?: emptyList()
            val latest = payslips.firstOrNull()

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Year To Date",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )

                Text("Gross: ${latest?.ytdGrossPay ?: 0.0}")
                Text("Tax: ${latest?.ytdTaxWithheld ?: 0.0}")
                Text("Net: ${latest?.ytdNetPay ?: 0.0}")

                Text(
                    text = "Recent Payslips",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )

                if (payslips.isEmpty()) {
                    Text(
                        text = "No payslips available yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    payslips.take(20).forEach { payslip ->
                        Text(
                            text = "${payslip.payslipNumber} • Net ${payslip.netPay}",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
    }
}
