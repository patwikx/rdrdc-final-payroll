import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { CreatePayrollRunForm } from "@/modules/payroll/components/create-payroll-run-form"
import { getCreatePayrollRunViewModel } from "@/modules/payroll/utils/get-create-payroll-run-view-model"

type PayrollRunCreatePageProps = {
  params: Promise<{ companyId: string }>
}

export default async function PayrollRunCreatePage({ params }: PayrollRunCreatePageProps) {
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

  const viewModel = await getCreatePayrollRunViewModel(company.companyId)

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <h1 className="text-lg font-semibold text-foreground">Create Payroll Run</h1>
        <p className="text-xs text-muted-foreground">Select period, run type, and optional employee scope filters.</p>
      </header>

      <CreatePayrollRunForm
        companyId={viewModel.companyId}
        payPeriods={viewModel.payPeriods}
        defaultPayPeriodId={viewModel.defaultPayPeriodId}
        runTypes={viewModel.runTypes}
        departments={viewModel.departments}
        branches={viewModel.branches}
      />
    </main>
  )
}
