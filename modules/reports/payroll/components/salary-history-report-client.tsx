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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
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

function SummaryMetric({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof IconListDetails
  label: string
  value: string
  valueClassName?: string
}) {
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

function SalaryHistoryTableCard({
  title,
  subtitle,
  toolbar,
  children,
}: {
  title: string
  subtitle: string
  toolbar?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border border-border/70 bg-background">
      <div className="border-b border-border/60 px-3 py-2.5">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <IconFileAnalytics className="h-4 w-4 text-primary" />
          {title}
        </p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        {toolbar}
      </div>
      {children}
    </section>
  )
}

function SalaryHistoryFiltersToolbar({
  filters,
  options,
  printHref,
  exportHref,
  isPending,
  errorMessage,
  onUpdate,
  onReset,
}: {
  filters: {
    startDate: string
    endDate: string
    employeeId: string
    departmentId: string
  }
  options: {
    employees: Array<{ id: string; label: string }>
    departments: Array<{ id: string; label: string }>
  }
  printHref: string
  exportHref: string
  isPending: boolean
  errorMessage: string | null
  onUpdate: (updates: {
    startDate?: string
    endDate?: string
    employeeId?: string
    departmentId?: string
  }) => void
  onReset: () => void
}) {
  const selectedStartDate = parsePhDateInputToPhDate(filters.startDate) ?? undefined
  const selectedEndDate = parsePhDateInputToPhDate(filters.endDate) ?? undefined

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <div className="w-full space-y-1 sm:w-[190px]">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Start Date</p>
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
                onUpdate({ startDate: nextStart, endDate })
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="w-full space-y-1 sm:w-[190px]">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">End Date</p>
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
                onUpdate({ endDate: nextEnd })
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
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Employee</p>
        <Select
          value={filters.employeeId || "__ALL__"}
          onValueChange={(value) => {
            onUpdate({ employeeId: value === "__ALL__" ? "" : value })
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
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Department</p>
        <Select
          value={filters.departmentId || "__ALL__"}
          onValueChange={(value) => {
            onUpdate({ departmentId: value === "__ALL__" ? "" : value })
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

      <div className="w-full space-y-1 sm:w-auto">
        <p className="invisible text-[10px] font-medium uppercase tracking-wide">Action</p>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onReset}>
          <IconRefresh className="mr-1.5 h-4 w-4" />
          Reset
        </Button>
      </div>

      <div className="ml-auto flex w-full items-end gap-2 sm:w-auto">
        <div className="w-full space-y-1 sm:w-auto">
          <p className="invisible text-[10px] font-medium uppercase tracking-wide">Action</p>
          <Button asChild type="button" className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
            <Link href={printHref} target="_blank" rel="noopener noreferrer">
              <IconPrinter className="mr-1.5 h-4 w-4" />
              Print
            </Link>
          </Button>
        </div>

        <div className="w-full space-y-1 sm:w-auto">
          <p className="invisible text-[10px] font-medium uppercase tracking-wide">Action</p>
          <Button asChild type="button" className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto">
            <Link href={exportHref}>
              <IconDownload className="mr-1.5 h-4 w-4" />
              Export CSV
            </Link>
          </Button>
        </div>
      </div>

      {isPending ? <p className="pb-1 text-xs text-muted-foreground">Loading report...</p> : null}
      {errorMessage ? <p className="pb-1 text-xs text-destructive">{errorMessage}</p> : null}
    </div>
  )
}

function SalaryHistoryTable({
  rows,
  pagination,
  isPending,
  onPageChange,
}: {
  rows: SalaryHistoryReportRow[]
  pagination: ReportPagination
  isPending: boolean
  onPageChange: (page: number) => void
}) {
  const start = pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const end = Math.min(pagination.page * pagination.pageSize, pagination.totalItems)

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table className="min-w-[1480px] text-xs">
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead className="text-right">Previous Salary</TableHead>
              <TableHead className="text-right">New Salary</TableHead>
              <TableHead className="text-right">Delta</TableHead>
              <TableHead>Adjustment Type</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No salary history records found for the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.salaryHistoryId}>
                  <TableCell>
                    <p className="font-medium text-foreground">{row.employeeName}</p>
                    <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                  </TableCell>
                  <TableCell>{row.departmentName ?? "UNASSIGNED"}</TableCell>
                  <TableCell>{row.effectiveDateValue}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.previousSalaryAmount)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.newSalaryAmount)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      (row.deltaAmount ?? 0) > 0 ? "text-emerald-700 dark:text-emerald-300" : "",
                      (row.deltaAmount ?? 0) < 0 ? "text-amber-700 dark:text-amber-300" : ""
                    )}
                  >
                    {formatCurrency(row.deltaAmount)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[11px]">
                      {formatAdjustmentType(row.adjustmentTypeCode)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal break-words">{row.reason ?? "-"}</TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal break-words">{row.remarks ?? "-"}</TableCell>
                  <TableCell>{toDateTimeLabel(row.createdAtIso)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs">
        <p className="text-muted-foreground">
          Showing {start}-{end} of {pagination.totalItems} records • Page {pagination.page} of {pagination.totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={pagination.page <= 1 || isPending}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={pagination.page >= pagination.totalPages || isPending}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
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
    applyValue("pageSize", filters.pageSize)

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
            </div>
          </div>
        </section>
      </header>

      <section className="w-full py-4">
        <div className="border-y border-border/70 bg-background">
          <div className="grid gap-2 border-b border-border/60 px-4 py-3 sm:px-6 lg:grid-cols-2 xl:grid-cols-4 lg:px-8">
            <SummaryMetric icon={IconListDetails} label="Total Records" value={String(pagination.totalItems)} />
            <SummaryMetric icon={IconFileAnalytics} label="Current Page" value={String(rows.length)} />
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

          <div className="space-y-4 px-4 py-4 sm:px-6 lg:px-8">
            <SalaryHistoryTableCard
              title="Salary Movement Ledger"
              subtitle="Employee-level salary changes with effective date, variance, and audit details."
              toolbar={
                <SalaryHistoryFiltersToolbar
                  filters={{
                    startDate: filters.startDate,
                    endDate: filters.endDate,
                    employeeId: filters.employeeId,
                    departmentId: filters.departmentId,
                  }}
                  options={options}
                  printHref={printHref}
                  exportHref={exportHref}
                  isPending={isPending}
                  errorMessage={errorMessage}
                  onUpdate={(updates) => {
                    updateRoute({
                      startDate: updates.startDate,
                      endDate: updates.endDate,
                      employeeId: updates.employeeId,
                      departmentId: updates.departmentId,
                      page: 1,
                    })
                  }}
                  onReset={() => {
                    updateRoute({
                      startDate: "",
                      endDate: "",
                      employeeId: "",
                      departmentId: "",
                      page: 1,
                    })
                  }}
                />
              }
            >
              <SalaryHistoryTable
                rows={rows}
                pagination={pagination}
                isPending={isPending}
                onPageChange={(nextPage) => {
                  updateRoute({ page: nextPage })
                }}
              />
            </SalaryHistoryTableCard>
          </div>
        </div>
      </section>
    </main>
  )
}
