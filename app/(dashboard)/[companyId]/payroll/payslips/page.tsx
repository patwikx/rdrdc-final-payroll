import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { PayrollPayslipsPageClient } from "@/modules/payroll/components/payroll-payslips-page-client"
import { getPayrollPayslipsViewModel } from "@/modules/payroll/utils/get-payroll-payslips-view-model"

type PayrollPayslipsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function PayrollPayslipsPage({ params }: PayrollPayslipsPageProps) {
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

  const viewModel = await getPayrollPayslipsViewModel(company.companyId)

  return (
    <PayrollPayslipsPageClient
      companyId={viewModel.companyId}
      companyName={viewModel.companyName}
      defaultStartDate={viewModel.defaultStartDate}
      defaultEndDate={viewModel.defaultEndDate}
      pageSize={viewModel.pageSize}
    />
  )
}
