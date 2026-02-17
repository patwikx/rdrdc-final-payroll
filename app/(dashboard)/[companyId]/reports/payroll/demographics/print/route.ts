import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  buildDemographicReportPrintHtml,
  DEMOGRAPHIC_PRINT_COLUMNS,
  type DemographicPrintColumnKey,
} from "@/modules/reports/payroll/utils/demographic-report-print-helpers"
import { getDemographicReportWorkspaceViewModel } from "@/modules/reports/payroll/utils/get-demographic-report-view-model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    companyId: string
  }>
}

const parsePrintColumns = (rawValue: string | null): DemographicPrintColumnKey[] => {
  const allowed = new Set<DemographicPrintColumnKey>(DEMOGRAPHIC_PRINT_COLUMNS.map((column) => column.key))
  const rawKeys = (rawValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  if (rawKeys.length === 0) {
    return DEMOGRAPHIC_PRINT_COLUMNS.map((column) => column.key)
  }

  const selected = new Set<DemographicPrintColumnKey>()
  for (const rawKey of rawKeys) {
    if (allowed.has(rawKey as DemographicPrintColumnKey)) {
      selected.add(rawKey as DemographicPrintColumnKey)
    }
  }

  if (selected.size === 0) {
    return DEMOGRAPHIC_PRINT_COLUMNS.map((column) => column.key)
  }

  return DEMOGRAPHIC_PRINT_COLUMNS.filter((column) => selected.has(column.key)).map((column) => column.key)
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
    const departmentId = searchParams.get("departmentId") ?? undefined
    const includeInactive = searchParams.get("includeInactive") ?? undefined
    const columns = parsePrintColumns(searchParams.get("columns"))

    const viewModel = await getDemographicReportWorkspaceViewModel({
      companyId: activeCompany.companyId,
      departmentId,
      includeInactive,
    })

    const selectedDepartmentLabel = viewModel.filters.departmentId
      ? (viewModel.options.departments.find((item) => item.id === viewModel.filters.departmentId)?.label ?? "Unknown")
      : "All departments"

    await createAuditLog({
      tableName: "Employee",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "PRINT_DEMOGRAPHIC_REPORT",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "departmentId", newValue: viewModel.filters.departmentId || "ALL" },
        { fieldName: "includeInactive", newValue: viewModel.filters.includeInactive },
        { fieldName: "rowCount", newValue: viewModel.employees.length },
        { fieldName: "columns", newValue: columns.join(",") },
      ],
    })

    const html = buildDemographicReportPrintHtml({
      companyName: viewModel.companyName,
      asOfDateValue: viewModel.asOfDateValue,
      generatedAtLabel: viewModel.generatedAtLabel,
      includeInactive: viewModel.filters.includeInactive,
      departmentLabel: selectedDepartmentLabel,
      totalEmployees: viewModel.totalEmployees,
      activeEmployees: viewModel.activeEmployees,
      inactiveEmployees: viewModel.inactiveEmployees,
      averageAgeYears: viewModel.averageAgeYears,
      columns,
      employees: viewModel.employees,
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

    return NextResponse.json({ error: "Unable to generate demographic report print output." }, { status: 500 })
  }
}
