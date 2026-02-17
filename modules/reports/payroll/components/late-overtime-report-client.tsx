"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconClockHour4,
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
import { cn } from "@/lib/utils"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import type {
  LateOvertimeReportSectionKey,
  LateOvertimeSectionDataResponse,
  LateOvertimeSectionFilters,
  LateOvertimeTopDepartmentRow,
  LateOvertimeTopEmployeeRow,
} from "@/modules/reports/payroll/types/report-view-models"

type LateOvertimeReportClientProps = {
  companyId: string
  companyName: string
  generatedAtLabel: string
  sectionFilters: Record<
    TableSectionKey,
    {
      startDate: string
      endDate: string
      topN: number
    }
  >
  summary: {
    periodLabel: string
    totalLateMins: number
    totalOvertimeHours: number
    totalOvertimePayAmount: number
    totalTardinessDeductionAmount: number
  }
  topEmployeesByLate: LateOvertimeTopEmployeeRow[]
  topEmployeesByOvertime: LateOvertimeTopEmployeeRow[]
  topDepartmentsByLate: LateOvertimeTopDepartmentRow[]
  topDepartmentsByOvertime: LateOvertimeTopDepartmentRow[]
}

const numberFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toCurrencyLabel = (value: number): string => `PHP ${numberFormatter.format(value)}`
const toHoursLabel = (value: number): string => `${numberFormatter.format(value)} hrs`
const toMinutesLabel = (value: number): string => `${value.toLocaleString("en-PH")} mins`
const TABLE_PAGE_SIZE = 5
type TableSectionKey = LateOvertimeReportSectionKey

const getLateDailyBreakdown = (
  row: Partial<LateOvertimeTopEmployeeRow> | null | undefined
): Array<{ dateValue: string; dateLabel: string; lateMins: number }> => {
  if (!row || !Array.isArray(row.lateDailyBreakdown)) return []
  return row.lateDailyBreakdown.filter(
    (entry): entry is { dateValue: string; dateLabel: string; lateMins: number } =>
      Boolean(entry) &&
      typeof entry.dateValue === "string" &&
      typeof entry.dateLabel === "string" &&
      typeof entry.lateMins === "number"
  )
}

const getOvertimeDailyBreakdown = (
  row: Partial<LateOvertimeTopEmployeeRow> | null | undefined
): Array<{ dateValue: string; dateLabel: string; overtimeHours: number }> => {
  if (!row || !Array.isArray(row.overtimeDailyBreakdown)) return []
  return row.overtimeDailyBreakdown.filter(
    (entry): entry is { dateValue: string; dateLabel: string; overtimeHours: number } =>
      Boolean(entry) &&
      typeof entry.dateValue === "string" &&
      typeof entry.dateLabel === "string" &&
      typeof entry.overtimeHours === "number"
  )
}

