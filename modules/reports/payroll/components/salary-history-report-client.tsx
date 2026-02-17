"use client"

import Link from "next/link"
import { useMemo, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconArrowLeft,
  IconCalendar,
  IconCurrencyPeso,
  IconDownload,
  IconFileAnalytics,
  IconListDetails,
  IconPrinter,
  IconRefresh,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import type { ReportPagination, SalaryHistoryReportRow } from "@/modules/reports/payroll/types/report-view-models"

type SalaryHistoryReportClientProps = {
  companyId: string
  companyName: string
  generatedAtLabel: string
  errorMessage: string | null
  filters: {
    startDate: string
    endDate: string
    employeeId: string
    departmentId: string
    page: number
    pageSize: number
  }
  options: {
    employees: Array<{ id: string; label: string }>
    departments: Array<{ id: string; label: string }>
  }
  rows: SalaryHistoryReportRow[]
  pagination: ReportPagination
}

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatCurrency = (value: number | null): string => {
  if (value === null) return "-"
  return `PHP ${currencyFormatter.format(value)}`
}

const formatAdjustmentType = (value: string | null): string => {
  if (!value) return "-"
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const toDateTimeLabel = (value: string): string => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

const SummaryMetric = ({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof IconListDetails
  label: string
  value: string
  valueClassName?: string
}) => {
  return (
    <div className="rounded-md border border-border/70 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary/80" />
      </div>
      <p className={cn("mt-1 text-lg font-semibold tracking-tight text-foreground", valueClassName)}>{value}</p>
    </div>
  )
}

export function SalaryHistoryReportClient({
  companyId,
  companyName,
  generatedAtLabel,
  errorMessage,
  filters,
  options,
  rows,
  pagination,
}: SalaryHistoryReportClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const selectedStartDate = parsePhDateInputToPhDate(filters.startDate) ?? undefined
  const selectedEndDate = parsePhDateInputToPhDate(filters.endDate) ?? undefined

  const periodLabel = `${filters.startDate} to ${filters.endDate}`

  const pageSummary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.deltaAmount === null) return acc
        if (row.deltaAmount >= 0) {
          acc.totalIncrease += row.deltaAmount
        } else {
          acc.totalDecrease += Math.abs(row.deltaAmount)
        }
        return acc
      },
      { totalIncrease: 0, totalDecrease: 0 }
    )
  }, [rows])

  const exportHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.employeeId) params.set("employeeId", filters.employeeId)
    if (filters.departmentId) params.set("departmentId", filters.departmentId)
    return `/${companyId}/reports/payroll/salary-history/export?${params.toString()}`
  }, [companyId, filters.departmentId, filters.employeeId, filters.endDate, filters.startDate])

  const printHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.employeeId) params.set("employeeId", filters.employeeId)
    if (filters.departmentId) params.set("departmentId", filters.departmentId)
    return `/${companyId}/reports/payroll/salary-history/print?${params.toString()}`
  }, [companyId, filters.departmentId, filters.employeeId, filters.endDate, filters.startDate])

  const updateRoute = (updates: {
    startDate?: string
    endDate?: string
    employeeId?: string
    departmentId?: string
    page?: number
  }) => {
    const nextParams = new URLSearchParams(searchParams.toString())

    const applyValue = (key: string, value: string | number | undefined) => {
      if (value === undefined || value === "" || value === 0) {
        nextParams.delete(key)
        return
      }
      nextParams.set(key, String(value))
    }

    applyValue("startDate", updates.startDate ?? filters.startDate)
    applyValue("endDate", updates.endDate ?? filters.endDate)
    applyValue("employeeId", updates.employeeId ?? filters.employeeId)
    applyValue("departmentId", updates.departmentId ?? filters.departmentId)
    applyValue("page", updates.page ?? filters.page)

    startTransition(() => {
      const query = nextParams.toString()
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname)
    })
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20">
        <div className="pointer-events-none absolute -right-24 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-8 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />

        <section className="relative w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Payroll Reports</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  <IconFileAnalytics className="size-6 text-primary sm:size-7" />
                  Salary History Report
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {companyName}
                </Badge>
                <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                  {periodLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Salary adjustment audit trail and variance analysis. Generated: {generatedAtLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" type="button" size="sm" className="h-8 border-border/70">
                <Link href={`/${companyId}/reports/payroll`}>
                  <IconArrowLeft className="mr-1.5 h-4 w-4" />
                  Back to Payroll Reports
                </Link>
              </Button>
              <Button asChild className="h-8 bg-blue-600 text-white hover:bg-blue-700" size="sm">
                <Link href={printHref} target="_blank" rel="noopener noreferrer">
                  <IconPrinter className="mr-1.5 h-4 w-4" />
                  Print Report
                </Link>
              </Button>
              <Button asChild className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" size="sm">
                <Link href={exportHref}>
                  <IconDownload className="mr-1.5 h-4 w-4" />
                  Export CSV
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </header>

      <section className="w-full py-4">
        <div className="border-y border-border/70 bg-background">
          <div className="grid gap-2 border-b border-border/60 px-4 py-3 sm:px-6 lg:grid-cols-2 xl:grid-cols-4 lg:px-8">
            <SummaryMetric
              icon={IconListDetails}
              label="Total Records"
              value={String(pagination.totalItems)}
            />
            <SummaryMetric
              icon={IconFileAnalytics}
              label="Current Page"
              value={String(rows.length)}
            />
            <SummaryMetric
              icon={IconCurrencyPeso}
              label="Page Total Increase"
              value={formatCurrency(pageSummary.totalIncrease)}
              valueClassName="text-emerald-700 dark:text-emerald-300"
            />
            <SummaryMetric
              icon={IconCurrencyPeso}
              label="Page Total Decrease"
              value={formatCurrency(pageSummary.totalDecrease)}
              valueClassName="text-amber-700 dark:text-amber-300"
            />
          </div>

          <div className="border-b border-border/60 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end gap-3">
            <div className="w-full space-y-1 sm:w-[210px]">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Start Date</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start">
                    <IconCalendar className="mr-1.5 h-4 w-4" />
                    {filters.startDate || "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedStartDate}
                    onSelect={(date) => {
                      const nextStart = toPhDateInputValue(date)
                      if (!nextStart) return
                      const endDate = filters.endDate && filters.endDate < nextStart ? nextStart : filters.endDate
                      updateRoute({
                        startDate: nextStart,
                        endDate,
                        page: 1,
                      })
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="w-full space-y-1 sm:w-[210px]">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">End Date</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start">
                    <IconCalendar className="mr-1.5 h-4 w-4" />
                    {filters.endDate || "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedEndDate}
                    onSelect={(date) => {
                      const nextEnd = toPhDateInputValue(date)
                      if (!nextEnd) return
                      updateRoute({
                        endDate: nextEnd,
                        page: 1,
                      })
                    }}
                    disabled={(date) => {
                      if (!selectedStartDate) return false
                      return date.getTime() < selectedStartDate.getTime()
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="w-full space-y-1 sm:w-[280px]">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Employee</p>
              <Select
                value={filters.employeeId || "__ALL__"}
                onValueChange={(value) => {
                  updateRoute({
                    employeeId: value === "__ALL__" ? "" : value,
                    page: 1,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">All employees</SelectItem>
                  {options.employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full space-y-1 sm:w-[240px]">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Department</p>
              <Select
                value={filters.departmentId || "__ALL__"}
                onValueChange={(value) => {
                  updateRoute({
                    departmentId: value === "__ALL__" ? "" : value,
                    page: 1,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">All departments</SelectItem>
                  {options.departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="self-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  updateRoute({
                    startDate: "",
                    endDate: "",
                    employeeId: "",
                    departmentId: "",
                    page: 1,
                  })
                }}
              >
                <IconRefresh className="mr-1.5 h-3.5 w-3.5" />
                Reset Filters
              </Button>
            </div>
            </div>
          </div>

          {isPending || errorMessage ? (
            <div className="border-b border-border/60 px-4 py-2 sm:px-6 lg:px-8">
              {isPending ? <p className="text-xs text-muted-foreground">Loading report...</p> : null}
              {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
            </div>
          ) : null}

          <div className="overflow-x-hidden">
            <table className="w-full table-fixed border-collapse text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="border border-border px-2 py-1.5 text-left break-words whitespace-normal">Employee</th>
                <th className="border border-border px-2 py-1.5 text-left break-words whitespace-normal">Department</th>
                <th className="border border-border px-2 py-1.5 text-left break-words whitespace-normal">Effective Date</th>
                <th className="border border-border px-2 py-1.5 text-right break-words whitespace-normal">Previous Salary</th>
                <th className="border border-border px-2 py-1.5 text-right break-words whitespace-normal">New Salary</th>
                <th className="border border-border px-2 py-1.5 text-right break-words whitespace-normal">Delta</th>
                <th className="border border-border px-2 py-1.5 text-left break-words whitespace-normal">Adjustment Type</th>
                <th className="border border-border px-2 py-1.5 text-left break-words whitespace-normal">Reason</th>
                <th className="border border-border px-2 py-1.5 text-left break-words whitespace-normal">Remarks</th>
                <th className="border border-border px-2 py-1.5 text-left break-words whitespace-normal">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="border border-border px-3 py-8 text-center text-sm text-muted-foreground">
                    No salary history records found for the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.salaryHistoryId} className="hover:bg-muted/20">
                    <td className="border border-border px-2 py-1.5 align-top break-words whitespace-normal">
                      <p className="font-medium text-foreground">{row.employeeName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                    </td>
                    <td className="border border-border px-2 py-1.5 align-top break-words whitespace-normal">{row.departmentName ?? "UNASSIGNED"}</td>
                    <td className="border border-border px-2 py-1.5 align-top break-words whitespace-normal">{row.effectiveDateValue}</td>
                    <td className="border border-border px-2 py-1.5 align-top text-right">{formatCurrency(row.previousSalaryAmount)}</td>
                    <td className="border border-border px-2 py-1.5 align-top text-right font-medium">{formatCurrency(row.newSalaryAmount)}</td>
                    <td
                      className={cn(
                        "border border-border px-2 py-1.5 align-top text-right",
                        (row.deltaAmount ?? 0) > 0 ? "text-emerald-700 dark:text-emerald-300" : "",
                        (row.deltaAmount ?? 0) < 0 ? "text-amber-700 dark:text-amber-300" : ""
                      )}
                    >
                      {formatCurrency(row.deltaAmount)}
                    </td>
                    <td className="border border-border px-2 py-1.5 align-top break-words whitespace-normal">
                      <span className="inline-flex rounded border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[11px]">
                        {formatAdjustmentType(row.adjustmentTypeCode)}
                      </span>
                    </td>
                    <td className="border border-border px-2 py-1.5 align-top break-words whitespace-normal">{row.reason ?? "-"}</td>
                    <td className="border border-border px-2 py-1.5 align-top break-words whitespace-normal">{row.remarks ?? "-"}</td>
                    <td className="border border-border px-2 py-1.5 align-top break-words whitespace-normal">{toDateTimeLabel(row.createdAtIso)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">
            {pagination.totalItems} record{pagination.totalItems === 1 ? "" : "s"} • Page {pagination.page} of{" "}
            {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || isPending}
              onClick={() => updateRoute({ page: pagination.page - 1 })}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || isPending}
              onClick={() => updateRoute({ page: pagination.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
        </div>
      </section>
    </main>
  )
}
