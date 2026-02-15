"use client"

import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronRight,
  IconReportAnalytics,
  IconSearch,
  IconTrendingUp,
} from "@tabler/icons-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

type ReviewPageSize = "10" | "20" | "50"

const parseReviewPage = (value: string | null): number => {
  if (!value) return 1
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return 1
  return parsed
}

const parseReviewPageSize = (value: string | null): ReviewPageSize => {
  if (value === "10" || value === "20" || value === "50") return value
  return "10"
}

export function ReviewAdjustStep({ companyId, runId, payslips }: ReviewAdjustStepProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(() => parseReviewPage(searchParams.get("page")))
  const [pageSize, setPageSize] = useState<ReviewPageSize>(() => parseReviewPageSize(searchParams.get("pageSize")))
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [confirmContinueOpen, setConfirmContinueOpen] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const isDiscrepancyRecord = (record: ReviewAdjustStepProps["payslips"][number]): boolean => {
    const takeHomePay = record.grossPay - record.totalDeductions
    const takeHomeThreshold = record.grossPay * 0.4

    if (record.netPay <= 0) return true
    if (record.grossPay <= 0) return true
    if (record.totalDeductions > record.grossPay) return true
    if (record.grossPay > 0 && takeHomePay < takeHomeThreshold) return true
    return false
  }

  const discrepancyCount = useMemo(() => payslips.filter(isDiscrepancyRecord).length, [payslips])

  const filteredData = useMemo(() => {
    return payslips.filter((record) => {
      const matchesSearch = `${record.employeeName} ${record.employeeNumber}`.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
  }, [payslips, searchTerm])
  const pageSizeNumber = useMemo(() => Math.max(1, Number(pageSize) || 10), [pageSize])
  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredData.length / pageSizeNumber)), [filteredData.length, pageSizeNumber])
  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSizeNumber
    return filteredData.slice(start, start + pageSizeNumber)
  }, [filteredData, page, pageSizeNumber])

  const updatePaginationQuery = useCallback(
    (nextPage: number, nextPageSize: ReviewPageSize) => {
      const params = new URLSearchParams(searchParams.toString())

      if (nextPage > 1) {
        params.set("page", String(nextPage))
      } else {
        params.delete("page")
      }

      if (nextPageSize !== "10") {
        params.set("pageSize", nextPageSize)
      } else {
        params.delete("pageSize")
      }

      const next = params.toString()
      const current = searchParams.toString()
      if (next === current) return

      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    const queryPage = parseReviewPage(searchParams.get("page"))
    const queryPageSize = parseReviewPageSize(searchParams.get("pageSize"))

    if (queryPage !== page) {
      setPage(queryPage)
    }
    if (queryPageSize !== pageSize) {
      setPageSize(queryPageSize)
    }
  }, [page, pageSize, searchParams])

  useEffect(() => {
    if (page <= totalPages) return
    setPage(totalPages)
    updatePaginationQuery(totalPages, pageSize)
  }, [page, pageSize, totalPages, updatePaginationQuery])

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

  const openContinueConfirmation = () => {
    if (!reviewConfirmed) {
      toast.error("Please confirm review before continuing.")
      return
    }
    setConfirmContinueOpen(true)
  }

  const handleContinue = () => {
    startTransition(async () => {
      const result = await completeReviewPayrollRunAction({ companyId, runId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setConfirmContinueOpen(false)
      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
      <div className="space-y-2 xl:col-span-9">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setPage(1)
                updatePaginationQuery(1, pageSize)
              }}
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

        <div className="overflow-x-auto border border-border/60 bg-card">
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
                pagedData.map((row) => {
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page</span>
            <Select
              value={pageSize}
              onValueChange={(value) => {
                const nextPageSize = parseReviewPageSize(value)
                setPageSize(nextPageSize)
                setPage(1)
                updatePaginationQuery(1, nextPageSize)
              }}
            >
              <SelectTrigger className="h-8 w-[84px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>
              Page {page} of {totalPages} • {filteredData.length} records
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                const nextPage = Math.max(1, page - 1)
                setPage(nextPage)
                updatePaginationQuery(nextPage, pageSize)
              }}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => {
                const nextPage = Math.min(totalPages, page + 1)
                setPage(nextPage)
                updatePaginationQuery(nextPage, pageSize)
              }}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <aside className="space-y-4 xl:col-span-3">
        <div className="space-y-4 border border-border/60 bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Run Totals</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span>Total Gross</span><span className="font-semibold">{money.format(totals.gross)}</span></div>
            <div className="flex items-center justify-between"><span>Total Deductions</span><span className="font-semibold">{money.format(totals.deductions)}</span></div>
            <div className="flex items-center justify-between"><span>Net Payable</span><span className="font-semibold text-primary">{money.format(totals.net)}</span></div>
          </div>
        </div>

        <div className="space-y-2 border border-blue-500/30 bg-blue-500/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Review Guide</h3>
          <p className="text-xs text-foreground/80">Rows marked with a <span className="font-semibold">CHECK</span> badge need manual validation before proceeding.</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-foreground/80">
            <li>Net pay is zero or negative.</li>
            <li>Gross pay is zero or negative.</li>
            <li>Deductions are greater than gross pay.</li>
            <li>Take-home pay (net after deductions) is below 40% threshold.</li>
          </ul>
          <p className="text-xs text-foreground/80">Use <span className="font-semibold">Adjust</span> on the row to correct values, then recheck totals.</p>
        </div>

        <div className="space-y-3 border border-border/60 bg-card p-4">
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
          <Button type="button" className="w-full" disabled={isPending} onClick={openContinueConfirmation}>
            Continue to Payslips
          </Button>
        </div>
      </aside>

      <AlertDialog open={confirmContinueOpen} onOpenChange={setConfirmContinueOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Continue to Payslips?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that you reviewed payroll totals and discrepancy flags. This will advance the run to the payslips step.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                handleContinue()
              }}
            >
              {isPending ? "Proceeding..." : "Yes, Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
