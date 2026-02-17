"use client"

import { Fragment, useMemo } from "react"
import Link from "next/link"

import { IconArrowLeft, IconFileDownload, IconPrinter } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import type {
  PayrollRegisterDynamicColumn,
  PayrollRegisterReportData,
  PayrollRegisterTotals,
  PayslipRegisterRow,
} from "@/modules/payroll/utils/build-payroll-register-csv"

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

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const fixedLegendItems = [
  "BAS - Basic Salary",
  "SSS - SSS Contribution",
  "PHI - PhilHealth",
  "HDMF - Pag-IBIG",
  "TAX - Withholding Tax",
  "SSSL - SSS Loan",
  "ABS - Absent",
  "LTE - Late",
  "UT - Undertime",
  "+ EARN TOTAL - Total Dynamic Earnings",
  "- DED TOTAL - Total Dynamic Deductions",
  "NET - Net Pay",
]

const getDynamicAmount = (row: PayslipRegisterRow, column: PayrollRegisterDynamicColumn): number => {
  return row.dynamicAmountsByKey[column.key] ?? 0
}

const getDynamicTotal = (totals: PayrollRegisterTotals, column: PayrollRegisterDynamicColumn): number => {
  return totals.dynamicAmountsByKey[column.key] ?? 0
}

const toDynamicColumnHeader = (
  sign: "+" | "-",
  column: PayrollRegisterDynamicColumn
): string => `${sign} ${column.headerLabel}`

const buildHeaderCells = (columns: PayrollRegisterDynamicColumn[]): string[] => {
  const earningColumns = columns.filter((column) => column.category === "EARNING")
  const deductionColumns = columns.filter((column) => column.category === "DEDUCTION")

  return [
    "Emp ID",
    "Employee Name",
    "Period Date",
    "BAS",
    "SSS",
    "PHI",
    "HDMF",
    "TAX",
    "SSSL",
    "ABS",
    "LTE",
    "UT",
    ...earningColumns.map((column) => toDynamicColumnHeader("+", column)),
    "+ EARN TOTAL",
    ...deductionColumns.map((column) => toDynamicColumnHeader("-", column)),
    "- DED TOTAL",
    "NET",
  ]
}

