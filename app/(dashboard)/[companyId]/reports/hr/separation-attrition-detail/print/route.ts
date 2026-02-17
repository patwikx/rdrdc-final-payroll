import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getSeparationAttritionDetailViewModel,
  separationAttritionScopeToLabel,
} from "@/modules/reports/hr/utils/get-separation-attrition-detail-view-model"
import { buildSeparationAttritionDetailPrintHtml } from "@/modules/reports/hr/utils/separation-attrition-detail-print-helpers"

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

    const viewModel = await getSeparationAttritionDetailViewModel({
      companyId: activeCompany.companyId,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      includeInactive: searchParams.get("includeInactive") ?? undefined,
      attritionScope: searchParams.get("attritionScope") ?? undefined,
    })

    const departmentLabel = viewModel.filters.departmentId
      ? (viewModel.options.departments.find((item) => item.id === viewModel.filters.departmentId)?.label ?? "Unknown")
      : "All departments"

    await createAuditLog({
      tableName: "Employee",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "PRINT_SEPARATION_ATTRITION_DETAIL_REPORT",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "departmentId", newValue: viewModel.filters.departmentId || "ALL" },
        { fieldName: "includeInactive", newValue: viewModel.filters.includeInactive },
        { fieldName: "attritionScope", newValue: viewModel.filters.attritionScope },
        { fieldName: "startDate", newValue: viewModel.filters.startDate },
        { fieldName: "endDate", newValue: viewModel.filters.endDate },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
      ],
    })

    const html = buildSeparationAttritionDetailPrintHtml({
      companyName: viewModel.companyName,
      generatedAtLabel: viewModel.generatedAtLabel,
      startDate: viewModel.filters.startDate,
      endDate: viewModel.filters.endDate,
      departmentLabel,
      includeInactive: viewModel.filters.includeInactive,
      attritionScopeLabel: separationAttritionScopeToLabel(viewModel.filters.attritionScope),
      activeHeadcount: viewModel.summary.activeHeadcount,
      attritionRate: viewModel.summary.attritionRate,
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

    return NextResponse.json({ error: "Unable to generate separation and attrition print output." }, { status: 500 })
  }
}
