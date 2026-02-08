import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { PayrollRunsListClient } from "@/modules/payroll/components/payroll-runs-list-client"
import { getCreatePayrollRunViewModel } from "@/modules/payroll/utils/get-create-payroll-run-view-model"
import { getPayrollRunsViewModel } from "@/modules/payroll/utils/get-payroll-runs-view-model"

type PayrollRunsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function PayrollRunsPage({ params }: PayrollRunsPageProps) {
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

  const [viewModel, createViewModel] = await Promise.all([
    getPayrollRunsViewModel(company.companyId),
    getCreatePayrollRunViewModel(company.companyId),
  ])

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{viewModel.companyName} Payroll Runs</h1>
            <p className="text-xs text-muted-foreground">Cycle history and payroll workflow progress.</p>
          </div>
        </div>
      </header>

      <PayrollRunsListClient
        companyId={viewModel.companyId}
        runs={viewModel.runs}
        createOptions={{
          payPeriods: createViewModel.payPeriods,
          defaultPayPeriodId: createViewModel.defaultPayPeriodId,
          runTypes: createViewModel.runTypes,
          departments: createViewModel.departments,
          branches: createViewModel.branches,
        }}
      />
    </main>
  )
}
