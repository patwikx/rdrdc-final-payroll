import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { PayrollAdjustmentsPageClient } from "@/modules/payroll/components/payroll-adjustments-page-client"
import { getPayrollAdjustmentsViewModel } from "@/modules/payroll/utils/get-payroll-adjustments-view-model"

type PayrollAdjustmentsPageProps = {
  params: Promise<{ companyId: string }>
  searchParams: Promise<{ runId?: string }>
}

export default async function PayrollAdjustmentsPage({ params, searchParams }: PayrollAdjustmentsPageProps) {
  const { companyId } = await params
  const { runId } = await searchParams

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

  const viewModel = await getPayrollAdjustmentsViewModel(company.companyId, runId)

  return (
    <PayrollAdjustmentsPageClient
      companyId={viewModel.companyId}
      companyName={viewModel.companyName}
      selectedRunId={viewModel.selectedRunId}
      runs={viewModel.runs}
      payslips={viewModel.payslips}
    />
  )
}
