import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getSalaryHistoryReportCsvRows,
  getSalaryHistoryReportWorkspaceViewModel,
} from "@/modules/reports/payroll/utils/get-salary-history-report-view-model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    companyId: string
  }>
}

const csvEscape = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const toDateStamp = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  })
    .format(value)
    .replace(/\//g, "")
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

    const headers = [
      "Employee Number",
      "Employee Name",
      "Department",
      "Effective Date",
      "Previous Salary",
      "New Salary",
      "Delta",
      "Adjustment Type",
      "Reason",
      "Remarks",
    ]

    const dataRows = getSalaryHistoryReportCsvRows(viewModel.rows)
    const lines = [headers, ...dataRows].map((row) => row.map(csvEscape).join(","))
    const csv = lines.join("\n")

    await createAuditLog({
      tableName: "EmployeeSalaryHistory",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EXPORT_SALARY_HISTORY_REPORT_CSV",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "salary-history-csv" },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
        { fieldName: "startDate", newValue: viewModel.filters.startDate },
        { fieldName: "endDate", newValue: viewModel.filters.endDate },
      ],
    })

    const fileName = `salary-history-${toDateStamp(new Date())}.csv`

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Unable to export salary history report." }, { status: 500 })
  }
}

