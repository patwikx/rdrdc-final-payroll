package com.rdhardware.employeeportal.core.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.rdhardware.employeeportal.feature.auth.AuthRoute
import com.rdhardware.employeeportal.feature.dashboard.DashboardRoute
import com.rdhardware.employeeportal.feature.leaves.LeavesRoute
import com.rdhardware.employeeportal.feature.materialrequests.approvals.MaterialRequestApprovalsRoute
import com.rdhardware.employeeportal.feature.materialrequests.posting.MaterialRequestPostingRoute
import com.rdhardware.employeeportal.feature.materialrequests.processing.MaterialRequestProcessingRoute
import com.rdhardware.employeeportal.feature.materialrequests.request.MaterialRequestRoute
import com.rdhardware.employeeportal.feature.overtime.OvertimeRoute
import com.rdhardware.employeeportal.feature.payslips.PayslipsRoute
import com.rdhardware.employeeportal.feature.profile.ProfileRoute

@Composable
fun PortalNavHost(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = AppDestinations.AUTH) {
        composable(AppDestinations.AUTH) {
            AuthRoute(onAuthenticated = {
                navController.navigate(AppDestinations.DASHBOARD) {
                    popUpTo(AppDestinations.AUTH) { inclusive = true }
                }
            })
        }
        composable(AppDestinations.DASHBOARD) {
            DashboardRoute(
                onOpenLeaves = { navController.navigate(AppDestinations.LEAVES) },
                onOpenOvertime = { navController.navigate(AppDestinations.OVERTIME) },
                onOpenPayslips = { navController.navigate(AppDestinations.PAYSLIPS) },
                onOpenProfile = { navController.navigate(AppDestinations.PROFILE) },
                onOpenMaterialRequests = { navController.navigate(AppDestinations.MATERIAL_REQUESTS) },
                onOpenMaterialApprovals = { navController.navigate(AppDestinations.MATERIAL_APPROVALS) },
                onOpenMaterialProcessing = { navController.navigate(AppDestinations.MATERIAL_PROCESSING) },
                onOpenMaterialPosting = { navController.navigate(AppDestinations.MATERIAL_POSTING) }
            )
        }
        composable(AppDestinations.LEAVES) { PlaceholderScreen("Leaves", navController) { LeavesRoute() } }
        composable(AppDestinations.OVERTIME) { PlaceholderScreen("Overtime", navController) { OvertimeRoute() } }
        composable(AppDestinations.PAYSLIPS) { PlaceholderScreen("Payslips", navController) { PayslipsRoute() } }
        composable(AppDestinations.PROFILE) { PlaceholderScreen("Profile", navController) { ProfileRoute() } }
        composable(AppDestinations.MATERIAL_REQUESTS) {
            PlaceholderScreen("Material Requests", navController) { MaterialRequestRoute() }
        }
        composable(AppDestinations.MATERIAL_APPROVALS) {
            PlaceholderScreen("Material Request Approvals", navController) { MaterialRequestApprovalsRoute() }
        }
        composable(AppDestinations.MATERIAL_PROCESSING) {
            PlaceholderScreen("Material Request Processing", navController) { MaterialRequestProcessingRoute() }
        }
        composable(AppDestinations.MATERIAL_POSTING) {
            PlaceholderScreen("Material Request Posting", navController) { MaterialRequestPostingRoute() }
        }
    }
}

@Composable
private fun PlaceholderScreen(
    title: String,
    navController: NavHostController,
    content: @Composable () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.Start
    ) {
        Button(onClick = { navController.popBackStack() }) {
            Text("Back to Dashboard")
        }
        Text(text = title)
        content()
    }
}
