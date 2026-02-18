package com.rdhardware.employeeportal.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun AuthRoute(onAuthenticated: () -> Unit) {
    val viewModel: AuthViewModel = viewModel(factory = AuthViewModel.factory())
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.isAuthenticated) {
        if (state.isAuthenticated) {
            onAuthenticated()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Employee Portal",
            style = MaterialTheme.typography.headlineSmall
        )
        Text(
            text = "Native Android",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        OutlinedTextField(
            value = state.email,
            onValueChange = viewModel::onEmailChanged,
            label = { Text("Email") },
            singleLine = true,
            enabled = !state.isLoading,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = state.password,
            onValueChange = viewModel::onPasswordChanged,
            label = { Text("Password") },
            singleLine = true,
            enabled = !state.isLoading,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )

        if (!state.errorMessage.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = state.errorMessage.orEmpty(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = { viewModel.signIn() },
            enabled = !state.isLoading,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (state.isLoading) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(18.dp)
                    )
                    Text("Signing in...")
                }
            } else {
                Text("Sign In")
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Uses mobile API endpoints under /api/mobile/v1/auth/*",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
