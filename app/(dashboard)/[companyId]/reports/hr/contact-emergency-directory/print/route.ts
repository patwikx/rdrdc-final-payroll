import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { buildContactEmergencyDirectoryPrintHtml } from "@/modules/reports/hr/utils/contact-emergency-directory-print-helpers"
import { getContactEmergencyDirectoryViewModel } from "@/modules/reports/hr/utils/get-contact-emergency-directory-view-model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    companyId: string
  }>
}

const toScopeLabel = (
  value: "all" | "missing-primary-contact" | "missing-emergency-contact" | "missing-any-critical"
): string => {
  if (value === "missing-primary-contact") return "Missing Primary Contact"
  if (value === "missing-emergency-contact") return "Missing Emergency Contact"
  if (value === "missing-any-critical") return "Missing Any Critical"
  return "All Employees"
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

    const departmentLabel = viewModel.filters.departmentId
      ? (viewModel.options.departments.find((item) => item.id === viewModel.filters.departmentId)?.label ?? "Unknown")
      : "All departments"

    await createAuditLog({
      tableName: "Employee",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "PRINT_CONTACT_EMERGENCY_DIRECTORY_REPORT",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "departmentId", newValue: viewModel.filters.departmentId || "ALL" },
        { fieldName: "includeInactive", newValue: viewModel.filters.includeInactive },
        { fieldName: "directoryScope", newValue: viewModel.filters.directoryScope },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
      ],
    })

    const html = buildContactEmergencyDirectoryPrintHtml({
      companyName: viewModel.companyName,
      generatedAtLabel: viewModel.generatedAtLabel,
      departmentLabel,
      includeInactive: viewModel.filters.includeInactive,
      directoryScopeLabel: toScopeLabel(viewModel.filters.directoryScope),
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

    return NextResponse.json({ error: "Unable to generate contact and emergency directory print output." }, { status: 500 })
  }
}
