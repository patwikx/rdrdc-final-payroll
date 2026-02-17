import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { getLateOvertimeReportWorkspaceViewModel } from "@/modules/reports/payroll/utils/get-late-overtime-report-view-model"
import { buildLateOvertimeReportPrintHtml } from "@/modules/reports/payroll/utils/late-overtime-report-print-helpers"
import {
  LATE_OVERTIME_REPORT_SECTIONS,
  type LateOvertimeReportSectionKey,
} from "@/modules/reports/payroll/types/report-view-models"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    companyId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  const { companyId } = await context.params
  const auditMeta = getRequestAuditMetadata(request)

  try {
    const activeCompany = await getActiveCompanyContext({ companyId })
    if (!hasModuleAccess(activeCompany.companyRole as CompanyRole, "reports")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const searchParams = url.searchParams
    const sectionParam = searchParams.get("section")
    const section = LATE_OVERTIME_REPORT_SECTIONS.find(
      (value) => value === sectionParam
    ) as LateOvertimeReportSectionKey | undefined

    const viewModel = await getLateOvertimeReportWorkspaceViewModel({
      companyId: activeCompany.companyId,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      topN: searchParams.get("topN") ?? undefined,
    })

    await createAuditLog({
      tableName: "Payslip",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "PRINT_LATE_OVERTIME_REPORT",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "late-overtime-print" },
        { fieldName: "startDate", newValue: viewModel.summary.startDateValue },
        { fieldName: "endDate", newValue: viewModel.summary.endDateValue },
        { fieldName: "topN", newValue: viewModel.filters.topN },
        { fieldName: "section", newValue: section ?? "all" },
        { fieldName: "employeeRowsByLate", newValue: viewModel.topEmployeesByLate.length },
        { fieldName: "departmentRowsByLate", newValue: viewModel.topDepartmentsByLate.length },
      ],
    })

    const html = buildLateOvertimeReportPrintHtml({
      companyName: viewModel.companyName,
      generatedAtLabel: viewModel.generatedAtLabel,
      periodLabel: viewModel.summary.periodLabel,
      topN: viewModel.filters.topN,
      section,
      totalLateMins: viewModel.summary.totalLateMins,
      totalOvertimeHours: viewModel.summary.totalOvertimeHours,
      totalOvertimePayAmount: viewModel.summary.totalOvertimePayAmount,
      totalTardinessDeductionAmount: viewModel.summary.totalTardinessDeductionAmount,
      topEmployeesByLate: viewModel.topEmployeesByLate,
      topEmployeesByOvertime: viewModel.topEmployeesByOvertime,
      topDepartmentsByLate: viewModel.topDepartmentsByLate,
      topDepartmentsByOvertime: viewModel.topDepartmentsByOvertime,
    })

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Unable to generate late and overtime print output." }, { status: 500 })
  }
}
