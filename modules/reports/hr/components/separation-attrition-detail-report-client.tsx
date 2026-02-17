"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendar,
  IconChecklist,
  IconDownload,
  IconFileAnalytics,
  IconPrinter,
  IconRefresh,
  IconUsers,
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
import type {
  SeparationAttritionDetailRow,
  SeparationAttritionScope,
} from "@/modules/reports/hr/utils/get-separation-attrition-detail-view-model"

const TABLE_PAGE_SIZE = 10

type SeparationAttritionDetailReportClientProps = {
  companyId: string
  companyName: string
  generatedAtLabel: string
  errorMessage: string | null
  filters: {
    startDate: string
    endDate: string
    departmentId: string
    includeInactive: boolean
    attritionScope: SeparationAttritionScope
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  summary: {
    totalSeparated: number
    voluntaryCount: number
    involuntaryCount: number
    otherCount: number
    activeHeadcount: number
    averageTenureMonths: number
    attritionRate: number
  }
  rows: SeparationAttritionDetailRow[]
}

const numberFormatter = new Intl.NumberFormat("en-PH")
const decimalFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function MetricCard({
  label,
  value,
  icon: Icon,
  valueClassName,
}: {
  label: string
  value: string
  icon: typeof IconUsers
  valueClassName?: string
}) {
  return (
    <div className="rounded-md border border-border/70 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary/80" />
      </div>
      <p className={cn("mt-1 text-lg font-semibold tracking-tight text-foreground", valueClassName)}>{value}</p>
    </div>
  )
}

const attritionTone = {
  VOLUNTARY: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  INVOLUNTARY: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  OTHER: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
} as const

export function SeparationAttritionDetailReportClient({
  companyId,
  companyName,
  generatedAtLabel,
  errorMessage,
  filters,
  options,
  summary,
  rows,
}: SeparationAttritionDetailReportClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [page, setPage] = useState(1)

  const selectedStartDate = parsePhDateInputToPhDate(filters.startDate) ?? undefined
  const selectedEndDate = parsePhDateInputToPhDate(filters.endDate) ?? undefined

  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * TABLE_PAGE_SIZE
  const pagedRows = rows.slice(pageStart, pageStart + TABLE_PAGE_SIZE)

  const exportHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.departmentId) params.set("departmentId", filters.departmentId)
    if (filters.includeInactive) params.set("includeInactive", "true")
    if (filters.attritionScope !== "all") params.set("attritionScope", filters.attritionScope)
    return `/${companyId}/reports/hr/separation-attrition-detail/export?${params.toString()}`
  }, [companyId, filters.attritionScope, filters.departmentId, filters.endDate, filters.includeInactive, filters.startDate])

  const printHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.departmentId) params.set("departmentId", filters.departmentId)
    if (filters.includeInactive) params.set("includeInactive", "true")
    if (filters.attritionScope !== "all") params.set("attritionScope", filters.attritionScope)
    return `/${companyId}/reports/hr/separation-attrition-detail/print?${params.toString()}`
  }, [companyId, filters.attritionScope, filters.departmentId, filters.endDate, filters.includeInactive, filters.startDate])

  const updateRoute = (updates: {
    startDate?: string
    endDate?: string
    departmentId?: string
    includeInactive?: boolean
    attritionScope?: SeparationAttritionScope
  }) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    const nextStartDate = updates.startDate ?? filters.startDate
    const nextEndDate = updates.endDate ?? filters.endDate
    const nextDepartmentId = updates.departmentId ?? filters.departmentId
    const nextIncludeInactive = updates.includeInactive ?? filters.includeInactive
    const nextAttritionScope = updates.attritionScope ?? filters.attritionScope

    if (nextStartDate) nextParams.set("startDate", nextStartDate)
    else nextParams.delete("startDate")
    if (nextEndDate) nextParams.set("endDate", nextEndDate)
    else nextParams.delete("endDate")
    if (nextDepartmentId) nextParams.set("departmentId", nextDepartmentId)
    else nextParams.delete("departmentId")
    if (nextIncludeInactive) nextParams.set("includeInactive", "true")
    else nextParams.delete("includeInactive")
    if (nextAttritionScope !== "all") nextParams.set("attritionScope", nextAttritionScope)
    else nextParams.delete("attritionScope")

    startTransition(() => {
      const query = nextParams.toString()
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname)
      setPage(1)
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
              <p className="text-xs text-muted-foreground">Reports</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  <IconFileAnalytics className="size-6 text-primary sm:size-7" />
                  Separation and Attrition Detail
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {companyName}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Separation roster and attrition trend detail for HR analysis and reporting windows. Generated:{" "}
                {generatedAtLabel}
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
          <div className="grid gap-2 border-b border-border/60 px-4 py-3 sm:px-6 lg:grid-cols-2 xl:grid-cols-6 lg:px-8">
            <MetricCard icon={IconUsers} label="Separated" value={numberFormatter.format(summary.totalSeparated)} />
            <MetricCard
              icon={IconChecklist}
              label="Voluntary"
              value={numberFormatter.format(summary.voluntaryCount)}
              valueClassName="text-emerald-700 dark:text-emerald-300"
            />
            <MetricCard
              icon={IconAlertTriangle}
              label="Involuntary"
              value={numberFormatter.format(summary.involuntaryCount)}
              valueClassName="text-rose-700 dark:text-rose-300"
            />
            <MetricCard icon={IconFileAnalytics} label="Other" value={numberFormatter.format(summary.otherCount)} />
            <MetricCard
              icon={IconFileAnalytics}
              label="Avg Tenure (Months)"
              value={decimalFormatter.format(summary.averageTenureMonths)}
            />
            <MetricCard
              icon={IconFileAnalytics}
              label="Attrition Rate"
              value={`${decimalFormatter.format(summary.attritionRate)}%`}
            />
          </div>

          <section className="space-y-3 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end gap-2">
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
                        updateRoute({ startDate: nextStart, endDate })
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
                        updateRoute({ endDate: nextEnd })
                      }}
                      disabled={(date) => {
                        if (!selectedStartDate) return false
                        return date.getTime() < selectedStartDate.getTime()
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="w-full space-y-1 sm:w-[220px]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Department</p>
                <Select
                  value={filters.departmentId || "__ALL__"}
                  onValueChange={(value) => {
                    updateRoute({ departmentId: value === "__ALL__" ? "" : value })
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

              <div className="w-full space-y-1 sm:w-[210px]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Attrition Scope</p>
                <Select
                  value={filters.attritionScope}
                  onValueChange={(value) => {
                    updateRoute({ attritionScope: value as SeparationAttritionScope })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="voluntary">Voluntary</SelectItem>
                    <SelectItem value="involuntary">Involuntary</SelectItem>
                    <SelectItem value="other">Other / Unspecified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full space-y-1 sm:w-auto">
                <p className="invisible text-[10px] font-medium uppercase tracking-wide">Action</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    updateRoute({
                      startDate: "",
                      endDate: "",
                      departmentId: "",
                      includeInactive: true,
                      attritionScope: "all",
                    })
                  }}
                >
                  <IconRefresh className="mr-1.5 h-4 w-4" />
                  Reset
                </Button>
              </div>

              <div className="ml-auto flex w-full items-end gap-2 sm:w-auto">
                <Button asChild type="button" className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
                  <Link href={printHref} target="_blank" rel="noopener noreferrer">
                    <IconPrinter className="mr-1.5 h-4 w-4" />
                    Print
                  </Link>
                </Button>
                <Button asChild type="button" className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto">
                  <Link href={exportHref}>
                    <IconDownload className="mr-1.5 h-4 w-4" />
                    Export CSV
                  </Link>
                </Button>
              </div>

              {errorMessage ? <p className="pb-1 text-xs text-destructive">{errorMessage}</p> : null}
              {isPending ? <p className="pb-1 text-xs text-muted-foreground">Loading report...</p> : null}
            </div>

            <div className="w-full overflow-x-auto">
              <Table className="w-full table-fixed border border-border/60 text-xs [&_th]:whitespace-normal [&_th]:border [&_th]:border-border/60 [&_td]:align-top [&_td]:whitespace-normal [&_td]:break-words [&_td]:border [&_td]:border-border/60">
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hire Date</TableHead>
                    <TableHead>Separation Date</TableHead>
                    <TableHead>Last Working Day</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Attrition Type</TableHead>
                    <TableHead className="text-right">Tenure (Months)</TableHead>
                    <TableHead>Tenure Label</TableHead>
                    <TableHead className="text-right">Service Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No separated employee rows found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedRows.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell>
                          <p className="font-medium text-foreground">{row.employeeName}</p>
                          <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                        </TableCell>
                        <TableCell>{row.departmentName ?? "UNASSIGNED"}</TableCell>
                        <TableCell>
                          <Badge variant={row.isActive ? "secondary" : "outline"} className="h-6 px-2 text-[11px]">
                            {row.isActive ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.hireDateValue}</TableCell>
                        <TableCell>{row.separationDateValue}</TableCell>
                        <TableCell>{row.lastWorkingDayValue ?? "-"}</TableCell>
                        <TableCell>
                          <p className="text-foreground">{row.separationReasonLabel}</p>
                          <p className="text-[11px] text-muted-foreground">{row.separationReasonCode ?? "-"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("h-6 px-2 text-[11px]", attritionTone[row.attritionType])}>
                            {row.attritionType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{numberFormatter.format(row.tenureMonths)}</TableCell>
                        <TableCell>{row.tenureLabel}</TableCell>
                        <TableCell className="text-right">{numberFormatter.format(row.serviceDays)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs">
              <p className="text-muted-foreground">
                Showing {rows.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + TABLE_PAGE_SIZE, rows.length)} of{" "}
                {rows.length} records • Page {safePage} of {totalPages} • Active headcount:{" "}
                {numberFormatter.format(summary.activeHeadcount)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={safePage <= 1}
                  onClick={() => setPage((previous) => Math.max(Math.min(previous, totalPages) - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((previous) => Math.min(Math.min(previous, totalPages) + 1, totalPages))}
                >
                  Next
                </Button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
