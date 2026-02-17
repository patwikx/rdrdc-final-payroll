import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getSeparationAttritionDetailCsvRows,
  getSeparationAttritionDetailViewModel,
  separationAttritionScopeToLabel,
} from "@/modules/reports/hr/utils/get-separation-attrition-detail-view-model"

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

    const viewModel = await getSeparationAttritionDetailViewModel({
      companyId: activeCompany.companyId,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      includeInactive: searchParams.get("includeInactive") ?? undefined,
      attritionScope: searchParams.get("attritionScope") ?? undefined,
    })

    const headerRows: string[][] = [
      ["Separation and Attrition Detail Report"],
      ["Company", viewModel.companyName],
      ["Start Date", viewModel.filters.startDate],
      ["End Date", viewModel.filters.endDate],
      ["Department", viewModel.filters.departmentId || "ALL"],
      ["Include Inactive", viewModel.filters.includeInactive ? "YES" : "NO"],
      ["Attrition Scope", separationAttritionScopeToLabel(viewModel.filters.attritionScope)],
      ["Generated", viewModel.generatedAtLabel],
      [],
      ["Summary"],
      ["Separated Employees", String(viewModel.summary.totalSeparated)],
      ["Voluntary", String(viewModel.summary.voluntaryCount)],
      ["Involuntary", String(viewModel.summary.involuntaryCount)],
      ["Other", String(viewModel.summary.otherCount)],
      ["Active Headcount", String(viewModel.summary.activeHeadcount)],
      ["Average Tenure (Months)", viewModel.summary.averageTenureMonths.toFixed(2)],
      ["Attrition Rate", `${viewModel.summary.attritionRate.toFixed(2)}%`],
      [],
      [
        "Employee Number",
        "Employee Name",
        "Department",
        "Status",
        "Hire Date",
        "Separation Date",
        "Last Working Day",
        "Separation Reason Code",
        "Separation Reason",
        "Attrition Type",
        "Tenure Months",
        "Tenure Label",
        "Service Days",
      ],
    ]

    const rows = getSeparationAttritionDetailCsvRows(viewModel.rows)
    const csv = [...headerRows, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")

    await createAuditLog({
      tableName: "Employee",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EXPORT_SEPARATION_ATTRITION_DETAIL_CSV",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "separation-attrition-detail-csv" },
        { fieldName: "departmentId", newValue: viewModel.filters.departmentId || "ALL" },
        { fieldName: "includeInactive", newValue: viewModel.filters.includeInactive },
        { fieldName: "attritionScope", newValue: viewModel.filters.attritionScope },
        { fieldName: "startDate", newValue: viewModel.filters.startDate },
        { fieldName: "endDate", newValue: viewModel.filters.endDate },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
      ],
    })

    const fileName = `separation-attrition-detail-${toDateStamp(new Date())}.csv`
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

    return NextResponse.json({ error: "Unable to export separation and attrition detail report." }, { status: 500 })
  }
}
