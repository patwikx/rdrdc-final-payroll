import Link from "next/link"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Payslip {payslip.payslipNumber}</h1>
            <p className="text-xs text-muted-foreground">
              {payslip.employeeName} ({payslip.employeeNumber}) • Run {payslip.runNumber} • {payslip.periodLabel}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/${viewModel.companyId}/payroll/payslips?runId=${payslip.runId}`}>Back to Payslips</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${viewModel.companyId}/payroll/payslips/${payslip.id}/download`}>Download PDF</Link>
            </Button>
            <Button asChild>
              <Link href={`/${viewModel.companyId}/payroll/adjustments?runId=${payslip.runId}`}>Open Adjustments</Link>
            </Button>
          </div>
        </div>
      </header>

      <Card className="rounded-xl border border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Totals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Basic Pay</p><p className="font-medium">{payslip.basicPay}</p></div>
          <div><p className="text-xs text-muted-foreground">Gross Pay</p><p className="font-medium">{payslip.grossPay}</p></div>
          <div><p className="text-xs text-muted-foreground">Total Deductions</p><p className="font-medium">{payslip.totalDeductions}</p></div>
          <div><p className="text-xs text-muted-foreground">Net Pay</p><p className="font-semibold text-primary">{payslip.netPay}</p></div>
          <div><p className="text-xs text-muted-foreground">Days Worked</p><p className="font-medium">{payslip.daysWorked}</p></div>
          <div><p className="text-xs text-muted-foreground">Days Absent</p><p className="font-medium">{payslip.daysAbsent}</p></div>
          <div><p className="text-xs text-muted-foreground">OT Hours</p><p className="font-medium">{payslip.overtimeHours}</p></div>
          <div><p className="text-xs text-muted-foreground">Night Diff Hours</p><p className="font-medium">{payslip.nightDiffHours}</p></div>
          <div><p className="text-xs text-muted-foreground">Tardiness Mins</p><p className="font-medium">{payslip.tardinessMins}</p></div>
          <div><p className="text-xs text-muted-foreground">Undertime Mins</p><p className="font-medium">{payslip.undertimeMins}</p></div>
          <div><p className="text-xs text-muted-foreground">SSS</p><p className="font-medium">{payslip.sssEmployee}</p></div>
          <div><p className="text-xs text-muted-foreground">PhilHealth</p><p className="font-medium">{payslip.philHealthEmployee}</p></div>
          <div><p className="text-xs text-muted-foreground">Pag-IBIG</p><p className="font-medium">{payslip.pagIbigEmployee}</p></div>
          <div><p className="text-xs text-muted-foreground">Withholding Tax</p><p className="font-medium">{payslip.withholdingTax}</p></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl border border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Earnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payslip.earnings.length === 0 ? (
              <p className="text-xs text-muted-foreground">No earnings lines.</p>
            ) : (
              payslip.earnings.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between rounded-md border border-border/50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">{entry.isTaxable ? "Taxable" : "Non-taxable"}</p>
                  </div>
                  <p>{entry.amount}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Deductions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payslip.deductions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No deduction lines.</p>
            ) : (
              payslip.deductions.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between rounded-md border border-border/50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">{entry.referenceType}</p>
                  </div>
                  <p>{entry.amount}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
