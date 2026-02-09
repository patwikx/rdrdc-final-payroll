"use client"

import Link from "next/link"
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

type LeaveBalanceSummaryReportClientProps = {
  companyId: string
  companyName: string
  year: number
  generatedAtLabel: string
  leaveTypeColumns: string[]
  rows: Array<{
    employeeNumber: string
    employeeName: string
    departmentName: string
    leaveBalances: Record<string, number>
  }>
}

const valueFormat = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function LeaveBalanceSummaryReportClient({
  companyId,
  companyName,
  year,
  generatedAtLabel,
  leaveTypeColumns,
  rows,
}: LeaveBalanceSummaryReportClientProps) {
  const totals = leaveTypeColumns.reduce<Record<string, number>>((acc, leaveType) => {
    acc[leaveType] = rows.reduce((sum, row) => sum + (row.leaveBalances[leaveType] ?? 0), 0)
    return acc
  }, {})

  return (
    <>
      <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
        <header className="border-b border-border/60 pb-3 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Leave Balance Summary Report</h1>
              <p className="text-xs text-muted-foreground">{companyName} • Year {year} • Generated: {generatedAtLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild type="button" variant="outline">
                <Link href={`/${companyId}/leave/balances?year=${year}`}>
                  <IconArrowLeft className="mr-1.5 h-4 w-4" /> Back to Leave Balance
                </Link>
              </Button>
              <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => window.print()}>
                <IconPrinter className="mr-1.5 h-4 w-4" /> Print Report
              </Button>
            </div>
          </div>
        </header>

        <section id="leave-balance-report-root" className="rounded-lg border border-border/60 bg-background print:border-0 print:rounded-none">
          <div className="px-4 pt-4 text-center">
            <h2 className="text-base font-semibold text-foreground">{companyName}</h2>
            <p className="text-xs text-muted-foreground">LEAVE BALANCE SUMMARY REPORT</p>
            <p className="text-xs text-muted-foreground">YEAR {year}</p>
          </div>

          <div className="overflow-x-auto px-4 py-4">
            <table className="w-full border-collapse text-[11px]">
              <thead className="bg-muted/40">
                <tr>
                  <th className="border border-border px-2 py-1 text-left">Employee ID</th>
                  <th className="border border-border px-2 py-1 text-left">Employee Name</th>
                  <th className="border border-border px-2 py-1 text-left">Department</th>
                  {leaveTypeColumns.map((leaveType) => (
                    <th key={leaveType} className="border border-border px-2 py-1 text-right">{leaveType}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3 + Math.max(leaveTypeColumns.length, 1)} className="border border-border px-2 py-8 text-center text-muted-foreground">
                      No leave balance records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.employeeNumber}>
                      <td className="border border-border px-2 py-1">{row.employeeNumber}</td>
                      <td className="border border-border px-2 py-1">{row.employeeName}</td>
                      <td className="border border-border px-2 py-1">{row.departmentName}</td>
                      {leaveTypeColumns.map((leaveType) => (
                        <td key={`${row.employeeNumber}-${leaveType}`} className="border border-border px-2 py-1 text-right font-semibold">
                          {valueFormat.format(row.leaveBalances[leaveType] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}

                <tr className="bg-primary/10 font-semibold">
                  <td colSpan={3} className="border border-border px-2 py-1">TOTAL</td>
                  {leaveTypeColumns.map((leaveType) => (
                    <td key={`total-${leaveType}`} className="border border-border px-2 py-1 text-right">
                      {valueFormat.format(totals[leaveType] ?? 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }

          #leave-balance-report-root,
          #leave-balance-report-root * {
            visibility: visible;
          }

          #leave-balance-report-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            background: #fff;
          }
        }
      `}</style>
    </>
  )
}
