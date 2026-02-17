import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getMonthlyBirWTaxCsvRows,
  getMonthlyBirWTaxReportWorkspaceViewModel,
} from "@/modules/reports/payroll/utils/get-monthly-bir-wtax-report-view-model"

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

    const viewModel = await getMonthlyBirWTaxReportWorkspaceViewModel({
      companyId: activeCompany.companyId,
      year: searchParams.get("year") ?? undefined,
      month: searchParams.get("month") ?? undefined,
      includeTrialRuns: searchParams.get("includeTrialRuns") ?? undefined,
    })

    const headers = ["Employee Number", "Employee Name", "Department", "TIN", "Run Numbers", "Withholding Tax"]
    const dataRows = getMonthlyBirWTaxCsvRows(viewModel.rows)
    const lines = [headers, ...dataRows].map((row) => row.map(csvEscape).join(","))
    const csv = lines.join("\n")

    await createAuditLog({
      tableName: "Payslip",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EXPORT_MONTHLY_BIR_WTAX_REPORT_CSV",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "monthly-bir-wtax-csv" },
        { fieldName: "year", newValue: viewModel.year },
        { fieldName: "month", newValue: viewModel.month },
        { fieldName: "includeTrialRuns", newValue: viewModel.includeTrialRuns },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
        { fieldName: "totalWithholdingTaxAmount", newValue: viewModel.totalWithholdingTaxAmount },
      ],
    })

    const fileName = `monthly-bir-wtax-${toDateStamp(new Date())}.csv`
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

    return NextResponse.json({ error: "Unable to export monthly BIR WTAX report." }, { status: 500 })
  }
}
