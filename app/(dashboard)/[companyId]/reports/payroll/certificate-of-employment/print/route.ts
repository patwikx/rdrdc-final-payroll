import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { buildCertificateOfEmploymentHtml } from "@/modules/reports/payroll/utils/certificate-of-employment-helpers"
import {
  getCertificateOfEmploymentWorkspaceViewModel,
  toCertificateOfEmploymentPrintPayload,
} from "@/modules/reports/payroll/utils/get-certificate-of-employment-view-model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    companyId: string
  }>
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

    const viewModel = await getCertificateOfEmploymentWorkspaceViewModel({
      companyId: activeCompany.companyId,
      employeeId: searchParams.get("employeeId") ?? undefined,
      signatoryId: searchParams.get("signatoryId") ?? undefined,
      signatoryDepartmentId: searchParams.get("signatoryDepartmentId") ?? undefined,
      includeCompensation: searchParams.get("includeCompensation") ?? undefined,
      certificateDate: searchParams.get("certificateDate") ?? undefined,
      purpose: searchParams.get("purpose") ?? undefined,
    })

    const printModel = toCertificateOfEmploymentPrintPayload(viewModel)
    if (!printModel) {
      return NextResponse.json({ error: "Employee not found for certificate generation." }, { status: 404 })
    }

    await createAuditLog({
      tableName: "Employee",
      recordId: printModel.selectedEmployeeId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "PRINT_CERTIFICATE_OF_EMPLOYMENT",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "employeeId", newValue: printModel.selectedEmployeeId },
        { fieldName: "includeCompensation", newValue: printModel.includeCompensation },
        { fieldName: "purpose", newValue: printModel.purpose || "GENERAL" },
        { fieldName: "signatoryName", newValue: printModel.payload.signatoryName },
        { fieldName: "signatoryDepartmentName", newValue: printModel.payload.signatoryDepartmentName },
      ],
    })

    const html = buildCertificateOfEmploymentHtml(printModel.payload)
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

    return NextResponse.json({ error: "Unable to generate certificate of employment." }, { status: 500 })
  }
}