export function LateOvertimeReportClient({
  companyId,
  companyName,
  generatedAtLabel,
  sectionFilters,
  summary,
  topEmployeesByLate,
  topEmployeesByOvertime,
  topDepartmentsByLate,
  topDepartmentsByOvertime,
}: LateOvertimeReportClientProps) {
  const [summaryState, setSummaryState] = useState(summary)
  const [filtersBySection, setFiltersBySection] = useState(sectionFilters)
  const [employeeLateRows, setEmployeeLateRows] = useState(topEmployeesByLate)
  const [employeeOvertimeRows, setEmployeeOvertimeRows] = useState(topEmployeesByOvertime)
  const [departmentLateRows, setDepartmentLateRows] = useState(topDepartmentsByLate)
  const [departmentOvertimeRows, setDepartmentOvertimeRows] = useState(topDepartmentsByOvertime)
  const [loadingBySection, setLoadingBySection] = useState<Record<TableSectionKey, boolean>>({
    "employees-late": false,
    "employees-overtime": false,
    "departments-late": false,
    "departments-overtime": false,
  })
  const [errorBySection, setErrorBySection] = useState<Record<TableSectionKey, string | null>>({
    "employees-late": null,
    "employees-overtime": null,
    "departments-late": null,
    "departments-overtime": null,
  })
  const requestControllersRef = useRef<Record<TableSectionKey, AbortController | null>>({
    "employees-late": null,
    "employees-overtime": null,
    "departments-late": null,
    "departments-overtime": null,
  })

  useEffect(() => {
    return () => {
      requestControllersRef.current["employees-late"]?.abort()
      requestControllersRef.current["employees-overtime"]?.abort()
      requestControllersRef.current["departments-late"]?.abort()
      requestControllersRef.current["departments-overtime"]?.abort()
    }
  }, [])

  const getSectionActionHref = (
    action: "print" | "export",
    section: TableSectionKey,
    filters: { startDate: string; endDate: string; topN: number }
  ): string => {
    const params = new URLSearchParams()
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.topN !== 10) params.set("topN", String(filters.topN))
    params.set("section", section)
    return `/${companyId}/reports/payroll/late-overtime/${action}?${params.toString()}`
  }

  const baseTopNOptions = useMemo(() => {
    const baseOptions = [5, 10, 20, 50]
    return baseOptions
  }, [])

  const getTopNOptions = (topN: number): number[] => {
    if (baseTopNOptions.includes(topN)) {
      return baseTopNOptions
    }
    return [...baseTopNOptions, topN].sort((a, b) => a - b)
  }

  const fetchSectionData = async (section: TableSectionKey, filters: LateOvertimeSectionFilters): Promise<void> => {
    requestControllersRef.current[section]?.abort()
    const controller = new AbortController()
    requestControllersRef.current[section] = controller

    setLoadingBySection((previous) => ({ ...previous, [section]: true }))
    setErrorBySection((previous) => ({ ...previous, [section]: null }))

    try {
      const params = new URLSearchParams()
      params.set("section", section)
      if (filters.startDate) params.set("startDate", filters.startDate)
      if (filters.endDate) params.set("endDate", filters.endDate)
      if (filters.topN !== 10) params.set("topN", String(filters.topN))

      const response = await fetch(`/${companyId}/reports/payroll/late-overtime/data?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error("Unable to refresh section data.")
      }

      const payload = (await response.json()) as LateOvertimeSectionDataResponse

      setFiltersBySection((previous) => ({
        ...previous,
        [section]: payload.filters,
      }))

      if ("employeeRows" in payload) {
        if (payload.section === "employees-late") {
          setEmployeeLateRows(payload.employeeRows)
          setSummaryState(payload.summary)
        } else {
          setEmployeeOvertimeRows(payload.employeeRows)
        }
      } else if (payload.section === "departments-late") {
        setDepartmentLateRows(payload.departmentRows)
      } else {
        setDepartmentOvertimeRows(payload.departmentRows)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      setErrorBySection((previous) => ({
        ...previous,
        [section]: "Unable to load section data.",
      }))
    } finally {
      if (requestControllersRef.current[section] === controller) {
        requestControllersRef.current[section] = null
      }
      setLoadingBySection((previous) => ({ ...previous, [section]: false }))
    }
  }

  const updateSectionFilters = (section: TableSectionKey, updates: {
    startDate?: string
    endDate?: string
    topN?: number
  }) => {
    const currentSectionFilters = filtersBySection[section]
    const nextStartDate = updates.startDate ?? currentSectionFilters.startDate
    const nextEndDate = updates.endDate ?? currentSectionFilters.endDate
    const nextTopN = updates.topN ?? currentSectionFilters.topN
    const nextFilters: LateOvertimeSectionFilters = {
      startDate: nextStartDate,
      endDate: nextEndDate,
      topN: nextTopN,
    }

    setFiltersBySection((previous) => ({
      ...previous,
      [section]: nextFilters,
    }))

    void fetchSectionData(section, nextFilters)
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
                  Late and Overtime Report
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {companyName}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Attendance and payroll variance leaderboard by date range. Generated: {generatedAtLabel}
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
            <MetricCard
              icon={IconClockHour4}
              label="Total Late"
              value={toMinutesLabel(summaryState.totalLateMins)}
              valueClassName="text-amber-700 dark:text-amber-300"
            />
            <MetricCard
              icon={IconClockHour4}
              label="Total Overtime"
              value={toHoursLabel(summaryState.totalOvertimeHours)}
              valueClassName="text-primary"
            />
            <MetricCard
              icon={IconUsers}
              label="Overtime Pay"
              value={toCurrencyLabel(summaryState.totalOvertimePayAmount)}
              valueClassName="text-emerald-700 dark:text-emerald-300"
            />
            <MetricCard
              icon={IconBuilding}
              label="Late Deduction"
              value={toCurrencyLabel(summaryState.totalTardinessDeductionAmount)}
            />
          </div>

          <div className="space-y-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="space-y-4">
              <LeaderboardCard
                title="Top Employees by Late"
                subtitle="Late-only leaderboard with day-by-day tardiness breakdown."
                filterToolbar={
                  <LeaderboardFilters
                    filters={filtersBySection["employees-late"]}
                    topNOptions={getTopNOptions(filtersBySection["employees-late"].topN)}
                    isPending={loadingBySection["employees-late"]}
                    errorMessage={errorBySection["employees-late"]}
                    exportHref={getSectionActionHref("export", "employees-late", filtersBySection["employees-late"])}
                    printHref={getSectionActionHref("print", "employees-late", filtersBySection["employees-late"])}
                    onUpdate={(updates) => updateSectionFilters("employees-late", updates)}
                    onReset={() => {
                      updateSectionFilters("employees-late", {
                        startDate: "",
                        endDate: "",
                        topN: 10,
                      })
                    }}
                  />
                }
              >
                <EmployeeLeaderboardTable rows={employeeLateRows} mode="late" />
              </LeaderboardCard>

              <LeaderboardCard
                title="Top Employees by Overtime"
                subtitle="Highest overtime impact ranked by total hours and overtime pay."
                filterToolbar={
                  <LeaderboardFilters
                    filters={filtersBySection["employees-overtime"]}
                    topNOptions={getTopNOptions(filtersBySection["employees-overtime"].topN)}
                    isPending={loadingBySection["employees-overtime"]}
                    errorMessage={errorBySection["employees-overtime"]}
                    exportHref={getSectionActionHref("export", "employees-overtime", filtersBySection["employees-overtime"])}
                    printHref={getSectionActionHref("print", "employees-overtime", filtersBySection["employees-overtime"])}
                    onUpdate={(updates) => updateSectionFilters("employees-overtime", updates)}
                    onReset={() => {
                      updateSectionFilters("employees-overtime", {
                        startDate: "",
                        endDate: "",
                        topN: 10,
                      })
                    }}
                  />
                }
              >
                <EmployeeLeaderboardTable rows={employeeOvertimeRows} mode="overtime" />
              </LeaderboardCard>

              <LeaderboardCard
                title="Top Departments by Late"
                subtitle="Department-level tardiness ranking by late minutes and late days."
                filterToolbar={
                  <LeaderboardFilters
                    filters={filtersBySection["departments-late"]}
                    topNOptions={getTopNOptions(filtersBySection["departments-late"].topN)}
                    isPending={loadingBySection["departments-late"]}
                    errorMessage={errorBySection["departments-late"]}
                    exportHref={getSectionActionHref("export", "departments-late", filtersBySection["departments-late"])}
                    printHref={getSectionActionHref("print", "departments-late", filtersBySection["departments-late"])}
                    onUpdate={(updates) => updateSectionFilters("departments-late", updates)}
                    onReset={() => {
                      updateSectionFilters("departments-late", {
                        startDate: "",
                        endDate: "",
                        topN: 10,
                      })
                    }}
                  />
                }
              >
                <DepartmentLeaderboardTable rows={departmentLateRows} mode="late" />
              </LeaderboardCard>

              <LeaderboardCard
                title="Top Departments by Overtime"
                subtitle="Department-level overtime ranking by total hours and OT days."
                filterToolbar={
                  <LeaderboardFilters
                    filters={filtersBySection["departments-overtime"]}
                    topNOptions={getTopNOptions(filtersBySection["departments-overtime"].topN)}
                    isPending={loadingBySection["departments-overtime"]}
                    errorMessage={errorBySection["departments-overtime"]}
                    exportHref={getSectionActionHref("export", "departments-overtime", filtersBySection["departments-overtime"])}
                    printHref={getSectionActionHref("print", "departments-overtime", filtersBySection["departments-overtime"])}
                    onUpdate={(updates) => updateSectionFilters("departments-overtime", updates)}
                    onReset={() => {
                      updateSectionFilters("departments-overtime", {
                        startDate: "",
                        endDate: "",
                        topN: 10,
                      })
                    }}
                  />
                }
              >
                <DepartmentLeaderboardTable rows={departmentOvertimeRows} mode="overtime" />
              </LeaderboardCard>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof IconUsers
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

function LeaderboardCard({
  title,
  subtitle,
  filterToolbar,
  children,
}: {
  title: string
  subtitle: string
  filterToolbar?: React.ReactNode
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
        {filterToolbar}
      </div>
      {children}
    </section>
  )
}

function LeaderboardFilters({
  filters,
  topNOptions,
  isPending,
  errorMessage,
  exportHref,
  printHref,
  onUpdate,
  onReset,
}: {
  filters: {
    startDate: string
    endDate: string
    topN: number
  }
  topNOptions: number[]
  isPending: boolean
  errorMessage?: string | null
  exportHref: string
  printHref: string
  onUpdate: (updates: { startDate?: string; endDate?: string; topN?: number }) => void
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
                onUpdate({
                  startDate: nextStart,
                  endDate,
                })
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
                onUpdate({
                  endDate: nextEnd,
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

      <div className="w-full space-y-1 sm:w-auto">
        <p className="invisible text-[10px] font-medium uppercase tracking-wide">Action</p>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onReset}>
          <IconRefresh className="mr-1.5 h-4 w-4" />
          Reset
        </Button>
      </div>

      <div className="w-full space-y-1 sm:w-[170px]">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Top Ranking</p>
        <Select
          value={String(filters.topN)}
          onValueChange={(value) => {
            onUpdate({
              topN: Number(value),
            })
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select limit" />
          </SelectTrigger>
          <SelectContent>
            {topNOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                Top {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

function EmployeeLeaderboardTable({
  rows,
  mode,
}: {
  rows: LateOvertimeTopEmployeeRow[]
  mode: "late" | "overtime"
}) {
  const [page, setPage] = useState(1)
  const lateDateColumns = useMemo(() => {
    if (mode !== "late") return []
    const labelsByDate = new Map<string, string>()
    for (const row of rows) {
      for (const entry of getLateDailyBreakdown(row)) {
        if (labelsByDate.has(entry.dateValue)) continue
        labelsByDate.set(entry.dateValue, entry.dateLabel)
      }
    }

    return Array.from(labelsByDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateValue, dateLabel]) => ({ dateValue, dateLabel }))
  }, [mode, rows])
  const overtimeDateColumns = useMemo(() => {
    if (mode !== "overtime") return []
    const labelsByDate = new Map<string, string>()
    for (const row of rows) {
      for (const entry of getOvertimeDailyBreakdown(row)) {
        if (labelsByDate.has(entry.dateValue)) continue
        labelsByDate.set(entry.dateValue, entry.dateLabel)
      }
    }

    return Array.from(labelsByDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateValue, dateLabel]) => ({ dateValue, dateLabel }))
  }, [mode, rows])
  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * TABLE_PAGE_SIZE
  const pagedRows = rows.slice(pageStart, pageStart + TABLE_PAGE_SIZE)

  if (rows.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
        No employee data found for the selected date range.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table
          className="text-xs"
          style={{
            minWidth:
              mode === "late"
                ? `${1040 + lateDateColumns.length * 95}px`
                : `${1020 + overtimeDateColumns.length * 95}px`,
          }}
        >
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[64px]">Rank</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              {mode === "late" ? (
                <>
                  {lateDateColumns.map((column) => (
                    <TableHead key={column.dateValue} className="text-right">
                      {column.dateLabel}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Late Minutes</TableHead>
                  <TableHead className="text-right">Late Deduction</TableHead>
                </>
              ) : (
                <>
                  {overtimeDateColumns.map((column) => (
                    <TableHead key={column.dateValue} className="text-right">
                      {column.dateLabel}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">OT Hours</TableHead>
                  <TableHead className="text-right">OT Pay</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row, index) => {
              const lateMinsByDate =
                mode === "late"
                  ? new Map(getLateDailyBreakdown(row).map((entry) => [entry.dateValue, entry.lateMins]))
                  : null
              const overtimeHoursByDate =
                mode === "overtime"
                  ? new Map(
                      getOvertimeDailyBreakdown(row).map((entry) => [entry.dateValue, entry.overtimeHours])
                    )
                  : null

              return (
                <TableRow key={`${mode}-${row.employeeId}`}>
                  <TableCell className="font-medium text-muted-foreground">#{pageStart + index + 1}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{row.employeeName}</p>
                    <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                  </TableCell>
                  <TableCell>{row.departmentName ?? "UNASSIGNED"}</TableCell>
                  {mode === "late" ? (
                    <>
                      {lateDateColumns.map((column) => {
                        const dailyLate = lateMinsByDate?.get(column.dateValue)
                        return (
                          <TableCell key={`${row.employeeId}-${column.dateValue}`} className="text-right">
                            {dailyLate && dailyLate > 0 ? dailyLate.toLocaleString("en-PH") : "-"}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right">{row.lateMins.toLocaleString("en-PH")}</TableCell>
                      <TableCell className="text-right">{toCurrencyLabel(row.tardinessDeductionAmount)}</TableCell>
                    </>
                  ) : (
                    <>
                      {overtimeDateColumns.map((column) => {
                        const overtimeHours = overtimeHoursByDate?.get(column.dateValue)
                        return (
                          <TableCell key={`${row.employeeId}-ot-${column.dateValue}`} className="text-right">
                            {overtimeHours && overtimeHours > 0 ? numberFormatter.format(overtimeHours) : "-"}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right">{numberFormatter.format(row.overtimeHours)}</TableCell>
                      <TableCell className="text-right">{toCurrencyLabel(row.overtimePayAmount)}</TableCell>
                    </>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <TablePaginationFooter
        page={safePage}
        totalPages={totalPages}
        pageSize={TABLE_PAGE_SIZE}
        totalItems={rows.length}
        onPrevious={() => setPage((previous) => Math.max(Math.min(previous, totalPages) - 1, 1))}
        onNext={() => setPage((previous) => Math.min(Math.min(previous, totalPages) + 1, totalPages))}
      />
    </div>
  )
}

function DepartmentLeaderboardTable({
  rows,
  mode,
}: {
  rows: LateOvertimeTopDepartmentRow[]
  mode: "late" | "overtime"
}) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * TABLE_PAGE_SIZE
  const pagedRows = rows.slice(pageStart, pageStart + TABLE_PAGE_SIZE)

  if (rows.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
        No department data found for the selected date range.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table className={cn("text-xs", mode === "late" ? "min-w-[760px]" : "min-w-[760px]")}>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[64px]">Rank</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Headcount</TableHead>
              {mode === "late" ? (
                <>
                  <TableHead className="text-right">Late Minutes</TableHead>
                  <TableHead className="text-right">Late Days</TableHead>
                  <TableHead className="text-right">Late Deduction</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="text-right">OT Hours</TableHead>
                  <TableHead className="text-right">OT Days</TableHead>
                  <TableHead className="text-right">OT Pay</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row, index) => (
              <TableRow key={`${mode}-${row.departmentId ?? "unassigned"}`}>
                <TableCell className="font-medium text-muted-foreground">#{pageStart + index + 1}</TableCell>
                <TableCell className="font-medium text-foreground">{row.departmentName}</TableCell>
                <TableCell className="text-right">{row.employeeCount.toLocaleString("en-PH")}</TableCell>
                {mode === "late" ? (
                  <>
                    <TableCell className="text-right">{row.lateMins.toLocaleString("en-PH")}</TableCell>
                    <TableCell className="text-right">{(row.lateDays ?? 0).toLocaleString("en-PH")}</TableCell>
                    <TableCell className="text-right">{toCurrencyLabel(row.tardinessDeductionAmount)}</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-right">{numberFormatter.format(row.overtimeHours)}</TableCell>
                    <TableCell className="text-right">{(row.overtimeDays ?? 0).toLocaleString("en-PH")}</TableCell>
                    <TableCell className="text-right">{toCurrencyLabel(row.overtimePayAmount)}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePaginationFooter
        page={safePage}
        totalPages={totalPages}
        pageSize={TABLE_PAGE_SIZE}
        totalItems={rows.length}
        onPrevious={() => setPage((previous) => Math.max(Math.min(previous, totalPages) - 1, 1))}
        onNext={() => setPage((previous) => Math.min(Math.min(previous, totalPages) + 1, totalPages))}
      />
    </div>
  )
}

function TablePaginationFooter({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPrevious,
  onNext,
}: {
  page: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPrevious: () => void
  onNext: () => void
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs">
      <p className="text-muted-foreground">
        Showing {start}-{end} of {totalItems} records • Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={page <= 1} onClick={onPrevious}>
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
