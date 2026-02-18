package com.rdhardware.employeeportal.feature.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun DashboardRoute(
    onOpenLeaves: () -> Unit,
    onOpenOvertime: () -> Unit,
    onOpenPayslips: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenMaterialRequests: () -> Unit,
    onOpenMaterialApprovals: () -> Unit,
    onOpenMaterialProcessing: () -> Unit,
    onOpenMaterialPosting: () -> Unit
) {
    val viewModel: DashboardViewModel = viewModel(factory = DashboardViewModel.factory())
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        when {
            state.isLoading -> {
                CircularProgressIndicator(modifier = Modifier.size(24.dp))
                Text("Loading employee portal context...")
            }

            !state.errorMessage.isNullOrBlank() -> {
                Text(
                    text = state.errorMessage.orEmpty(),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
                Button(onClick = { viewModel.refresh() }) {
                    Text("Retry")
                }
            }

            state.bootstrap != null -> {
                val bootstrap = state.bootstrap ?: return@Column
                val user = bootstrap.user
                val modules = bootstrap.modules

                Text(
                    text = "${bootstrap.company.name} (${bootstrap.company.code})",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "${user.firstName} ${user.lastName} • ${user.companyRole}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (modules.profile) {
                    Button(onClick = onOpenProfile, modifier = Modifier.fillMaxWidth()) { Text("Profile") }
                }
                if (modules.leaves) {
                    Button(onClick = onOpenLeaves, modifier = Modifier.fillMaxWidth()) { Text("Leaves") }
                }
                if (modules.overtime) {
                    Button(onClick = onOpenOvertime, modifier = Modifier.fillMaxWidth()) { Text("Overtime") }
                }
                if (modules.payslips) {
                    Button(onClick = onOpenPayslips, modifier = Modifier.fillMaxWidth()) { Text("Payslips") }
                }
                if (modules.materialRequests) {
                    Button(onClick = onOpenMaterialRequests, modifier = Modifier.fillMaxWidth()) {
                        Text("Material Requests")
                    }
                }
                if (modules.materialApprovals) {
                    Button(onClick = onOpenMaterialApprovals, modifier = Modifier.fillMaxWidth()) {
                        Text("Material Approvals")
                    }
                }
                if (modules.materialProcessing) {
                    Button(onClick = onOpenMaterialProcessing, modifier = Modifier.fillMaxWidth()) {
                        Text("Material Processing")
                    }
                }
                if (modules.materialPosting) {
                    Button(onClick = onOpenMaterialPosting, modifier = Modifier.fillMaxWidth()) {
                        Text("Material Posting")
                    }
                }
            }
        }
    }
}
