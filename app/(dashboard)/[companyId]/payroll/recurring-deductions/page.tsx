import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { PayrollRecurringDeductionsPageClient } from "@/modules/payroll/components/payroll-recurring-deductions-page-client"
import { getRecurringDeductionsViewModel } from "@/modules/payroll/utils/get-recurring-deductions-view-model"
import { RecurringDeductionStatus } from "@prisma/client"

type PayrollRecurringDeductionsPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ page?: string; q?: string; status?: string }>
}

export default async function PayrollRecurringDeductionsPage({ params, searchParams }: PayrollRecurringDeductionsPageProps) {
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
  const allowedStatuses = new Set<RecurringDeductionStatus>(Object.values(RecurringDeductionStatus))
  const statusValue =
    parsedSearch.status && allowedStatuses.has(parsedSearch.status as RecurringDeductionStatus)
      ? (parsedSearch.status as RecurringDeductionStatus)
      : "ALL"

  const viewModel = await getRecurringDeductionsViewModel(company.companyId, {
    page: Number.isFinite(pageValue) ? pageValue : 1,
    query: parsedSearch.q ?? "",
    status: statusValue,
  })

  return (
    <PayrollRecurringDeductionsPageClient
      companyId={viewModel.companyId}
      companyName={viewModel.companyName}
      employees={viewModel.employees}
      deductionTypes={viewModel.deductionTypes}
      records={viewModel.records}
      filters={viewModel.filters}
      pagination={viewModel.pagination}
    />
  )
}
