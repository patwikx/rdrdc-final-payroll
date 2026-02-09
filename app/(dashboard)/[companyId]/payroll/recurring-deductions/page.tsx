import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { PayrollRecurringDeductionsPageClient } from "@/modules/payroll/components/payroll-recurring-deductions-page-client"
import { getRecurringDeductionsViewModel } from "@/modules/payroll/utils/get-recurring-deductions-view-model"

type PayrollRecurringDeductionsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function PayrollRecurringDeductionsPage({ params }: PayrollRecurringDeductionsPageProps) {
  const { companyId } = await params

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

  const viewModel = await getRecurringDeductionsViewModel(company.companyId)

  return (
    <PayrollRecurringDeductionsPageClient
      companyId={viewModel.companyId}
      companyName={viewModel.companyName}
      employees={viewModel.employees}
      deductionTypes={viewModel.deductionTypes}
      records={viewModel.records}
    />
  )
}
