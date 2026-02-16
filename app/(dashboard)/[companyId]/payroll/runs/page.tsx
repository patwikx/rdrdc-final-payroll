import { redirect } from "next/navigation"
import { IconBuildingBank, IconCalendarDollar } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
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
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Payroll Operations</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              <IconCalendarDollar className="size-6 text-primary" />
              Payroll Runs
            </h1>
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              <IconBuildingBank className="mr-1 size-3.5" />
              {viewModel.companyName}
            </Badge>
            <Badge variant="secondary" className="h-6 px-2 text-[11px]">
              {viewModel.runs.length} Cycles
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Cycle history and payroll workflow progress.</p>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6">
        <PayrollRunsListClient
          companyId={viewModel.companyId}
          runs={viewModel.runs}
          createOptions={{
            payPeriods: createViewModel.payPeriods,
            defaultPayPeriodId: createViewModel.defaultPayPeriodId,
            runTypes: createViewModel.runTypes,
            departments: createViewModel.departments,
            branches: createViewModel.branches,
            employees: createViewModel.employees,
          }}
        />
      </div>
    </main>
  )
}
