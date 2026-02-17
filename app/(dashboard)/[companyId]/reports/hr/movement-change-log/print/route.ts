import { NextResponse } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getMovementChangeLogViewModel,
  movementCategoryToLabel,
} from "@/modules/reports/hr/utils/get-movement-change-log-view-model"
import { buildMovementChangeLogPrintHtml } from "@/modules/reports/hr/utils/movement-change-log-print-helpers"

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

    const viewModel = await getMovementChangeLogViewModel({
      companyId: activeCompany.companyId,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      includeInactive: searchParams.get("includeInactive") ?? undefined,
      movementCategory: searchParams.get("movementCategory") ?? undefined,
    })

    const departmentLabel = viewModel.filters.departmentId
      ? (viewModel.options.departments.find((item) => item.id === viewModel.filters.departmentId)?.label ?? "Unknown")
      : "All departments"

    await createAuditLog({
      tableName: "Employee",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "PRINT_MOVEMENT_CHANGE_LOG_REPORT",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "departmentId", newValue: viewModel.filters.departmentId || "ALL" },
        { fieldName: "includeInactive", newValue: viewModel.filters.includeInactive },
        { fieldName: "movementCategory", newValue: viewModel.filters.movementCategory },
        { fieldName: "startDate", newValue: viewModel.filters.startDate },
        { fieldName: "endDate", newValue: viewModel.filters.endDate },
        { fieldName: "rowCount", newValue: viewModel.rows.length },
      ],
    })

    const html = buildMovementChangeLogPrintHtml({
      companyName: viewModel.companyName,
      generatedAtLabel: viewModel.generatedAtLabel,
      startDate: viewModel.filters.startDate,
      endDate: viewModel.filters.endDate,
      departmentLabel,
      includeInactive: viewModel.filters.includeInactive,
      movementCategoryLabel: movementCategoryToLabel(viewModel.filters.movementCategory),
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

    return NextResponse.json({ error: "Unable to generate movement and change log print output." }, { status: 500 })
  }
}
