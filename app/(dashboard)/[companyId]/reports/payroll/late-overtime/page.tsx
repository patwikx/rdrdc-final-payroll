import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { LateOvertimeReportClient } from "@/modules/reports/payroll/components/late-overtime-report-client"
import { getLateOvertimeReportWorkspaceViewModel } from "@/modules/reports/payroll/utils/get-late-overtime-report-view-model"

type LateOvertimeReportPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    elStartDate?: string
    elEndDate?: string
    elTopN?: string
    eoStartDate?: string
    eoEndDate?: string
    eoTopN?: string
    dlStartDate?: string
    dlEndDate?: string
    dlTopN?: string
    doStartDate?: string
    doEndDate?: string
    doTopN?: string
    startDate?: string
    endDate?: string
    topN?: string
  }>
}

export default async function LateOvertimeReportPage({
  params,
  searchParams,
}: LateOvertimeReportPageProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}

  let company: Awaited<ReturnType<typeof getActiveCompanyContext>> | null = null

  try {
    company = await getActiveCompanyContext({ companyId })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      redirect("/login")
    }
    throw error
  }

  if (!hasModuleAccess(company.companyRole as CompanyRole, "reports")) {
    redirect(`/${company.companyId}/dashboard`)
  }

  const [
    employeeLateViewModel,
    employeeOvertimeViewModel,
    departmentLateViewModel,
    departmentOvertimeViewModel,
  ] = await Promise.all([
    getLateOvertimeReportWorkspaceViewModel({
      companyId: company.companyId,
      startDate: parsedSearch.elStartDate ?? parsedSearch.startDate,
      endDate: parsedSearch.elEndDate ?? parsedSearch.endDate,
      topN: parsedSearch.elTopN ?? parsedSearch.topN,
    }),
    getLateOvertimeReportWorkspaceViewModel({
      companyId: company.companyId,
      startDate: parsedSearch.eoStartDate ?? parsedSearch.startDate,
      endDate: parsedSearch.eoEndDate ?? parsedSearch.endDate,
      topN: parsedSearch.eoTopN ?? parsedSearch.topN,
    }),
    getLateOvertimeReportWorkspaceViewModel({
      companyId: company.companyId,
      startDate: parsedSearch.dlStartDate ?? parsedSearch.startDate,
      endDate: parsedSearch.dlEndDate ?? parsedSearch.endDate,
      topN: parsedSearch.dlTopN ?? parsedSearch.topN,
    }),
    getLateOvertimeReportWorkspaceViewModel({
      companyId: company.companyId,
      startDate: parsedSearch.doStartDate ?? parsedSearch.startDate,
      endDate: parsedSearch.doEndDate ?? parsedSearch.endDate,
      topN: parsedSearch.doTopN ?? parsedSearch.topN,
    }),
  ])

  return (
    <LateOvertimeReportClient
      companyId={employeeLateViewModel.companyId}
      companyName={employeeLateViewModel.companyName}
      generatedAtLabel={employeeLateViewModel.generatedAtLabel}
      sectionFilters={{
        "employees-late": employeeLateViewModel.filters,
        "employees-overtime": employeeOvertimeViewModel.filters,
        "departments-late": departmentLateViewModel.filters,
        "departments-overtime": departmentOvertimeViewModel.filters,
      }}
      summary={employeeLateViewModel.summary}
      topEmployeesByLate={employeeLateViewModel.topEmployeesByLate}
      topEmployeesByOvertime={employeeOvertimeViewModel.topEmployeesByOvertime}
      topDepartmentsByLate={departmentLateViewModel.topDepartmentsByLate}
      topDepartmentsByOvertime={departmentOvertimeViewModel.topDepartmentsByOvertime}
    />
  )
}
