"use client"

import { Fragment } from "react"
import Link from "next/link"

import { IconArrowLeft, IconFileDownload, IconPrinter } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import type { PayrollRegisterReportData } from "@/modules/payroll/utils/build-payroll-register-csv"

type PayrollRegisterPreviewClientProps = {
  companyId: string
  runId: string
  runNumber: string
  runTypeCode: string
  companyName: string
  periodLabel: string
  generatedAt: string
  report: PayrollRegisterReportData
}

const amount = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toAmount = (value: number): string => amount.format(value)

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

const legendItems = [
  "BAS - Basic Salary",
  "SSS - SSS Contribution",
  "PHI - PhilHealth",
  "HDMF - Pag-IBIG",
  "TAX - Withholding Tax",
  "SSSL - SSS Loan",
  "ALW - Allowance",
  "OTH - Other Deductions",
  "ABS - Absent",
  "LTE - Late",
  "UT - Undertime",
  "NET - Net Pay",
]

export function PayrollRegisterPreviewClient({
  companyId,
  runId,
  runNumber,
  runTypeCode,
  companyName,
  periodLabel,
  generatedAt,
  report,
}: PayrollRegisterPreviewClientProps) {
  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const tableRows = report.departments
      .map((department) => {
        const subtotal = department.employees.reduce(
          (acc, row) => ({
            basicPay: acc.basicPay + row.basicPay,
            sss: acc.sss + row.sss,
            philHealth: acc.philHealth + row.philHealth,
            pagIbig: acc.pagIbig + row.pagIbig,
            tax: acc.tax + row.tax,
            sssLoan: acc.sssLoan + row.sssLoan,
            allowance: acc.allowance + row.allowance,
            otherDeductions: acc.otherDeductions + row.otherDeductions,
            absent: acc.absent + row.absent,
            late: acc.late + row.late,
            undertime: acc.undertime + row.undertime,
            netPay: acc.netPay + row.netPay,
          }),
          {
            basicPay: 0,
            sss: 0,
            philHealth: 0,
            pagIbig: 0,
            tax: 0,
            sssLoan: 0,
            allowance: 0,
            otherDeductions: 0,
            absent: 0,
            late: 0,
            undertime: 0,
            netPay: 0,
          }
        )

        const employeeRows = department.employees
          .map(
            (row) => `
            <tr>
              <td>${row.employeeNumber}</td>
              <td class="text-left">${row.employeeName}</td>
              <td class="text-left">${toDateLabel(row.periodStart)}-${toDateLabel(row.periodEnd)}</td>
              <td>${toAmount(row.basicPay)}</td>
              <td>${toAmount(row.sss)}</td>
              <td>${toAmount(row.philHealth)}</td>
              <td>${toAmount(row.pagIbig)}</td>
              <td>${toAmount(row.tax)}</td>
              <td>${toAmount(row.sssLoan)}</td>
              <td>${toAmount(row.allowance)}</td>
              <td>${toAmount(row.otherDeductions)}</td>
              <td>${toAmount(row.absent)}</td>
              <td>${toAmount(row.late)}</td>
              <td>${toAmount(row.undertime)}</td>
              <td>${toAmount(row.netPay)}</td>
            </tr>`
          )
          .join("")

        return `
          <tr class="dept"><td colspan="15" class="text-left">DEPARTMENT: ${department.name}</td></tr>
          ${employeeRows}
          <tr class="subtotal">
            <td colspan="2" class="text-left">SUB-TOTAL: ${department.name}</td>
            <td class="text-center">HC:${department.employees.length}</td>
            <td>${toAmount(subtotal.basicPay)}</td>
            <td>${toAmount(subtotal.sss)}</td>
            <td>${toAmount(subtotal.philHealth)}</td>
            <td>${toAmount(subtotal.pagIbig)}</td>
            <td>${toAmount(subtotal.tax)}</td>
            <td>${toAmount(subtotal.sssLoan)}</td>
            <td>${toAmount(subtotal.allowance)}</td>
            <td>${toAmount(subtotal.otherDeductions)}</td>
            <td>${toAmount(subtotal.absent)}</td>
            <td>${toAmount(subtotal.late)}</td>
            <td>${toAmount(subtotal.undertime)}</td>
            <td>${toAmount(subtotal.netPay)}</td>
          </tr>
        `
      })
      .join("")

    const legendHtml = legendItems
      .map((item) => `<div>${item}</div>`)
      .join("")

    printWindow.document.write(`
      <html>
        <head>
          <title>Payroll Register</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 7pt; color: #000; margin: 8mm; }
            .header { text-align: center; margin-bottom: 8px; }
            .header h1 { margin: 0; font-size: 11pt; }
            .header p { margin: 2px 0; font-size: 8pt; }
            table { width: 100%; border-collapse: collapse; font-size: 6.8pt; }
            th, td { border: 1px solid #000; padding: 2px 3px; text-align: right; }
            th { text-align: center; font-weight: 700; }
            .text-left { text-align: left !important; }
            .text-center { text-align: center !important; }
            .dept td { font-weight: 700; background: #f5f5f5; }
            .subtotal td { font-weight: 700; background: #fafafa; }
            .grand td { font-weight: 700; border-top: 2px solid #000; }
            .legend { margin-top: 12px; font-size: 6.8pt; }
            .legend-title { font-weight: 700; margin-bottom: 4px; }
            .legend-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px 8px; }
            @page { size: landscape; margin: 6mm; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${companyName}</h1>
            <p>PAYROLL REGISTER (${runTypeCode})</p>
            <p>PAY PERIOD: ${periodLabel}</p>
            <p>GENERATED: ${generatedAt}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Employee Name</th>
                <th>Period Date</th>
                <th>BAS</th>
                <th>SSS</th>
                <th>PHI</th>
                <th>HDMF</th>
                <th>TAX</th>
                <th>SSSL</th>
                <th>ALW</th>
                <th>OTH</th>
                <th>ABS</th>
                <th>LTE</th>
                <th>UT</th>
                <th>NET</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              <tr class="grand">
                <td colspan="2" class="text-left">GRAND TOTAL</td>
                <td class="text-center">HC:${report.headcount}</td>
                <td>${toAmount(report.grandTotal.basicPay)}</td>
                <td>${toAmount(report.grandTotal.sss)}</td>
                <td>${toAmount(report.grandTotal.philHealth)}</td>
                <td>${toAmount(report.grandTotal.pagIbig)}</td>
                <td>${toAmount(report.grandTotal.tax)}</td>
                <td>${toAmount(report.grandTotal.sssLoan)}</td>
                <td>${toAmount(report.grandTotal.allowance)}</td>
                <td>${toAmount(report.grandTotal.otherDeductions)}</td>
                <td>${toAmount(report.grandTotal.absent)}</td>
                <td>${toAmount(report.grandTotal.late)}</td>
                <td>${toAmount(report.grandTotal.undertime)}</td>
                <td>${toAmount(report.grandTotal.netPay)}</td>
              </tr>
            </tbody>
          </table>
          <div class="legend">
            <div class="legend-title">LEGEND:</div>
            <div class="legend-grid">${legendHtml}</div>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="print:hidden border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Payroll Register</h1>
            <p className="text-xs text-muted-foreground">{companyName} • {runTypeCode} • Run {runNumber}</p>
            <p className="text-xs text-muted-foreground">Pay Period: {periodLabel} • Generated: {generatedAt}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild type="button" variant="outline">
              <Link href={`/${companyId}/payroll/runs/${runId}`}>
                <IconArrowLeft className="mr-1.5 h-4 w-4" /> Back to Review
              </Link>
            </Button>
            <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={handlePrint}>
              <IconPrinter className="mr-1.5 h-4 w-4" /> Print
            </Button>
            <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href={`/${companyId}/payroll/runs/${runId}/report/export`}>
                <IconFileDownload className="mr-1.5 h-4 w-4" /> Export CSV
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-border/60 bg-background print:border-0 print:rounded-none">
        <div className="hidden print:block text-center pb-2">
          <h1 className="text-base font-semibold">{companyName}</h1>
          <p className="text-xs">PAYROLL REGISTER ({runTypeCode})</p>
          <p className="text-xs">PAY PERIOD: {periodLabel}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead className="bg-muted/40">
              <tr>
                <th className="border border-border px-2 py-1 text-left">Emp ID</th>
                <th className="border border-border px-2 py-1 text-left">Employee Name</th>
                <th className="border border-border px-2 py-1 text-left">Period Date</th>
                <th className="border border-border px-2 py-1 text-right">BAS</th>
                <th className="border border-border px-2 py-1 text-right">SSS</th>
                <th className="border border-border px-2 py-1 text-right">PHI</th>
                <th className="border border-border px-2 py-1 text-right">HDMF</th>
                <th className="border border-border px-2 py-1 text-right">TAX</th>
                <th className="border border-border px-2 py-1 text-right">SSSL</th>
                <th className="border border-border px-2 py-1 text-right">ALW</th>
                <th className="border border-border px-2 py-1 text-right">OTH</th>
                <th className="border border-border px-2 py-1 text-right">ABS</th>
                <th className="border border-border px-2 py-1 text-right">LTE</th>
                <th className="border border-border px-2 py-1 text-right">UT</th>
                <th className="border border-border px-2 py-1 text-right">NET</th>
              </tr>
            </thead>
            <tbody>
              {report.departments.map((department) => {
                const subtotal = department.employees.reduce(
                  (acc, row) => ({
                    basicPay: acc.basicPay + row.basicPay,
                    sss: acc.sss + row.sss,
                    philHealth: acc.philHealth + row.philHealth,
                    pagIbig: acc.pagIbig + row.pagIbig,
                    tax: acc.tax + row.tax,
                    sssLoan: acc.sssLoan + row.sssLoan,
                    allowance: acc.allowance + row.allowance,
                    otherDeductions: acc.otherDeductions + row.otherDeductions,
                    absent: acc.absent + row.absent,
                    late: acc.late + row.late,
                    undertime: acc.undertime + row.undertime,
                    netPay: acc.netPay + row.netPay,
                  }),
                  {
                    basicPay: 0,
                    sss: 0,
                    philHealth: 0,
                    pagIbig: 0,
                    tax: 0,
                    sssLoan: 0,
                    allowance: 0,
                    otherDeductions: 0,
                    absent: 0,
                    late: 0,
                    undertime: 0,
                    netPay: 0,
                  }
                )

                return (
                  <Fragment key={department.name}>
                    <tr key={`dept-${department.name}`} className="bg-muted/30">
                      <td colSpan={15} className="border border-border px-2 py-1 text-left font-semibold">DEPARTMENT: {department.name}</td>
                    </tr>
                    {department.employees.map((row) => (
                      <tr key={`${department.name}-${row.employeeNumber}`}>
                        <td className="border border-border px-2 py-1">{row.employeeNumber}</td>
                        <td className="border border-border px-2 py-1">{row.employeeName}</td>
                        <td className="border border-border px-2 py-1">{row.periodStart.toLocaleDateString("en-US", { timeZone: "Asia/Manila" })}-{row.periodEnd.toLocaleDateString("en-US", { timeZone: "Asia/Manila" })}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.basicPay)}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.sss)}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.philHealth)}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.pagIbig)}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.tax)}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.sssLoan)}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.allowance)}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.otherDeductions)}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.absent)}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.late)}</td>
                        <td className="border border-border px-2 py-1 text-right">{toAmount(row.undertime)}</td>
                        <td className="border border-border px-2 py-1 text-right font-semibold">{toAmount(row.netPay)}</td>
                      </tr>
                    ))}
                    <tr key={`subtotal-${department.name}`} className="bg-muted/40 font-semibold">
                      <td colSpan={2} className="border border-border px-2 py-1">SUB-TOTAL: {department.name}</td>
                      <td className="border border-border px-2 py-1 text-center">HC:{department.employees.length}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.basicPay)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.sss)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.philHealth)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.pagIbig)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.tax)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.sssLoan)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.allowance)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.otherDeductions)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.absent)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.late)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.undertime)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(subtotal.netPay)}</td>
                    </tr>
                  </Fragment>
                )
              })}

              <tr className="bg-primary/10 font-semibold">
                <td colSpan={2} className="border border-border px-2 py-1">GRAND TOTAL</td>
                <td className="border border-border px-2 py-1 text-center">HC:{report.headcount}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.basicPay)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.sss)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.philHealth)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.pagIbig)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.tax)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.sssLoan)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.allowance)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.otherDeductions)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.absent)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.late)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.undertime)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.netPay)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-t border-border/60 bg-muted/30 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground">LEGEND</p>
          <div className="grid gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {legendItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
