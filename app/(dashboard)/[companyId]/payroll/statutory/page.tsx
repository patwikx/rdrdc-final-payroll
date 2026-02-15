import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { PayrollStatutoryPageClient } from "@/modules/payroll/components/payroll-statutory-page-client"
import { getPayrollStatutoryViewModel } from "@/modules/payroll/utils/get-payroll-statutory-view-model"

type PayrollStatutoryPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function PayrollStatutoryPage({ params }: PayrollStatutoryPageProps) {
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

  const viewModel = await getPayrollStatutoryViewModel(company.companyId)

  return (
    <PayrollStatutoryPageClient
      companyId={viewModel.companyId}
      companyName={viewModel.companyName}
      printedBy={viewModel.printedBy}
      payrollRegisterRuns={viewModel.payrollRegisterRuns}
      totals={viewModel.totals}
      rows={viewModel.rows}
      trialRows={viewModel.trialRows}
      birRows={viewModel.birRows}
      trialBirRows={viewModel.trialBirRows}
      doleRows={viewModel.doleRows}
      trialDoleRows={viewModel.trialDoleRows}
    />
  )
}
