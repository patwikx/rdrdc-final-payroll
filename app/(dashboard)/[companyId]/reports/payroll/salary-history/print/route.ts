import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getSalaryHistoryReportWorkspaceViewModel,
} from "@/modules/reports/payroll/utils/get-salary-history-report-view-model"
import { buildSalaryHistoryReportPrintHtml } from "@/modules/reports/payroll/utils/salary-history-report-print-helpers"

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

    const viewModel = await getSalaryHistoryReportWorkspaceViewModel({
      companyId: activeCompany.companyId,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      employeeId: searchParams.get("employeeId") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      forExport: true,
    })

    const selectedEmployeeLabel = viewModel.filters.employeeId
      ? (viewModel.options.employees.find((item) => item.id === viewModel.filters.employeeId)?.label ?? "Unknown")
      : "All employees"

    const selectedDepartmentLabel = viewModel.filters.departmentId
      ? (viewModel.options.departments.find((item) => item.id === viewModel.filters.departmentId)?.label ?? "Unknown")
      : "All departments"

    await createAuditLog({
      tableName: "EmployeeSalaryHistory",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "PRINT_SALARY_HISTORY_REPORT",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "salary-history-print" },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
        { fieldName: "startDate", newValue: viewModel.filters.startDate },
        { fieldName: "endDate", newValue: viewModel.filters.endDate },
        { fieldName: "employeeId", newValue: viewModel.filters.employeeId || "ALL" },
        { fieldName: "departmentId", newValue: viewModel.filters.departmentId || "ALL" },
      ],
    })

    const html = buildSalaryHistoryReportPrintHtml({
      companyName: viewModel.companyName,
      generatedAtLabel: viewModel.generatedAtLabel,
      startDate: viewModel.filters.startDate,
      endDate: viewModel.filters.endDate,
      employeeLabel: selectedEmployeeLabel,
      departmentLabel: selectedDepartmentLabel,
      rows: viewModel.rows,
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

    return NextResponse.json({ error: "Unable to generate salary history print output." }, { status: 500 })
  }
}
