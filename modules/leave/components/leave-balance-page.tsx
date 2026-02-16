"use client"

import { motion } from "framer-motion"
import {
  IconChevronLeft,
  IconChevronRight,
  IconCalendarStats,
  IconChartBar,
  IconClockHour4,
  IconFilter,
  IconHistory,
  IconPrinter,
  IconRoute,
  IconSearch,
  IconTimeline,
  IconUserCircle,
  IconUsersGroup,
} from "@tabler/icons-react"
import { RequestStatus } from "@prisma/client"
import Link from "next/link"
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getPhMonthIndex, getPhYear } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import { getLeaveBalanceHistoryPageAction } from "@/modules/leave/actions/get-leave-balance-history-page-action"
import type {
  LeaveBalanceWorkspaceHistoryPage,
  LeaveBalanceWorkspaceRow,
} from "@/modules/leave/types/leave-domain-types"

type Props = {
  companyId: string
  selectedYear: number
  years: number[]
  balanceRows: LeaveBalanceWorkspaceRow[]
  statusCodes: RequestStatus[]
}

const days = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateLabel = new Intl.DateTimeFormat("en-PH", { month: "short", day: "2-digit", year: "numeric", timeZone: "Asia/Manila" })
const monthLabel = new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "Asia/Manila" })

const toStatusLabel = (status: string): string => status.replace(/_/g, " ")
const normalizeLeaveType = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "")
const HISTORY_PAGE_SIZE = 10

const buildEmptyHistoryPage = (): LeaveBalanceWorkspaceHistoryPage => ({
  rows: [],
  page: 1,
  pageSize: HISTORY_PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
  hasPrevPage: false,
  hasNextPage: false,
  monthlyTotals: Array.from({ length: 12 }, (_, month) => ({ month, filed: 0, used: 0 })),
})

const leaveHistoryStatusBadgeClass = (status: string): string => {
  if (status === "APPROVED" || status === "SUPERVISOR_APPROVED") {
    return "border-emerald-700 bg-emerald-600 text-white"
  }

  if (status === "REJECTED") {
    return "border-destructive/50 bg-destructive/10 text-destructive"
  }

  return "border-border bg-muted text-foreground"
}

