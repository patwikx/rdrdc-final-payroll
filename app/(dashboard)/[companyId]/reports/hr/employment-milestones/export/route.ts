import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  employmentMilestoneScopeToLabel,
  getEmploymentMilestonesCsvRows,
  getEmploymentMilestonesViewModel,
} from "@/modules/reports/hr/utils/get-employment-milestones-view-model"

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

    const viewModel = await getEmploymentMilestonesViewModel({
      companyId: activeCompany.companyId,
      departmentId: searchParams.get("departmentId") ?? undefined,
      includeInactive: searchParams.get("includeInactive") ?? undefined,
      milestoneScope: searchParams.get("milestoneScope") ?? undefined,
    })

    const headerRows: string[][] = [
      ["Employment Milestones Report"],
      ["Company", viewModel.companyName],
      ["As Of", viewModel.asOfDateValue],
      ["Department", viewModel.filters.departmentId || "ALL"],
      ["Include Inactive", viewModel.filters.includeInactive ? "YES" : "NO"],
      ["Milestone Scope", employmentMilestoneScopeToLabel(viewModel.filters.milestoneScope)],
      ["Generated", viewModel.generatedAtLabel],
      [],
      ["Summary"],
      ["Employees", String(viewModel.summary.totalEmployees)],
      ["Due Today", String(viewModel.summary.dueTodayCount)],
      ["Upcoming 30 Days", String(viewModel.summary.upcoming30Count)],
      ["Overdue", String(viewModel.summary.overdueCount)],
      ["No Milestone Date", String(viewModel.summary.withoutMilestoneCount)],
      [],
      [
        "Employee Number",
        "Employee Name",
        "Department",
        "Status",
        "Hire Date",
        "Probation End",
        "Regularization",
        "Contract End",
        "Separation Date",
        "Last Working Day",
        "Next Milestone",
        "Next Milestone Date",
        "Days to Next",
        "Overdue Milestones",
      ],
    ]

    const rows = getEmploymentMilestonesCsvRows(viewModel.rows)
    const csv = [...headerRows, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")

    await createAuditLog({
      tableName: "Employee",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EXPORT_EMPLOYMENT_MILESTONES_CSV",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "employment-milestones-csv" },
        { fieldName: "departmentId", newValue: viewModel.filters.departmentId || "ALL" },
        { fieldName: "includeInactive", newValue: viewModel.filters.includeInactive },
        { fieldName: "milestoneScope", newValue: viewModel.filters.milestoneScope },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
      ],
    })

    const fileName = `employment-milestones-${toDateStamp(new Date())}.csv`
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

    return NextResponse.json({ error: "Unable to export employment milestones report." }, { status: 500 })
  }
}
