import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { PayrollRunDetailClient } from "@/modules/payroll/components/payroll-run-detail-client"
import { getPayrollRunDetailViewModel } from "@/modules/payroll/utils/get-payroll-run-detail-view-model"

type PayrollRunDetailPageProps = {
  params: Promise<{ companyId: string; runId: string }>
}

export default async function PayrollRunDetailPage({ params }: PayrollRunDetailPageProps) {
  const { companyId, runId } = await params

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

  const viewModel = await getPayrollRunDetailViewModel(company.companyId, runId)
  if (!viewModel) {
    redirect(`/${company.companyId}/payroll/runs`)
  }

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <PayrollRunDetailClient companyId={viewModel.companyId} run={viewModel.run} />
    </main>
  )
}
