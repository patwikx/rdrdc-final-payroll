import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { SalaryHistoryReportClient } from "@/modules/reports/payroll/components/salary-history-report-client"
import { getSalaryHistoryReportWorkspaceViewModel } from "@/modules/reports/payroll/utils/get-salary-history-report-view-model"

type SalaryHistoryReportPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
    employeeId?: string
    departmentId?: string
    page?: string
    pageSize?: string
  }>
}

export default async function SalaryHistoryReportPage({ params, searchParams }: SalaryHistoryReportPageProps) {
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

  const viewModel = await getSalaryHistoryReportWorkspaceViewModel({
    companyId: company.companyId,
    startDate: parsedSearch.startDate,
    endDate: parsedSearch.endDate,
    employeeId: parsedSearch.employeeId,
    departmentId: parsedSearch.departmentId,
    page: parsedSearch.page,
    pageSize: parsedSearch.pageSize,
  })

  return (
    <SalaryHistoryReportClient
      companyId={viewModel.companyId}
      companyName={viewModel.companyName}
      generatedAtLabel={viewModel.generatedAtLabel}
      errorMessage={viewModel.errorMessage}
      filters={viewModel.filters}
      options={viewModel.options}
      rows={viewModel.rows}
      pagination={viewModel.pagination}
    />
  )
}

