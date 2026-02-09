import Link from "next/link"
import { redirect } from "next/navigation"
import { IconDownload, IconFileInvoice } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { getPayrollPayslipDetailViewModel } from "@/modules/payroll/utils/get-payroll-payslip-detail-view-model"

type PayrollPayslipDetailPageProps = {
  params: Promise<{ companyId: string; payslipId: string }>
}

export default async function PayrollPayslipDetailPage({ params }: PayrollPayslipDetailPageProps) {
  const { companyId, payslipId } = await params

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

  const viewModel = await getPayrollPayslipDetailViewModel(company.companyId, payslipId)
  if (!viewModel) {
    redirect(`/${company.companyId}/payroll/payslips`)
  }

  const { payslip } = viewModel
  const supplementalEarnings = payslip.earnings.filter((entry) => !/basic\s*pay/i.test(entry.description))

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground">
              <IconFileInvoice className="size-5" />
              Payslip {payslip.payslipNumber}
            </h1>
            <p className="text-xs text-muted-foreground">
              {payslip.employeeName} ({payslip.employeeNumber}) • Run {payslip.runNumber} • {payslip.periodLabel}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/${viewModel.companyId}/payroll/payslips`}>Back to Payslips History</Link>
            </Button>
            <Button asChild className="bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600">
              <Link href={`/${viewModel.companyId}/payroll/payslips/${payslip.id}/download`} className="inline-flex items-center gap-1.5">
                <IconDownload className="size-4" />
                Download PDF
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="space-y-4">
          <div className="grid gap-4 border-b border-border/60 pb-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Employee</p>
              <p className="text-sm font-semibold text-foreground">{payslip.employeeName}</p>
              <p className="text-xs text-muted-foreground">Employee No: {payslip.employeeNumber}</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pay Period</p>
              <p className="text-sm font-semibold text-foreground">{payslip.periodLabel}</p>
              <p className="text-xs text-muted-foreground">Run: {payslip.runNumber}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-border/60 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Earnings</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">Basic Pay</span>
                  <span className="font-medium">{payslip.semiMonthlyBase}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">Gross Pay</span>
                  <span className="font-medium">{payslip.basicPay}</span>
                </div>
                {supplementalEarnings.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{entry.description}</span>
                    <span>{entry.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border/60 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deductions</p>
              <div className="space-y-1.5">
                {payslip.deductions.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{entry.description}</span>
                    <span>{entry.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border border-border/60 p-3 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between border-b border-border/60 pb-2 sm:border-b-0 sm:border-r sm:pr-3 sm:pb-0">
              <span className="font-medium">Total Gross Pay</span>
              <span className="font-semibold">{payslip.grossPay}</span>
            </div>
            <div className="flex items-center justify-between sm:pl-3">
              <span className="font-medium">Total Deductions</span>
              <span className="font-semibold">{payslip.totalDeductions}</span>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border border-border/60 bg-muted/30 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div><p className="text-[11px] text-muted-foreground">Days Worked</p><p className="font-medium">{payslip.daysWorked}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Days Absent</p><p className="font-medium">{payslip.daysAbsent}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Overtime Hours</p><p className="font-medium">{payslip.overtimeHours}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Night Diff Hours</p><p className="font-medium">{payslip.nightDiffHours}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Tardiness Minutes</p><p className="font-medium">{payslip.tardinessMins}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Undertime Minutes</p><p className="font-medium">{payslip.undertimeMins}</p></div>
          </div>

          <div className="rounded-md border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-primary">Net Disbursement</p>
              <p className="text-xl font-bold text-primary">{payslip.netPay}</p>
            </div>
          </div>
      </section>
    </main>
  )
}
