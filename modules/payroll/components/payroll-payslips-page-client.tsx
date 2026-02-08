"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type PayrollPayslipsPageClientProps = {
  companyId: string
  companyName: string
  selectedRunId: string | null
  runs: Array<{
    id: string
    label: string
    statusCode: string
  }>
  payslips: Array<{
    id: string
    payslipNumber: string
    employeeName: string
    employeeNumber: string
    grossPay: string
    totalDeductions: string
    netPay: string
    releasedAt: string
    generatedAt: string
    runNumber: string
  }>
}

export function PayrollPayslipsPageClient({
  companyId,
  companyName,
  selectedRunId,
  runs,
  payslips,
}: PayrollPayslipsPageClientProps) {
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
            <h1 className="text-lg font-semibold text-foreground">{companyName} Payslips</h1>
            <p className="text-xs text-muted-foreground">Review generated payslips and open full breakdowns.</p>
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

      <Card className="rounded-xl border border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Payslip List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Payslip #</th>
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-left">Gross</th>
                  <th className="px-3 py-2 text-left">Deductions</th>
                  <th className="px-3 py-2 text-left">Net</th>
                  <th className="px-3 py-2 text-left">Generated</th>
                  <th className="px-3 py-2 text-left">Released</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {payslips.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>
                      No payslips available for the selected run.
                    </td>
                  </tr>
                ) : (
                  payslips.map((payslip) => (
                    <tr key={payslip.id} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium">{payslip.payslipNumber}</td>
                      <td className="px-3 py-2">
                        <p>{payslip.employeeName}</p>
                        <p className="text-[11px] text-muted-foreground">{payslip.employeeNumber}</p>
                      </td>
                      <td className="px-3 py-2">{payslip.grossPay}</td>
                      <td className="px-3 py-2">{payslip.totalDeductions}</td>
                      <td className="px-3 py-2 font-medium">{payslip.netPay}</td>
                      <td className="px-3 py-2">{payslip.generatedAt}</td>
                      <td className="px-3 py-2">{payslip.releasedAt}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/${companyId}/payroll/payslips/${payslip.id}`}>View</Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/${companyId}/payroll/payslips/${payslip.id}/download`}>Download</Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={
                                selectedRunId
                                  ? `/${companyId}/payroll/adjustments?runId=${selectedRunId}`
                                  : `/${companyId}/payroll/adjustments`
                              }
                            >
                              Adjust
                            </Link>
                          </Button>
                        </div>
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
