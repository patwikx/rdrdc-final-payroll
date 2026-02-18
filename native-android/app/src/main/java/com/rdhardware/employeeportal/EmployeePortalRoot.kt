package com.rdhardware.employeeportal

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.rdhardware.employeeportal.core.designsystem.PortalTheme
import com.rdhardware.employeeportal.core.navigation.PortalNavHost

@Composable
fun EmployeePortalRoot() {
    PortalTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            PortalNavHost()
        }
    }
}
