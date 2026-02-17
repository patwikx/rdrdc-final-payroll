import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getMovementChangeLogCsvRows,
  getMovementChangeLogViewModel,
  movementCategoryToLabel,
} from "@/modules/reports/hr/utils/get-movement-change-log-view-model"

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

    const viewModel = await getMovementChangeLogViewModel({
      companyId: activeCompany.companyId,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      includeInactive: searchParams.get("includeInactive") ?? undefined,
      movementCategory: searchParams.get("movementCategory") ?? undefined,
    })

    const headerRows: string[][] = [
      ["Movement and Change Log Report"],
      ["Company", viewModel.companyName],
      ["Start Date", viewModel.filters.startDate],
      ["End Date", viewModel.filters.endDate],
      ["Department", viewModel.filters.departmentId || "ALL"],
      ["Include Inactive", viewModel.filters.includeInactive ? "YES" : "NO"],
      ["Category", movementCategoryToLabel(viewModel.filters.movementCategory)],
      ["Generated", viewModel.generatedAtLabel],
      [],
      ["Summary"],
      ["Total Events", String(viewModel.summary.totalEvents)],
      ["Employees Impacted", String(viewModel.summary.employeesImpacted)],
      ["Status Events", String(viewModel.summary.statusEvents)],
      ["Organization Events", String(viewModel.summary.organizationEvents)],
      ["Salary Events", String(viewModel.summary.salaryEvents)],
      [],
      [
        "Effective Date",
        "Employee Number",
        "Employee Name",
        "Department",
        "Status",
        "Category",
        "Movement",
        "Previous Value",
        "New Value",
        "Reason",
        "Remarks",
        "Created At ISO",
      ],
    ]

    const rows = getMovementChangeLogCsvRows(viewModel.rows)
    const csv = [...headerRows, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")

    await createAuditLog({
      tableName: "Employee",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EXPORT_MOVEMENT_CHANGE_LOG_CSV",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "movement-change-log-csv" },
        { fieldName: "departmentId", newValue: viewModel.filters.departmentId || "ALL" },
        { fieldName: "includeInactive", newValue: viewModel.filters.includeInactive },
        { fieldName: "movementCategory", newValue: viewModel.filters.movementCategory },
        { fieldName: "startDate", newValue: viewModel.filters.startDate },
        { fieldName: "endDate", newValue: viewModel.filters.endDate },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
      ],
    })

    const fileName = `movement-change-log-${toDateStamp(new Date())}.csv`
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

    return NextResponse.json({ error: "Unable to export movement and change log report." }, { status: 500 })
  }
}
