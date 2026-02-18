package com.rdhardware.employeeportal.feature.overtime.data

import kotlinx.serialization.Serializable

@Serializable
data class MobileOvertimeEnvelope(
    val ok: Boolean = false,
    val message: String? = null,
    val error: String? = null,
    val data: List<MobileOvertimeRequest>? = null
)

@Serializable
data class MobileOvertimeRequest(
    val id: String,
    val requestNumber: String,
    val overtimeDate: String,
    val overtimeDateInput: String,
    val startTime: String,
    val endTime: String,
    val hours: Double,
    val reason: String? = null,
    val statusCode: String,
    val supervisorApproverName: String? = null,
    val supervisorApprovedAt: String? = null,
    val supervisorApprovalRemarks: String? = null,
    val hrApproverName: String? = null,
    val hrApprovedAt: String? = null,
    val hrApprovalRemarks: String? = null,
    val hrRejectedAt: String? = null,
    val hrRejectionReason: String? = null
)