const toLegendItems = (columns: PayrollRegisterDynamicColumn[]): string[] => {
  const dynamic = columns.map((column) => {
    const sign = column.category === "EARNING" ? "+" : "-"
    return `${toDynamicColumnHeader(sign, column)} - ${column.label}`
  })

  return [...fixedLegendItems, ...dynamic]
}

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
  const earningColumns = useMemo(
    () => report.columns.filter((column) => column.category === "EARNING"),
    [report.columns]
  )
  const deductionColumns = useMemo(
    () => report.columns.filter((column) => column.category === "DEDUCTION"),
    [report.columns]
  )

  const headerCells = useMemo(() => buildHeaderCells(report.columns), [report.columns])
  const legendItems = useMemo(() => toLegendItems(report.columns), [report.columns])

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const totalColumnCount = headerCells.length

    const tableRows = report.departments
      .map((department) => {
        const employeeRows = department.employees
          .map((row) => {
            const rowCells = [
              row.employeeNumber,
              row.employeeName,
              `${toDateLabel(row.periodStart)}-${toDateLabel(row.periodEnd)}`,
              toAmount(row.basicPay),
              toAmount(row.sss),
              toAmount(row.philHealth),
              toAmount(row.pagIbig),
              toAmount(row.tax),
              toAmount(row.sssLoan),
              toAmount(row.absent),
              toAmount(row.late),
              toAmount(row.undertime),
              ...earningColumns.map((column) => toAmount(getDynamicAmount(row, column))),
              toAmount(row.dynamicEarningsTotal),
              ...deductionColumns.map((column) => toAmount(getDynamicAmount(row, column))),
              toAmount(row.dynamicDeductionsTotal),
              toAmount(row.netPay),
            ]

            return `
            <tr>
              <td>${escapeHtml(rowCells[0] ?? "")}</td>
              <td class=\"text-left\">${escapeHtml(rowCells[1] ?? "")}</td>
              <td class=\"text-left\">${escapeHtml(rowCells[2] ?? "")}</td>
              ${rowCells
                .slice(3)
                .map((value) => `<td>${escapeHtml(value)}</td>`)
                .join("")}
            </tr>`
          })
          .join("")

        const subtotal = department.subtotal
        const subtotalCells = [
          toAmount(subtotal.basicPay),
          toAmount(subtotal.sss),
          toAmount(subtotal.philHealth),
          toAmount(subtotal.pagIbig),
          toAmount(subtotal.tax),
          toAmount(subtotal.sssLoan),
          toAmount(subtotal.absent),
          toAmount(subtotal.late),
          toAmount(subtotal.undertime),
          ...earningColumns.map((column) => toAmount(getDynamicTotal(subtotal, column))),
          toAmount(subtotal.dynamicEarningsTotal),
          ...deductionColumns.map((column) => toAmount(getDynamicTotal(subtotal, column))),
          toAmount(subtotal.dynamicDeductionsTotal),
          toAmount(subtotal.netPay),
        ]

        return `
          <tr class=\"dept\"><td colspan=\"${totalColumnCount}\" class=\"text-left\">DEPARTMENT: ${escapeHtml(department.name)}</td></tr>
          ${employeeRows}
          <tr class=\"subtotal\">
            <td colspan=\"2\" class=\"text-left\">SUB-TOTAL: ${escapeHtml(department.name)}</td>
            <td class=\"text-center\">HC:${department.employees.length}</td>
            ${subtotalCells.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}
          </tr>
        `
      })
      .join("")

    const grand = report.grandTotal
    const grandCells = [
      toAmount(grand.basicPay),
      toAmount(grand.sss),
      toAmount(grand.philHealth),
      toAmount(grand.pagIbig),
      toAmount(grand.tax),
      toAmount(grand.sssLoan),
      toAmount(grand.absent),
      toAmount(grand.late),
      toAmount(grand.undertime),
      ...earningColumns.map((column) => toAmount(getDynamicTotal(grand, column))),
      toAmount(grand.dynamicEarningsTotal),
      ...deductionColumns.map((column) => toAmount(getDynamicTotal(grand, column))),
      toAmount(grand.dynamicDeductionsTotal),
      toAmount(grand.netPay),
    ]

    const legendHtml = legendItems.map((item) => `<div>${escapeHtml(item)}</div>`).join("")

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
            <h1>${escapeHtml(companyName)}</h1>
            <p>PAYROLL REGISTER (${escapeHtml(runTypeCode)})</p>
            <p>PAY PERIOD: ${escapeHtml(periodLabel)}</p>
            <p>GENERATED: ${escapeHtml(generatedAt)}</p>
          </div>
          <table>
            <thead>
              <tr>
                ${headerCells.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              <tr class="grand">
                <td colspan="2" class="text-left">GRAND TOTAL</td>
                <td class="text-center">HC:${report.headcount}</td>
                ${grandCells.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}
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
                {headerCells.map((header) => (
                  <th
                    key={header}
                    className={`border border-border px-2 py-1 ${
                      header === "Emp ID" || header === "Employee Name" || header === "Period Date"
                        ? "text-left"
                        : "text-right"
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.departments.map((department) => (
                <Fragment key={department.name}>
                  <tr className="bg-muted/30">
                    <td colSpan={headerCells.length} className="border border-border px-2 py-1 text-left font-semibold">
                      DEPARTMENT: {department.name}
                    </td>
                  </tr>
                  {department.employees.map((row) => (
                    <tr key={`${department.name}-${row.employeeNumber}-${row.employeeName}`}>
                      <td className="border border-border px-2 py-1">{row.employeeNumber}</td>
                      <td className="border border-border px-2 py-1">{row.employeeName}</td>
                      <td className="border border-border px-2 py-1">
                        {toDateLabel(row.periodStart)}-{toDateLabel(row.periodEnd)}
                      </td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.basicPay)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.sss)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.philHealth)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.pagIbig)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.tax)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.sssLoan)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.absent)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.late)}</td>
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.undertime)}</td>
                      {earningColumns.map((column) => (
                        <td key={`${row.employeeNumber}-${column.key}`} className="border border-border px-2 py-1 text-right">
                          {toAmount(getDynamicAmount(row, column))}
                        </td>
                      ))}
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.dynamicEarningsTotal)}</td>
                      {deductionColumns.map((column) => (
                        <td key={`${row.employeeNumber}-${column.key}`} className="border border-border px-2 py-1 text-right">
                          {toAmount(getDynamicAmount(row, column))}
                        </td>
                      ))}
                      <td className="border border-border px-2 py-1 text-right">{toAmount(row.dynamicDeductionsTotal)}</td>
                      <td className="border border-border px-2 py-1 text-right font-semibold">{toAmount(row.netPay)}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/40 font-semibold">
                    <td colSpan={2} className="border border-border px-2 py-1">SUB-TOTAL: {department.name}</td>
                    <td className="border border-border px-2 py-1 text-center">HC:{department.employees.length}</td>
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.basicPay)}</td>
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.sss)}</td>
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.philHealth)}</td>
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.pagIbig)}</td>
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.tax)}</td>
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.sssLoan)}</td>
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.absent)}</td>
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.late)}</td>
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.undertime)}</td>
                    {earningColumns.map((column) => (
                      <td key={`${department.name}-subtotal-${column.key}`} className="border border-border px-2 py-1 text-right">
                        {toAmount(getDynamicTotal(department.subtotal, column))}
                      </td>
                    ))}
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.dynamicEarningsTotal)}</td>
                    {deductionColumns.map((column) => (
                      <td key={`${department.name}-subtotal-${column.key}`} className="border border-border px-2 py-1 text-right">
                        {toAmount(getDynamicTotal(department.subtotal, column))}
                      </td>
                    ))}
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.dynamicDeductionsTotal)}</td>
                    <td className="border border-border px-2 py-1 text-right">{toAmount(department.subtotal.netPay)}</td>
                  </tr>
                </Fragment>
              ))}

              <tr className="bg-primary/10 font-semibold">
                <td colSpan={2} className="border border-border px-2 py-1">GRAND TOTAL</td>
                <td className="border border-border px-2 py-1 text-center">HC:{report.headcount}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.basicPay)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.sss)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.philHealth)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.pagIbig)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.tax)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.sssLoan)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.absent)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.late)}</td>
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.undertime)}</td>
                {earningColumns.map((column) => (
                  <td key={`grand-${column.key}`} className="border border-border px-2 py-1 text-right">
                    {toAmount(getDynamicTotal(report.grandTotal, column))}
                  </td>
                ))}
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.dynamicEarningsTotal)}</td>
                {deductionColumns.map((column) => (
                  <td key={`grand-${column.key}`} className="border border-border px-2 py-1 text-right">
                    {toAmount(getDynamicTotal(report.grandTotal, column))}
                  </td>
                ))}
                <td className="border border-border px-2 py-1 text-right">{toAmount(report.grandTotal.dynamicDeductionsTotal)}</td>
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
