"use client"

import { Fragment, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronRight,
  IconReportAnalytics,
  IconSearch,
  IconTrendingUp,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { AdjustPayslipDialog } from "@/modules/payroll/components/adjust-payslip-dialog"
import { completeReviewPayrollRunAction } from "@/modules/payroll/actions/payroll-run-actions"
import { cn } from "@/lib/utils"

type ReviewAdjustStepProps = {
  companyId: string
  runId: string
  payslips: Array<{
    id: string
    employeeName: string
    employeeNumber: string
    grossPay: number
    totalDeductions: number
    netPay: number
    status: string
    earnings: Array<{ id: string; name: string; amount: number }>
    deductionDetails: Array<{ id: string; name: string; amount: number }>
  }>
}

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  currencyDisplay: "code",
})

export function ReviewAdjustStep({ companyId, runId, payslips }: ReviewAdjustStepProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [searchTerm, setSearchTerm] = useState("")
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const isDiscrepancyRecord = (record: ReviewAdjustStepProps["payslips"][number]): boolean => {
    if (record.netPay <= 0) return true
    if (record.grossPay <= 0) return true
    if (record.totalDeductions > record.grossPay) return true
    if (record.grossPay > 0 && record.totalDeductions / record.grossPay > 0.6) return true
    return false
  }

  const discrepancyCount = useMemo(() => payslips.filter(isDiscrepancyRecord).length, [payslips])

  const filteredData = useMemo(() => {
    return payslips.filter((record) => {
      const matchesSearch = `${record.employeeName} ${record.employeeNumber}`.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
  }, [payslips, searchTerm])

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, row) => ({
        gross: acc.gross + row.grossPay,
        deductions: acc.deductions + row.totalDeductions,
        net: acc.net + row.netPay,
      }),
      { gross: 0, deductions: 0, net: 0 }
    )
  }, [filteredData])

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedRows(next)
  }

  const handleContinue = () => {
    if (!reviewConfirmed) {
      toast.error("Please confirm review before continuing.")
      return
    }

    startTransition(async () => {
      const result = await completeReviewPayrollRunAction({ companyId, runId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-9">
        <div className="rounded-lg border border-border/60 bg-card p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-9 pl-9"
                placeholder="Search employee"
              />
            </div>
            <Button asChild type="button" className="h-9 bg-blue-600 text-white hover:bg-blue-700">
              <Link href={`/${companyId}/payroll/runs/${runId}/report`}>
                <IconReportAnalytics className="mr-1.5 h-4 w-4" /> Generate Payroll Register Report
              </Link>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="w-10 px-2 py-2 text-left" />
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Gross</th>
                <th className="px-3 py-2 text-left">Deductions</th>
                <th className="px-3 py-2 text-left">Net</th>
                <th className="px-3 py-2 text-left">State</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No payroll register entries found.
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => {
                  const isExpanded = expandedRows.has(row.id)
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={cn(
                          "cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/30",
                          isExpanded ? "bg-primary/10 hover:bg-primary/10" : ""
                        )}
                        onClick={() => toggleRow(row.id)}
                      >
                        <td className="px-2 py-2">{isExpanded ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{row.employeeName}</p>
                          <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                        </td>
                        <td className="px-3 py-2">{money.format(row.grossPay)}</td>
                        <td className="px-3 py-2">{money.format(row.totalDeductions)}</td>
                        <td className="px-3 py-2 font-semibold">{money.format(row.netPay)}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={isDiscrepancyRecord(row) ? "destructive" : "secondary"}
                            className={cn(
                              !isDiscrepancyRecord(row) && row.status === "READY"
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : ""
                            )}
                          >
                            {isDiscrepancyRecord(row) ? "CHECK" : row.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                          <AdjustPayslipDialog
                            companyId={companyId}
                            payslipId={row.id}
                            employeeName={row.employeeName}
                            onApplied={() => router.refresh()}
                          />
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="border-t border-border/50 bg-primary/5">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid gap-5 md:grid-cols-2">
                              <div>
                                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                  <IconTrendingUp className="h-3.5 w-3.5" /> Earnings Breakdown
                                </p>
                                <div className="space-y-1.5">
                                  {row.earnings.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No additional earnings.</p>
                                  ) : (
                                    row.earnings.map((item) => (
                                      <div key={item.id} className="flex items-center justify-between text-xs">
                                        <span>{item.name}</span>
                                        <span className="font-medium">{money.format(item.amount)}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div>
                                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">
                                  <IconAlertTriangle className="h-3.5 w-3.5" /> Deductions Breakdown
                                </p>
                                <div className="space-y-1.5">
                                  {row.deductionDetails.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No deductions.</p>
                                  ) : (
                                    row.deductionDetails.map((item) => (
                                      <div key={item.id} className="flex items-center justify-between text-xs">
                                        <span>{item.name}</span>
                                        <span className="font-medium">{money.format(item.amount)}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="space-y-4 xl:col-span-3">
        <div className="space-y-4 rounded-lg border border-border/60 bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Run Totals</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span>Total Gross</span><span className="font-semibold">{money.format(totals.gross)}</span></div>
            <div className="flex items-center justify-between"><span>Total Deductions</span><span className="font-semibold">{money.format(totals.deductions)}</span></div>
            <div className="flex items-center justify-between"><span>Net Payable</span><span className="font-semibold text-primary">{money.format(totals.net)}</span></div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Review Guide</h3>
          <p className="text-xs text-foreground/80">Rows marked with a <span className="font-semibold">CHECK</span> badge need manual validation before proceeding.</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-foreground/80">
            <li>Net pay is zero or negative.</li>
            <li>Gross pay is zero or negative.</li>
            <li>Deductions are greater than gross pay.</li>
            <li>Deductions are more than 60% of gross pay.</li>
          </ul>
          <p className="text-xs text-foreground/80">Use <span className="font-semibold">Adjust</span> on the row to correct values, then recheck totals.</p>
        </div>

        <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
          <div className="flex items-start gap-2">
            <Checkbox
              id="review-confirm"
              className="mt-0.5 h-4 w-4 border-primary/60 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
              checked={reviewConfirmed}
              onCheckedChange={(checked) => setReviewConfirmed(checked === true)}
            />
            <label htmlFor="review-confirm" className="text-xs leading-relaxed text-foreground">
              I reviewed payroll totals and discrepancy flags for this run.
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {discrepancyCount > 0
              ? `${discrepancyCount} records are flagged for review.`
              : "No discrepancy flags detected from current checks."}
          </p>
          <Button type="button" className="w-full" disabled={isPending} onClick={handleContinue}>
            Continue to Payslips
          </Button>
        </div>
      </aside>
    </div>
  )
}
