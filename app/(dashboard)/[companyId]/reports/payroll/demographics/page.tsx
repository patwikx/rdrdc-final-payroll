import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { DemographicReportClient } from "@/modules/reports/payroll/components/demographic-report-client"
import { getDemographicReportWorkspaceViewModel } from "@/modules/reports/payroll/utils/get-demographic-report-view-model"

type DemographicReportPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    departmentId?: string
    includeInactive?: string
  }>
}

export default async function DemographicReportPage({ params, searchParams }: DemographicReportPageProps) {
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

  const viewModel = await getDemographicReportWorkspaceViewModel({
    companyId: company.companyId,
    departmentId: parsedSearch.departmentId,
    includeInactive: parsedSearch.includeInactive,
  })

  return (
    <DemographicReportClient
      companyId={viewModel.companyId}
      companyName={viewModel.companyName}
      generatedAtLabel={viewModel.generatedAtLabel}
      asOfDateValue={viewModel.asOfDateValue}
      totalEmployees={viewModel.totalEmployees}
      activeEmployees={viewModel.activeEmployees}
      inactiveEmployees={viewModel.inactiveEmployees}
      averageAgeYears={viewModel.averageAgeYears}
      filters={viewModel.filters}
      options={viewModel.options}
      breakdowns={viewModel.breakdowns}
      employees={viewModel.employees}
    />
  )
}

