import { NextResponse } from "next/server"

import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  LATE_OVERTIME_REPORT_SECTIONS,
  type LateOvertimeReportSectionKey,
  type LateOvertimeSectionDataResponse,
} from "@/modules/reports/payroll/types/report-view-models"
import { getLateOvertimeReportWorkspaceViewModel } from "@/modules/reports/payroll/utils/get-late-overtime-report-view-model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    companyId: string
  }>
}

const isSectionKey = (value: string | null): value is LateOvertimeReportSectionKey => {
  if (!value) return false
  return LATE_OVERTIME_REPORT_SECTIONS.some((section) => section === value)
}

export async function GET(request: Request, context: RouteContext) {
  const { companyId } = await context.params

  try {
    const activeCompany = await getActiveCompanyContext({ companyId })
    if (!hasModuleAccess(activeCompany.companyRole as CompanyRole, "reports")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const searchParams = url.searchParams
    const sectionRaw = searchParams.get("section")
    if (!isSectionKey(sectionRaw)) {
      return NextResponse.json({ error: "Invalid section filter." }, { status: 400 })
    }

    const viewModel = await getLateOvertimeReportWorkspaceViewModel({
      companyId: activeCompany.companyId,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      topN: searchParams.get("topN") ?? undefined,
    })

    let payload: LateOvertimeSectionDataResponse
    if (sectionRaw === "employees-late") {
      payload = {
        section: sectionRaw,
        filters: viewModel.filters,
        summary: viewModel.summary,
        employeeRows: viewModel.topEmployeesByLate,
      }
    } else if (sectionRaw === "employees-overtime") {
      payload = {
        section: sectionRaw,
        filters: viewModel.filters,
        summary: viewModel.summary,
        employeeRows: viewModel.topEmployeesByOvertime,
      }
    } else if (sectionRaw === "departments-late") {
      payload = {
        section: sectionRaw,
        filters: viewModel.filters,
        summary: viewModel.summary,
        departmentRows: viewModel.topDepartmentsByLate,
      }
    } else {
      payload = {
        section: sectionRaw,
        filters: viewModel.filters,
        summary: viewModel.summary,
        departmentRows: viewModel.topDepartmentsByOvertime,
      }
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Unable to load late/overtime section data." }, { status: 500 })
  }
}

