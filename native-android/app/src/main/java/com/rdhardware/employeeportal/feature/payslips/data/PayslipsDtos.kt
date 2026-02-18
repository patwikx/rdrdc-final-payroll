package com.rdhardware.employeeportal.feature.payslips.data

import kotlinx.serialization.Serializable

@Serializable
data class MobilePayslipsEnvelope(
    val ok: Boolean = false,
    val message: String? = null,
    val error: String? = null,
    val data: MobilePayslipsData? = null
)

@Serializable
data class MobilePayslipsData(
    val rows: List<MobilePayslipRow> = emptyList()
)

@Serializable
data class MobilePayslipRow(
    val id: String,
    val payslipNumber: String,
    val generatedAt: String,
    val releasedAt: String? = null,
    val periodNumber: Int,
    val cutoffStartDate: String,
    val cutoffEndDate: String,
    val basicPay: Double,
    val grossPay: Double,
    val totalDeductions: Double,
    val netPay: Double,
    val ytdGrossPay: Double,
    val ytdTaxWithheld: Double,
    val ytdNetPay: Double,
    val sssEmployee: Double,
    val philHealthEmployee: Double,
    val pagIbigEmployee: Double,
    val withholdingTax: Double,
    val daysWorked: Double,
    val daysAbsent: Double,
    val overtimeHours: Double,
    val tardinessMins: Int,
    val downloadUrl: String,
    val earnings: List<MobilePayslipLineItem> = emptyList(),
    val deductions: List<MobilePayslipLineItem> = emptyList()
)

@Serializable
data class MobilePayslipLineItem(
    val id: String,
    val name: String,
    val description: String? = null,
    val amount: Double
)
