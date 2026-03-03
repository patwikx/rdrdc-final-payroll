import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { PayrollRecurringEarningsPageClient } from "@/modules/payroll/components/payroll-recurring-earnings-page-client"
import { getRecurringEarningsViewModel } from "@/modules/payroll/utils/get-recurring-earnings-view-model"

type PayrollRecurringEarningsPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ page?: string; q?: string; status?: string }>
}

export default async function PayrollRecurringEarningsPage({ params, searchParams }: PayrollRecurringEarningsPageProps) {
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

  if (!hasModuleAccess(company.companyRole as CompanyRole, "payroll")) {
    redirect(`/${company.companyId}/dashboard`)
  }

  const pageValue = parsedSearch.page ? Number(parsedSearch.page) : 1
  const statusValue =
    parsedSearch.status === "ACTIVE" || parsedSearch.status === "INACTIVE"
      ? parsedSearch.status
      : "ALL"

  const viewModel = await getRecurringEarningsViewModel(company.companyId, {
    page: Number.isFinite(pageValue) ? pageValue : 1,
    query: parsedSearch.q ?? "",
    status: statusValue,
  })

  return (
    <PayrollRecurringEarningsPageClient
      companyId={viewModel.companyId}
      companyName={viewModel.companyName}
      employees={viewModel.employees}
      earningTypes={viewModel.earningTypes}
      records={viewModel.records}
      filters={viewModel.filters}
      pagination={viewModel.pagination}
    />
  )
}
