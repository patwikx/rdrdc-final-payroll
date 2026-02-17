import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getContactEmergencyDirectoryCsvRows,
  getContactEmergencyDirectoryViewModel,
} from "@/modules/reports/hr/utils/get-contact-emergency-directory-view-model"

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

const toScopeLabel = (
  value: "all" | "missing-primary-contact" | "missing-emergency-contact" | "missing-any-critical"
): string => {
  if (value === "missing-primary-contact") return "MISSING_PRIMARY_CONTACT"
  if (value === "missing-emergency-contact") return "MISSING_EMERGENCY_CONTACT"
  if (value === "missing-any-critical") return "MISSING_ANY_CRITICAL"
  return "ALL"
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

    const viewModel = await getContactEmergencyDirectoryViewModel({
      companyId: activeCompany.companyId,
      departmentId: searchParams.get("departmentId") ?? undefined,
      includeInactive: searchParams.get("includeInactive") ?? undefined,
      directoryScope: searchParams.get("directoryScope") ?? undefined,
    })

    const headerRows: string[][] = [
      ["Contact and Emergency Directory Report"],
      ["Company", viewModel.companyName],
      ["Department", viewModel.filters.departmentId || "ALL"],
      ["Include Inactive", viewModel.filters.includeInactive ? "YES" : "NO"],
      ["Directory Scope", toScopeLabel(viewModel.filters.directoryScope)],
      ["Generated", viewModel.generatedAtLabel],
      [],
      ["Summary"],
      ["Employees", String(viewModel.summary.totalEmployees)],
      ["With Primary Contact", String(viewModel.summary.withPrimaryContact)],
      ["Missing Primary Contact", String(viewModel.summary.missingPrimaryContact)],
      ["With Emergency Contact", String(viewModel.summary.withEmergencyContact)],
      ["Missing Emergency Contact", String(viewModel.summary.missingEmergencyContact)],
      ["Readiness Rate", `${viewModel.summary.readinessRate.toFixed(2)}%`],
      [],
      [
        "Employee Number",
        "Employee Name",
        "Department",
        "Status",
        "Primary Contact Number",
        "All Contact Numbers",
        "Primary Email",
        "All Emails",
        "Primary Emergency Contact",
        "Primary Emergency Relationship",
        "Primary Emergency Number",
        "All Emergency Contacts",
        "Missing Fields",
      ],
    ]

    const rows = getContactEmergencyDirectoryCsvRows(viewModel.rows)
    const csv = [...headerRows, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")

    await createAuditLog({
      tableName: "Employee",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EXPORT_CONTACT_EMERGENCY_DIRECTORY_CSV",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "contact-emergency-directory-csv" },
        { fieldName: "departmentId", newValue: viewModel.filters.departmentId || "ALL" },
        { fieldName: "includeInactive", newValue: viewModel.filters.includeInactive },
        { fieldName: "directoryScope", newValue: viewModel.filters.directoryScope },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
      ],
    })

    const fileName = `contact-emergency-directory-${toDateStamp(new Date())}.csv`
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

    return NextResponse.json({ error: "Unable to export contact and emergency directory report." }, { status: 500 })
  }
}
