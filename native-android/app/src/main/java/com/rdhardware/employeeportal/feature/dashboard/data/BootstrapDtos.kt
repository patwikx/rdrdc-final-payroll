package com.rdhardware.employeeportal.feature.dashboard.data

import kotlinx.serialization.Serializable

@Serializable
data class MobileBootstrapResponseEnvelope(
    val ok: Boolean = false,
    val message: String? = null,
    val error: String? = null,
    val data: EmployeePortalBootstrapData? = null
)

@Serializable
data class EmployeePortalBootstrapData(
    val user: BootstrapUser,
    val company: BootstrapCompany,
    val companies: List<BootstrapCompanyOption> = emptyList(),
    val employee: BootstrapEmployee? = null,
    val modules: BootstrapModuleFlags,
    val token: BootstrapTokenInfo? = null
)

@Serializable
data class BootstrapUser(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val role: String,
    val isAdmin: Boolean = false,
    val companyRole: String,
    val employeeId: String? = null,
    val employeeNumber: String? = null
)

@Serializable
data class BootstrapCompany(
    val id: String,
    val code: String,
    val name: String,
    val logoUrl: String? = null
)

@Serializable
data class BootstrapCompanyOption(
    val companyId: String,
    val companyCode: String,
    val companyName: String,
    val logoUrl: String? = null,
    val role: String,
    val isDefault: Boolean
)

@Serializable
data class BootstrapEmployee(
    val id: String,
    val employeeNumber: String,
    val firstName: String,
    val lastName: String,
    val hireDate: String,
    val regularizationDate: String? = null,
    val departmentName: String? = null,
    val positionName: String? = null,
    val employmentStatusName: String? = null,
    val employmentTypeName: String? = null,
    val isRequestApprover: Boolean = false,
    val isMaterialRequestPurchaser: Boolean = false,
    val isMaterialRequestPoster: Boolean = false
)

@Serializable
data class BootstrapModuleFlags(
    val dashboard: Boolean = false,
    val profile: Boolean = false,
    val leaves: Boolean = false,
    val overtime: Boolean = false,
    val payslips: Boolean = false,
    val materialRequests: Boolean = false,
    val materialApprovals: Boolean = false,
    val materialProcessing: Boolean = false,
    val materialPosting: Boolean = false
)

@Serializable
data class BootstrapTokenInfo(
    val issuedAt: Long,
    val expiresAt: Long
)
