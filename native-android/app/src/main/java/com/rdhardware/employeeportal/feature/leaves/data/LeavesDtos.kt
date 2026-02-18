package com.rdhardware.employeeportal.feature.leaves.data

import kotlinx.serialization.Serializable

@Serializable
data class MobileLeavesEnvelope(
    val ok: Boolean = false,
    val message: String? = null,
    val error: String? = null,
    val data: MobileLeavesData? = null
)

@Serializable
data class MobileLeavesData(
    val leaveTypes: List<MobileLeaveType> = emptyList(),
    val leaveBalances: List<MobileLeaveBalance> = emptyList(),
    val requests: List<MobileLeaveRequest> = emptyList()
)

@Serializable
data class MobileLeaveType(
    val id: String,
    val code: String,
    val name: String,
    val isPaid: Boolean,
    val requiresApproval: Boolean
)

@Serializable
data class MobileLeaveBalance(
    val id: String,
    val leaveTypeId: String,
    val leaveTypeName: String,
    val currentBalance: Double,
    val availableBalance: Double,
    val creditsEarned: Double,
    val creditsUsed: Double
)

@Serializable
data class MobileLeaveRequest(
    val id: String,
    val requestNumber: String,
    val leaveTypeId: String,
    val isHalfDay: Boolean,
    val halfDayPeriod: String? = null,
    val startDate: String,
    val endDate: String,
    val numberOfDays: Double,
    val reason: String? = null,
    val statusCode: String,
    val leaveTypeName: String,
    val supervisorApproverName: String? = null,
    val supervisorApprovedAt: String? = null,
    val supervisorApprovalRemarks: String? = null,
    val hrApproverName: String? = null,
    val hrApprovedAt: String? = null,
    val hrApprovalRemarks: String? = null,
    val hrRejectedAt: String? = null,
    val hrRejectionReason: String? = null,
    val approverName: String? = null,
    val rejectionReason: String? = null
)