export function LeaveBalancePage({ companyId, selectedYear, years, balanceRows, statusCodes }: Props) {
  const [search, setSearch] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [timelineWindowStart, setTimelineWindowStart] = useState(0)
  const [timelineSelectedMonth, setTimelineSelectedMonth] = useState(() => {
    const currentPhYear = getPhYear()
    return currentPhYear === selectedYear ? getPhMonthIndex() : 0
  })
  const [historyPageState, setHistoryPageState] = useState<{ key: string; page: number }>({
    key: "",
    page: 1,
  })
  const [historyPageData, setHistoryPageData] = useState<LeaveBalanceWorkspaceHistoryPage>(() => buildEmptyHistoryPage())
  const latestHistoryRequestRef = useRef(0)
  const deferredSearch = useDeferredValue(search)

  const {
    departments,
    leaveTypes,
    employees,
    balanceRowsByEmployee,
    leaveTypesByEmployee,
  } = useMemo(() => {
    const departmentSet = new Set<string>()
    const leaveTypeSet = new Set<string>()
    const employeeMap = new Map<
      string,
      {
        employeeId: string
        employeeName: string
        employeeNumber: string
        photoUrl: string | null
        departmentName: string
      }
    >()
    const balanceRowsMap = new Map<string, LeaveBalanceWorkspaceRow[]>()
    const leaveTypeMap = new Map<string, Set<string>>()

    for (const row of balanceRows) {
      departmentSet.add(row.departmentName)
      leaveTypeSet.add(row.leaveTypeName)

      if (!employeeMap.has(row.employeeId)) {
        employeeMap.set(row.employeeId, {
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          employeeNumber: row.employeeNumber,
          photoUrl: row.photoUrl,
          departmentName: row.departmentName,
        })
      }

      const employeeBalanceRows = balanceRowsMap.get(row.employeeId) ?? []
      employeeBalanceRows.push(row)
      balanceRowsMap.set(row.employeeId, employeeBalanceRows)

      const employeeLeaveTypes = leaveTypeMap.get(row.employeeId) ?? new Set<string>()
      employeeLeaveTypes.add(row.leaveTypeName)
      leaveTypeMap.set(row.employeeId, employeeLeaveTypes)
    }

    for (const rows of balanceRowsMap.values()) {
      rows.sort((a, b) => a.leaveTypeName.localeCompare(b.leaveTypeName))
    }

    return {
      departments: Array.from(departmentSet).sort((a, b) => a.localeCompare(b)),
      leaveTypes: Array.from(leaveTypeSet).sort((a, b) => a.localeCompare(b)),
      employees: Array.from(employeeMap.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
      balanceRowsByEmployee: balanceRowsMap,
      leaveTypesByEmployee: leaveTypeMap,
    }
  }, [balanceRows])

  const statuses = useMemo(() => [...statusCodes].sort((a, b) => a.localeCompare(b)), [statusCodes])

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()
    return employees.filter((employee) => {
      const matchesSearch = `${employee.employeeName} ${employee.employeeNumber}`.toLowerCase().includes(normalizedSearch)
      const matchesDepartment = departmentFilter === "all" || employee.departmentName === departmentFilter
      const employeeLeaveTypes = leaveTypesByEmployee.get(employee.employeeId)
      const matchesLeaveType = leaveTypeFilter === "all" || employeeLeaveTypes?.has(leaveTypeFilter) === true
      return matchesSearch && matchesDepartment && matchesLeaveType
    })
  }, [employees, deferredSearch, departmentFilter, leaveTypeFilter, leaveTypesByEmployee])

  const resolvedSelectedEmployeeId = useMemo(() => {
    if (!filteredEmployees.length) return null
    if (selectedEmployeeId && filteredEmployees.some((employee) => employee.employeeId === selectedEmployeeId)) {
      return selectedEmployeeId
    }
    return filteredEmployees[0].employeeId
  }, [filteredEmployees, selectedEmployeeId])

  const selectedEmployee = useMemo(
    () => filteredEmployees.find((employee) => employee.employeeId === resolvedSelectedEmployeeId) ?? null,
    [filteredEmployees, resolvedSelectedEmployeeId]
  )

  const selectedEmployeeAllBalanceRows = useMemo(() => {
    if (!selectedEmployee) return []
    return balanceRowsByEmployee.get(selectedEmployee.employeeId) ?? []
  }, [selectedEmployee, balanceRowsByEmployee])

  const historyQueryKey = `${resolvedSelectedEmployeeId ?? "none"}|${leaveTypeFilter}|${statusFilter}|${selectedYear}`
  const effectiveHistoryPage = historyPageState.key === historyQueryKey ? historyPageState.page : 1

  useEffect(() => {
    if (!resolvedSelectedEmployeeId) return

    const requestId = latestHistoryRequestRef.current + 1
    latestHistoryRequestRef.current = requestId

    void (async () => {
      const result = await getLeaveBalanceHistoryPageAction({
        companyId,
        year: selectedYear,
        employeeId: resolvedSelectedEmployeeId,
        leaveType: leaveTypeFilter === "all" ? undefined : leaveTypeFilter,
        statusCode: statusFilter === "all" ? undefined : statusFilter,
        page: effectiveHistoryPage,
        pageSize: HISTORY_PAGE_SIZE,
      })

      if (requestId !== latestHistoryRequestRef.current) return

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setHistoryPageData(result.data)
    })()
  }, [companyId, selectedYear, resolvedSelectedEmployeeId, leaveTypeFilter, statusFilter, effectiveHistoryPage])

  const selectedHistoryRows = historyPageData.rows

  const selectedHistoryDisplayRows = useMemo(
    () =>
      selectedHistoryRows.map((row) => ({
        ...row,
        startDateLabel: dateLabel.format(new Date(row.startDateIso)),
        endDateLabel: dateLabel.format(new Date(row.endDateIso)),
        filedDateLabel: dateLabel.format(new Date(row.createdAtIso)),
      })),
    [selectedHistoryRows]
  )

  const leaveTypeStatValues = useMemo(() => {
    const getByType = (matcher: (normalized: string) => boolean): number => {
      return selectedEmployeeAllBalanceRows
        .filter((row) => matcher(normalizeLeaveType(row.leaveTypeName)))
        .reduce((sum, row) => sum + row.availableBalance, 0)
    }

    return {
      vacationLeave: getByType((normalized) => normalized.includes("vacation") && normalized.includes("leave")),
      sickLeave: getByType((normalized) => normalized.includes("sick") && normalized.includes("leave")),
      mandatoryLeave: getByType((normalized) => normalized.includes("mandatory") && normalized.includes("leave")),
      compensaryTimeOff: getByType((normalized) => normalized.includes("cto") || (normalized.includes("compensatory") && normalized.includes("time") && normalized.includes("off"))),
    }
  }, [selectedEmployeeAllBalanceRows])

  const historyByMonth = useMemo(() => {
    return historyPageData.monthlyTotals
  }, [historyPageData.monthlyTotals])

  const maxMonth = useMemo(() => historyByMonth.reduce((max, item) => Math.max(max, item.filed), 0), [historyByMonth])
  const TIMELINE_WINDOW = 6
  const maxTimelineWindowStart = Math.max(historyByMonth.length - TIMELINE_WINDOW, 0)
  const safeTimelineWindowStart = Math.min(timelineWindowStart, maxTimelineWindowStart)
  const visibleTimelineMonths = historyByMonth.slice(safeTimelineWindowStart, safeTimelineWindowStart + TIMELINE_WINDOW)
  const currentMonthIndex = getPhMonthIndex()
  const currentYear = getPhYear()

  const handleTimelineNext = () => {
    if (timelineSelectedMonth >= historyByMonth.length - 1) return
    const nextMonth = timelineSelectedMonth + 1
    setTimelineSelectedMonth(nextMonth)
    if (nextMonth > safeTimelineWindowStart + TIMELINE_WINDOW - 1) {
      setTimelineWindowStart((current) => Math.min(current + 1, maxTimelineWindowStart))
    }
  }

  const handleTimelinePrevious = () => {
    if (timelineSelectedMonth <= 0) return
    const previousMonth = timelineSelectedMonth - 1
    setTimelineSelectedMonth(previousMonth)
    if (previousMonth < safeTimelineWindowStart) {
      setTimelineWindowStart((current) => Math.max(current - 1, 0))
    }
  }

  const selectedMonthMetrics = historyByMonth[timelineSelectedMonth] ?? { month: timelineSelectedMonth, filed: 0, used: 0 }
  const selectedMonthText = monthLabel.format(new Date(Date.UTC(selectedYear, timelineSelectedMonth, 1)))
  const totalEmployeeCount = employees.length
  const filteredEmployeeCount = filteredEmployees.length

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <section className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Timekeeping</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconUsersGroup className="size-6 text-primary" /> Leave Balances
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                {selectedYear}
              </Badge>
              <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                {filteredEmployeeCount}/{totalEmployeeCount} Employees
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Track employee balances with timeline trends and filtered leave history.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {years.map((year) => (
              <Button key={year} asChild size="sm" variant={year === selectedYear ? "default" : "outline"} className="h-8 px-2">
                <Link href={`/${companyId}/leave/balances?year=${year}`}>{year}</Link>
              </Button>
            ))}
            <Button asChild variant="outline" size="sm" className="h-8 px-2">
              <Link href={`/${companyId}/leave/balances/report?year=${selectedYear}`}>
                <IconPrinter className="size-4" /> Leave Balance Summary Report
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid border-y border-border/60 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-border/60 p-4 sm:p-5">
          <div className="space-y-3 border border-border/60 bg-background p-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <IconFilter className="size-4" /> Employee Directory
            </p>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or number"
                className="h-8 pl-8"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Leave Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leave Types</SelectItem>
                {leaveTypes.map((leaveType) => (
                  <SelectItem key={leaveType} value={leaveType}>
                    {leaveType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as RequestStatus | "all")}>
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Request Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {toStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 border border-border/60 bg-background">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Employees</p>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {filteredEmployeeCount}
              </Badge>
            </div>
            <ScrollArea className="h-[540px] p-2">
              {filteredEmployees.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">No employees match current filters.</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredEmployees.map((employee) => {
                    const isActive = employee.employeeId === selectedEmployee?.employeeId
                    return (
                      <button
                        key={employee.employeeId}
                        type="button"
                        className={cn(
                          "w-full border px-2.5 py-2 text-left",
                          isActive
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/60 bg-background hover:bg-muted/30"
                        )}
                        onClick={() => setSelectedEmployeeId(employee.employeeId)}
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="h-9 w-9 shrink-0 rounded-md border border-border/60 after:rounded-md [&_*]:rounded-md">
                            <AvatarImage src={employee.photoUrl ?? undefined} alt={employee.employeeName} className="h-full w-full object-cover" />
                            <AvatarFallback className="bg-primary/5 text-[10px] font-semibold text-primary">
                              {employee.employeeName
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{employee.employeeName}</p>
                            <p className="truncate text-xs text-muted-foreground">{employee.employeeNumber}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </aside>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex min-h-[calc(100vh-220px)] flex-col gap-4 p-4 sm:p-5"
        >
          {!selectedEmployee ? (
            <section className="border border-border/60 bg-background px-4 py-12 text-center text-sm text-muted-foreground">
              Select an employee from the directory to view leave balances and history.
            </section>
          ) : (
            <>
              <section className="border border-border/60 bg-background px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-12 w-12 rounded-md border border-border/60 after:rounded-md [&_*]:rounded-md">
                      <AvatarImage src={selectedEmployee.photoUrl ?? undefined} alt={selectedEmployee.employeeName} className="h-full w-full object-cover" />
                      <AvatarFallback className="bg-primary/5 text-sm font-semibold text-primary">
                        {selectedEmployee.employeeName
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <IconUserCircle className="size-3.5" /> Selected Employee
                      </p>
                      <p className="truncate text-lg font-semibold text-foreground">{selectedEmployee.employeeName}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {selectedEmployee.employeeNumber} - {selectedEmployee.departmentName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-6 px-2 text-[11px]">
                      {selectedMonthText}
                    </Badge>
                    <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                      Filed {days.format(selectedMonthMetrics.filed)}
                    </Badge>
                  </div>
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Vacation Leave" value={days.format(leaveTypeStatValues.vacationLeave)} icon={IconCalendarStats} />
                <StatCard title="Sick Leave" value={days.format(leaveTypeStatValues.sickLeave)} icon={IconHistory} />
                <StatCard title="Mandatory Leave" value={days.format(leaveTypeStatValues.mandatoryLeave)} icon={IconChartBar} />
                <StatCard title="Compensary Time Off" value={days.format(leaveTypeStatValues.compensaryTimeOff)} icon={IconClockHour4} />
              </div>

              <section className="border border-border/60 bg-background">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                  <p className="inline-flex items-center gap-2 text-sm font-medium">
                    <IconRoute className="size-4" /> Leave Journey Timeline
                  </p>
                  <p className="text-xs text-muted-foreground">Use the controls to navigate yearly trends.</p>
                </div>
                <div className="space-y-3 p-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {visibleTimelineMonths.map((item) => {
                      const isCurrentMonth = selectedYear === currentYear && item.month === currentMonthIndex
                      const isSelectedMonth = item.month === timelineSelectedMonth
                      return (
                        <button
                          key={item.month}
                          type="button"
                          onClick={() => setTimelineSelectedMonth(item.month)}
                          className={cn(
                            "min-w-0 border px-2 py-2 text-left transition-colors",
                            isSelectedMonth ? "border-primary bg-primary text-primary-foreground" : "border-border/60 hover:bg-muted/30",
                            !isSelectedMonth && isCurrentMonth ? "border-primary/50" : ""
                          )}
                        >
                          <p className={cn("text-[11px]", isSelectedMonth ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            {monthLabel.format(new Date(Date.UTC(selectedYear, item.month, 1)))}
                          </p>
                          <p className="text-sm font-semibold">Filed {days.format(item.filed)}</p>
                          <p className={cn("text-[11px]", isSelectedMonth ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            Used {days.format(item.used)}
                          </p>
                          <div className="mt-1 h-1.5 bg-muted">
                            <div
                              className={cn("h-1.5", isSelectedMonth ? "bg-blue-600" : "bg-primary")}
                              style={{ width: `${maxMonth > 0 ? (item.filed / maxMonth) * 100 : 0}%` }}
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      disabled={timelineSelectedMonth <= 0}
                      onClick={handleTimelinePrevious}
                    >
                      <IconChevronLeft className="size-4" /> Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      disabled={timelineSelectedMonth >= historyByMonth.length - 1}
                      onClick={handleTimelineNext}
                    >
                      Next <IconChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </section>

              <section className="flex flex-1 flex-col border border-border/60 bg-background">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                  <p className="inline-flex items-center gap-2 text-sm font-medium">
                    <IconTimeline className="size-4" /> Employee Leave History
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Page {historyPageData.page} of {historyPageData.totalPages} - {historyPageData.totalItems} records
                  </p>
                </div>
                <div className="flex-1 space-y-3 p-4">
                  {selectedHistoryRows.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No leave history for the current filters.</p>
                  ) : (
                    <>
                      <div className="hidden border border-border/60 md:block">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-muted/30">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Request #</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Leave Type</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Start Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">End Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Days</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Filed Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedHistoryDisplayRows.map((row, index) => (
                                <tr
                                  key={row.id}
                                  className={
                                    index % 2 === 0
                                      ? "border-t border-border/50 bg-background"
                                      : "border-t border-border/50 bg-muted/10"
                                  }
                                >
                                  <td className="px-3 py-2 text-sm font-medium text-foreground">{row.requestNumber}</td>
                                  <td className="px-3 py-2 text-sm text-foreground">{row.leaveTypeName}</td>
                                  <td className="px-3 py-2 text-sm text-muted-foreground">{row.startDateLabel}</td>
                                  <td className="px-3 py-2 text-sm text-muted-foreground">{row.endDateLabel}</td>
                                  <td className="px-3 py-2 text-sm text-foreground">{days.format(row.numberOfDays)}</td>
                                  <td className="px-3 py-2 text-sm text-muted-foreground">{row.filedDateLabel}</td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline" className={cn("h-6 px-2 text-[10px]", leaveHistoryStatusBadgeClass(row.statusCode))}>
                                      {toStatusLabel(row.statusCode)}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-2 md:hidden">
                        {selectedHistoryDisplayRows.map((row) => (
                          <article key={row.id} className="border border-border/60 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{row.requestNumber}</p>
                                <p className="text-sm text-muted-foreground">{row.leaveTypeName}</p>
                              </div>
                              <Badge variant="outline" className={cn("h-6 px-2 text-[10px]", leaveHistoryStatusBadgeClass(row.statusCode))}>
                                {toStatusLabel(row.statusCode)}
                              </Badge>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Start</p>
                                <p className="text-foreground">{row.startDateLabel}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">End</p>
                                <p className="text-foreground">{row.endDateLabel}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Days</p>
                                <p className="text-foreground">{days.format(row.numberOfDays)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Filed</p>
                                <p className="text-foreground">{row.filedDateLabel}</p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <p className="text-xs text-muted-foreground">
                      Page {historyPageData.page} of {historyPageData.totalPages} - {historyPageData.totalItems} records
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        disabled={!historyPageData.hasPrevPage}
                        onClick={() =>
                          setHistoryPageState({
                            key: historyQueryKey,
                            page: Math.max(1, historyPageData.page - 1),
                          })
                        }
                      >
                        Prev
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        disabled={!historyPageData.hasNextPage}
                        onClick={() =>
                          setHistoryPageState({
                            key: historyQueryKey,
                            page: Math.min(historyPageData.totalPages, historyPageData.page + 1),
                          })
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </motion.section>
      </div>
    </main>
  )
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof IconChartBar }) {
  return (
    <div className="border border-border/60 bg-background px-3 py-2">
      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  )
}
