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
import Link from "next/link"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type {
  LeaveBalanceWorkspaceHistoryRow,
  LeaveBalanceWorkspaceRow,
} from "@/modules/leave/types/leave-domain-types"

type Props = {
  companyId: string
  selectedYear: number
  years: number[]
  balanceRows: LeaveBalanceWorkspaceRow[]
  historyRows: LeaveBalanceWorkspaceHistoryRow[]
}

const days = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateLabel = new Intl.DateTimeFormat("en-PH", { month: "short", day: "2-digit", year: "numeric", timeZone: "Asia/Manila" })
const monthLabel = new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "Asia/Manila" })

const toStatusLabel = (status: string): string => status.replace(/_/g, " ")
const normalizeLeaveType = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "")

export function LeaveBalanceLayoutIterations({ companyId, selectedYear, years, balanceRows, historyRows }: Props) {
  const [search, setSearch] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [timelineWindowStart, setTimelineWindowStart] = useState(0)
  const [timelineSelectedMonth, setTimelineSelectedMonth] = useState(() => {
    const now = new Date()
    return now.getFullYear() === selectedYear ? now.getMonth() : 0
  })

  const departments = useMemo(
    () => Array.from(new Set(balanceRows.map((row) => row.departmentName))).sort((a, b) => a.localeCompare(b)),
    [balanceRows]
  )
  const leaveTypes = useMemo(
    () => Array.from(new Set(balanceRows.map((row) => row.leaveTypeName))).sort((a, b) => a.localeCompare(b)),
    [balanceRows]
  )
  const statuses = useMemo(
    () => Array.from(new Set(historyRows.map((row) => row.statusCode))).sort((a, b) => a.localeCompare(b)),
    [historyRows]
  )

  const employees = useMemo(() => {
    const map = new Map<
      string,
      {
        employeeId: string
        employeeName: string
        employeeNumber: string
        photoUrl: string | null
        departmentName: string
      }
    >()

    for (const row of balanceRows) {
      const current = map.get(row.employeeId) ?? {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        employeeNumber: row.employeeNumber,
        photoUrl: row.photoUrl,
        departmentName: row.departmentName,
      }
      map.set(row.employeeId, current)
    }

    return Array.from(map.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  }, [balanceRows])

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesSearch = `${employee.employeeName} ${employee.employeeNumber}`.toLowerCase().includes(search.toLowerCase())
      const matchesDepartment = departmentFilter === "all" || employee.departmentName === departmentFilter
      const employeeLeaveRows = balanceRows.filter((row) => row.employeeId === employee.employeeId)
      const matchesLeaveType = leaveTypeFilter === "all" || employeeLeaveRows.some((row) => row.leaveTypeName === leaveTypeFilter)
      return matchesSearch && matchesDepartment && matchesLeaveType
    })
  }, [employees, search, departmentFilter, leaveTypeFilter, balanceRows])

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
    return balanceRows
      .filter((row) => row.employeeId === selectedEmployee.employeeId)
      .sort((a, b) => a.leaveTypeName.localeCompare(b.leaveTypeName))
  }, [selectedEmployee, balanceRows])

  const selectedHistoryRows = useMemo(() => {
    if (!selectedEmployee) return []
    return historyRows
      .filter((row) => row.employeeId === selectedEmployee.employeeId)
      .filter((row) => leaveTypeFilter === "all" || row.leaveTypeName === leaveTypeFilter)
      .filter((row) => statusFilter === "all" || row.statusCode === statusFilter)
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
  }, [selectedEmployee, historyRows, leaveTypeFilter, statusFilter])

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
    const monthMap = new Map<number, { used: number; filed: number }>()
    for (let i = 0; i < 12; i += 1) monthMap.set(i, { used: 0, filed: 0 })
    for (const row of selectedHistoryRows) {
      const month = new Date(row.startDateIso).getUTCMonth()
      const current = monthMap.get(month)!
      current.filed += row.numberOfDays
      if (row.statusCode === "APPROVED" || row.statusCode === "SUPERVISOR_APPROVED") current.used += row.numberOfDays
      monthMap.set(month, current)
    }
    return Array.from(monthMap.entries()).map(([month, value]) => ({ month, ...value }))
  }, [selectedHistoryRows])

  const maxMonth = useMemo(() => historyByMonth.reduce((max, item) => Math.max(max, item.filed), 0), [historyByMonth])
  const TIMELINE_WINDOW = 6
  const maxTimelineWindowStart = Math.max(historyByMonth.length - TIMELINE_WINDOW, 0)
  const safeTimelineWindowStart = Math.min(timelineWindowStart, maxTimelineWindowStart)
  const visibleTimelineMonths = historyByMonth.slice(safeTimelineWindowStart, safeTimelineWindowStart + TIMELINE_WINDOW)
  const today = new Date()
  const currentMonthIndex = today.getMonth()
  const currentYear = today.getFullYear()

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

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconUsersGroup className="size-5" /> Leave Balance</h1>
            <p className="text-xs text-muted-foreground">Employee directory with filters, timeline, and leave history drilldown.</p>
          </div>
          <div className="flex gap-2">
            {years.map((year) => (
              <Button key={year} asChild size="sm" variant={year === selectedYear ? "default" : "outline"}>
                <Link href={`/${companyId}/leave/balances?year=${year}`}>{year}</Link>
              </Button>
            ))}
            <Button asChild variant="outline" size="sm">
              <Link href={`/${companyId}/leave/balances/report?year=${selectedYear}`}>
                <IconPrinter className="mr-1.5 size-4" /> Leave Balance Summary Report
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-sm"><IconFilter className="size-4" /> Employee Directory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee" className="pl-8" />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department} value={department}>{department}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Leave Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leave Types</SelectItem>
                {leaveTypes.map((leaveType) => (
                  <SelectItem key={leaveType} value={leaveType}>{leaveType}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Request Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>{toStatusLabel(status)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="max-h-[560px] space-y-1 overflow-auto rounded-lg border border-border/60 p-1">
              {filteredEmployees.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">No employees match current filters.</p>
              ) : (
                filteredEmployees.map((employee) => {
                  const isActive = employee.employeeId === selectedEmployee?.employeeId
                  return (
                    <button
                      key={employee.employeeId}
                      type="button"
                      className={cn(
                        "w-full rounded-md border px-2 py-2 text-left transition-colors",
                        isActive ? "border-primary bg-primary/10" : "border-border/50 hover:bg-muted/40"
                      )}
                      onClick={() => setSelectedEmployeeId(employee.employeeId)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-10 w-9 shrink-0 !rounded-md border border-border/60 after:!rounded-md">
                          <AvatarImage src={employee.photoUrl ?? undefined} alt={employee.employeeName} className="!aspect-auto h-full w-full !rounded-md object-cover" />
                          <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
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
                          <p className="truncate text-[11px] text-muted-foreground">{employee.employeeNumber} - {employee.departmentName}</p>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex min-h-[calc(100vh-220px)] flex-col gap-4"
        >
          {!selectedEmployee ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Select an employee from the sidebar.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                  <div>
                    <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-muted-foreground"><IconUserCircle className="size-3.5" /> Selected Employee</p>
                    <p className="text-lg font-semibold text-foreground">{selectedEmployee.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{selectedEmployee.employeeNumber} - {selectedEmployee.departmentName}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Timeline Drilldown</Badge>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Vacation Leave" value={days.format(leaveTypeStatValues.vacationLeave)} icon={IconCalendarStats} />
                <StatCard title="Sick Leave" value={days.format(leaveTypeStatValues.sickLeave)} icon={IconHistory} />
                <StatCard title="Mandatory Leave" value={days.format(leaveTypeStatValues.mandatoryLeave)} icon={IconChartBar} />
                <StatCard title="Compensary Time Off" value={days.format(leaveTypeStatValues.compensaryTimeOff)} icon={IconClockHour4} />
              </div>

              <Card>
                <CardHeader><CardTitle className="inline-flex items-center gap-2 text-sm"><IconRoute className="size-4" /> Leave Journey Timeline</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="overflow-hidden">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      {visibleTimelineMonths.map((item) => {
                        const isCurrentMonth = selectedYear === currentYear && item.month === currentMonthIndex
                        const isSelectedMonth = item.month === timelineSelectedMonth
                        return (
                          <motion.div
                            key={item.month}
                            layout
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className={cn(
                              "min-w-0 rounded-md border border-border/60 p-2",
                              isSelectedMonth ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary" : "",
                              !isSelectedMonth && isCurrentMonth ? "border-primary/40" : ""
                            )}
                          >
                            <p className={cn("text-[11px]", isSelectedMonth ? "text-primary-foreground/80" : "text-muted-foreground")}>{monthLabel.format(new Date(Date.UTC(selectedYear, item.month, 1)))}</p>
                            <p className="text-sm font-semibold">Filed {days.format(item.filed)}</p>
                            <p className={cn("text-[11px]", isSelectedMonth ? "text-primary-foreground/80" : "text-muted-foreground")}>Used {days.format(item.used)}</p>
                            <div className="mt-1 h-1.5 rounded-full bg-muted">
                              <div
                                className={cn("h-1.5 rounded-full", isSelectedMonth ? "bg-blue-600" : "bg-primary")}
                                style={{ width: `${maxMonth > 0 ? (item.filed / maxMonth) * 100 : 0}%` }}
                              />
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={timelineSelectedMonth <= 0}
                      onClick={handleTimelinePrevious}
                    >
                      <IconChevronLeft className="mr-1 size-4" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={timelineSelectedMonth >= historyByMonth.length - 1}
                      onClick={handleTimelineNext}
                    >
                      Next
                      <IconChevronRight className="ml-1 size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex flex-1 flex-col">
                <CardHeader><CardTitle className="inline-flex items-center gap-2 text-sm"><IconTimeline className="size-4" /> Employee Leave History</CardTitle></CardHeader>
                <CardContent className="flex-1 space-y-2 overflow-y-auto">
                  {selectedHistoryRows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No leave history for current filters.</p>
                  ) : (
                    selectedHistoryRows.map((row) => (
                      <motion.div
                        key={row.id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-md border border-border/60 px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{row.requestNumber} - {row.leaveTypeName}</p>
                          <Badge variant={row.statusCode === "REJECTED" ? "destructive" : "secondary"}>{toStatusLabel(row.statusCode)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{dateLabel.format(new Date(row.startDateIso))} to {dateLabel.format(new Date(row.endDateIso))} - {days.format(row.numberOfDays)} days</p>
                      </motion.div>
                    ))
                  )}
                </CardContent>
              </Card>

            </>
          )}
        </motion.section>
      </div>
    </main>
  )
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof IconChartBar }) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><Icon className="size-3.5" /> {title}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
