import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getGovernmentIdComplianceCsvRows,
  getGovernmentIdComplianceViewModel,
  governmentIdComplianceScopeToLabel,
} from "@/modules/reports/hr/utils/get-government-id-compliance-view-model"

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

    const viewModel = await getGovernmentIdComplianceViewModel({
      companyId: activeCompany.companyId,
      departmentId: searchParams.get("departmentId") ?? undefined,
      includeInactive: searchParams.get("includeInactive") ?? undefined,
      complianceScope: searchParams.get("complianceScope") ?? undefined,
    })

    const headerRows: string[][] = [
      ["Government ID Compliance Report"],
      ["Company", viewModel.companyName],
      ["As Of", viewModel.asOfDateValue],
      ["Department", viewModel.filters.departmentId || "ALL"],
      ["Include Inactive", viewModel.filters.includeInactive ? "YES" : "NO"],
      ["Compliance Scope", governmentIdComplianceScopeToLabel(viewModel.filters.complianceScope)],
      ["Generated", viewModel.generatedAtLabel],
      [],
      ["Summary"],
      ["Employees", String(viewModel.summary.totalEmployees)],
      ["Compliant", String(viewModel.summary.compliantCount)],
      ["Incomplete", String(viewModel.summary.incompleteCount)],
      ["Missing Any Required ID", String(viewModel.summary.missingAnyCount)],
      ["Quality Issue Rows", String(viewModel.summary.qualityIssueCount)],
      ["Average Completion", `${viewModel.summary.averageCompletionRate.toFixed(2)}%`],
      [],
      [
        "Employee Number",
        "Employee Name",
        "Department",
        "Status",
        "TIN Status",
        "TIN Value",
        "SSS Status",
        "SSS Value",
        "PhilHealth Status",
        "PhilHealth Value",
        "Pag-IBIG Status",
        "Pag-IBIG Value",
        "Completion",
        "Missing Required IDs",
        "Quality Issues",
      ],
    ]

    const rows = getGovernmentIdComplianceCsvRows(viewModel.rows)
    const csv = [...headerRows, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")

    await createAuditLog({
      tableName: "Employee",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EXPORT_GOVERNMENT_ID_COMPLIANCE_CSV",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "government-id-compliance-csv" },
        { fieldName: "departmentId", newValue: viewModel.filters.departmentId || "ALL" },
        { fieldName: "includeInactive", newValue: viewModel.filters.includeInactive },
        { fieldName: "complianceScope", newValue: viewModel.filters.complianceScope },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
      ],
    })

    const fileName = `government-id-compliance-${toDateStamp(new Date())}.csv`
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

    return NextResponse.json({ error: "Unable to export government ID compliance report." }, { status: 500 })
  }
}
