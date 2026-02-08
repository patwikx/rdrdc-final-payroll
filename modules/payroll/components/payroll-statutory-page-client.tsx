"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type PayrollStatutoryPageClientProps = {
  companyId: string
  companyName: string
  selectedRunId: string | null
  runs: Array<{
    id: string
    label: string
    statusCode: string
  }>
  totals: {
    sssEmployee: string
    sssEmployer: string
    philHealthEmployee: string
    philHealthEmployer: string
    pagIbigEmployee: string
    pagIbigEmployer: string
    withholdingTax: string
  }
  rows: Array<{
    payslipId: string
    employeeName: string
    employeeNumber: string
    sssEmployee: string
    sssEmployer: string
    philHealthEmployee: string
    philHealthEmployer: string
    pagIbigEmployee: string
    pagIbigEmployer: string
    withholdingTax: string
  }>
}

export function PayrollStatutoryPageClient({
  companyId,
  companyName,
  selectedRunId,
  runs,
  totals,
  rows,
}: PayrollStatutoryPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleRunChange = (runId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("runId", runId)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{companyName} Statutory Reports</h1>
            <p className="text-xs text-muted-foreground">Run-level statutory deductions summary and employee breakdown.</p>
          </div>
          <div className="w-full sm:w-[500px]">
            <Select value={selectedRunId ?? undefined} onValueChange={handleRunChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select payroll run" />
              </SelectTrigger>
              <SelectContent>
                {runs.map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    {run.label} • {run.statusCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border border-border/70 bg-card/80"><CardHeader><CardTitle className="text-xs">SSS Employee</CardTitle></CardHeader><CardContent><p className="font-semibold">{totals.sssEmployee}</p></CardContent></Card>
        <Card className="rounded-xl border border-border/70 bg-card/80"><CardHeader><CardTitle className="text-xs">SSS Employer</CardTitle></CardHeader><CardContent><p className="font-semibold">{totals.sssEmployer}</p></CardContent></Card>
        <Card className="rounded-xl border border-border/70 bg-card/80"><CardHeader><CardTitle className="text-xs">PhilHealth Employee</CardTitle></CardHeader><CardContent><p className="font-semibold">{totals.philHealthEmployee}</p></CardContent></Card>
        <Card className="rounded-xl border border-border/70 bg-card/80"><CardHeader><CardTitle className="text-xs">PhilHealth Employer</CardTitle></CardHeader><CardContent><p className="font-semibold">{totals.philHealthEmployer}</p></CardContent></Card>
        <Card className="rounded-xl border border-border/70 bg-card/80"><CardHeader><CardTitle className="text-xs">Pag-IBIG Employee</CardTitle></CardHeader><CardContent><p className="font-semibold">{totals.pagIbigEmployee}</p></CardContent></Card>
        <Card className="rounded-xl border border-border/70 bg-card/80"><CardHeader><CardTitle className="text-xs">Pag-IBIG Employer</CardTitle></CardHeader><CardContent><p className="font-semibold">{totals.pagIbigEmployer}</p></CardContent></Card>
        <Card className="rounded-xl border border-border/70 bg-card/80 sm:col-span-2"><CardHeader><CardTitle className="text-xs">Withholding Tax</CardTitle></CardHeader><CardContent><p className="font-semibold">{totals.withholdingTax}</p></CardContent></Card>
      </div>

      <Card className="rounded-xl border border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Employee Statutory Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-left">SSS Emp</th>
                  <th className="px-3 py-2 text-left">SSS Er</th>
                  <th className="px-3 py-2 text-left">PH Emp</th>
                  <th className="px-3 py-2 text-left">PH Er</th>
                  <th className="px-3 py-2 text-left">PI Emp</th>
                  <th className="px-3 py-2 text-left">PI Er</th>
                  <th className="px-3 py-2 text-left">WTAX</th>
                  <th className="px-3 py-2 text-left">Payslip</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={9}>No payslip records for selected run.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.payslipId} className="border-t border-border/50">
                      <td className="px-3 py-2">
                        <p className="font-medium">{row.employeeName}</p>
                        <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                      </td>
                      <td className="px-3 py-2">{row.sssEmployee}</td>
                      <td className="px-3 py-2">{row.sssEmployer}</td>
                      <td className="px-3 py-2">{row.philHealthEmployee}</td>
                      <td className="px-3 py-2">{row.philHealthEmployer}</td>
                      <td className="px-3 py-2">{row.pagIbigEmployee}</td>
                      <td className="px-3 py-2">{row.pagIbigEmployer}</td>
                      <td className="px-3 py-2">{row.withholdingTax}</td>
                      <td className="px-3 py-2">
                        <Link href={`/${companyId}/payroll/payslips/${row.payslipId}`} className="text-primary underline-offset-4 hover:underline">Open</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
