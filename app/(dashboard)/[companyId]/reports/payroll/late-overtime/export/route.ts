import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getLateOvertimeCsvRows,
  getLateOvertimeReportWorkspaceViewModel,
} from "@/modules/reports/payroll/utils/get-late-overtime-report-view-model"
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

    const rows = getLateOvertimeCsvRows(viewModel, section)
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n")

    await createAuditLog({
      tableName: "Payslip",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EXPORT_LATE_OVERTIME_REPORT_CSV",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "late-overtime-csv" },
        { fieldName: "startDate", newValue: viewModel.summary.startDateValue },
        { fieldName: "endDate", newValue: viewModel.summary.endDateValue },
        { fieldName: "topN", newValue: viewModel.filters.topN },
        { fieldName: "section", newValue: section ?? "all" },
      ],
    })

    const fileName = `late-overtime-${section ?? "all"}-${toDateStamp(new Date())}.csv`
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

    return NextResponse.json({ error: "Unable to export late and overtime report." }, { status: 500 })
  }
}
