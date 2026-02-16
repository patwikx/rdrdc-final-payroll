"use client"

import { useEffect, useMemo, useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsDown,
  IconCoffee,
  IconSearch,
  IconUser,
} from "@tabler/icons-react"
import { AttendanceStatus } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toPhDayStartUtcInstant } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import { getDtrEmployeesAction } from "@/modules/attendance/dtr/actions/get-dtr-employees-action"
import { getEmployeeDtrLogsAction } from "@/modules/attendance/dtr/actions/get-employee-dtr-logs-action"
import { getEmployeeLeaveOverlaysAction } from "@/modules/attendance/dtr/actions/get-employee-leave-overlays-action"
import { ModifyDtrSheet } from "@/modules/attendance/dtr/components/modify-dtr-sheet"
import type { DtrLogItem, LeaveOverlayItem } from "@/modules/attendance/dtr/types"
import { formatWallClockLabel } from "@/modules/attendance/dtr/utils/wall-clock"

type EmployeeDtrCalendarProps = {
  companyId: string
  leaveOverlays: LeaveOverlayItem[]
}

type EmployeeWithSchedule = {
  id: string
  firstName: string
  lastName: string
  employeeNumber: string
  workSchedule: {
    id: string
    name: string
    restDays: unknown
  } | null
}

const DAY_INDEX_TO_NAME: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
}

const toLocalDateString = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const formatTimeLabel = (value: string | null): string => {
  return formatWallClockLabel(value).replace("--:--", "MISSED")
}

const formatOvertimeLabel = (hours: number): string => {
  if (hours <= 0) return "0m"
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return `${hours.toFixed(2)}h`
}

const NEUTRAL_METRIC_BADGE_CLASS = "h-4 min-w-0 justify-center border-none bg-muted px-1 py-0 text-[9px] font-medium text-muted-foreground"
const RED_METRIC_BADGE_CLASS = "h-4 min-w-0 justify-center border-none bg-red-500 px-1 py-0 text-[9px] font-medium text-white"
const YELLOW_METRIC_BADGE_CLASS = "h-4 min-w-0 justify-center border-none bg-yellow-500 px-1 py-0 text-[9px] font-medium text-black"

const calendarStatusClass = (status: AttendanceStatus): string => {
  if (status === AttendanceStatus.PRESENT) {
    return "bg-green-500 text-white"
  }

  if (status === AttendanceStatus.ABSENT || status === AttendanceStatus.AWOL) {
    return "bg-red-500 text-white"
  }

  if (status === AttendanceStatus.ON_LEAVE) {
    return "bg-purple-500 text-white"
  }

  return "bg-slate-500 text-white"
}

export function EmployeeDtrCalendar({ companyId, leaveOverlays }: EmployeeDtrCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [employees, setEmployees] = useState<EmployeeWithSchedule[]>([])
  const [logs, setLogs] = useState<DtrLogItem[]>([])
  const [employeeLeaveOverlays, setEmployeeLeaveOverlays] = useState<LeaveOverlayItem[]>([])
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<DtrLogItem | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calendarStartDate = startOfWeek(monthStart)
  const calendarEndDate = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: calendarStartDate, end: calendarEndDate })

  const leaveOverlaysByEmployeeId = useMemo(() => {
    const useEmployeeOverlays =
      Boolean(selectedEmployeeId) &&
      employeeLeaveOverlays.length > 0 &&
      employeeLeaveOverlays.every((overlay) => overlay.employeeId === selectedEmployeeId)

    const source = useEmployeeOverlays ? employeeLeaveOverlays : leaveOverlays
    const map = new Map<string, LeaveOverlayItem[]>()
    for (const leave of source) {
      const items = map.get(leave.employeeId) ?? []
      items.push(leave)
      map.set(leave.employeeId, items)
    }
    return map
  }, [employeeLeaveOverlays, leaveOverlays, selectedEmployeeId])

  const currentRange = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(start)
    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    }
  }, [currentMonth])

  useEffect(() => {
    getDtrEmployeesAction(companyId).then((result) => {
      if (result.ok) {
        setEmployees(result.data)
      }
    })
  }, [companyId])

  useEffect(() => {
    if (!selectedEmployeeId) return

    getEmployeeDtrLogsAction({
      companyId,
      employeeId: selectedEmployeeId,
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
    }).then((result) => {
      if (result.ok) {
        setLogs(result.data)
      }
    })
  }, [companyId, currentRange.endDate, currentRange.startDate, selectedEmployeeId])

  useEffect(() => {
    if (!selectedEmployeeId) return

    getEmployeeLeaveOverlaysAction({
      companyId,
      employeeId: selectedEmployeeId,
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
    }).then((result) => {
      if (result.ok) {
        setEmployeeLeaveOverlays(result.data)
      }
    })
  }, [companyId, currentRange.endDate, currentRange.startDate, selectedEmployeeId])

  const restDays = useMemo(() => {
    const employee = employees.find((item) => item.id === selectedEmployeeId)
    if (!employee?.workSchedule?.restDays || !Array.isArray(employee.workSchedule.restDays)) {
      return ["SATURDAY", "SUNDAY"]
    }

    const parsed = employee.workSchedule.restDays.filter((item): item is string => typeof item === "string")
    return parsed.length > 0 ? parsed : ["SATURDAY", "SUNDAY"]
  }, [employees, selectedEmployeeId])

  const getDayLog = (day: Date): DtrLogItem | undefined => {
    const key = toLocalDateString(day)
    return logs.find((log) => toLocalDateString(new Date(log.attendanceDate)) === key)
  }

  const findLeaveForDate = (employeeId: string, day: Date): LeaveOverlayItem | undefined => {
    const leaves = leaveOverlaysByEmployeeId.get(employeeId) ?? []
    const dateKey = toLocalDateString(day)
    return leaves.find((leave) => dateKey >= toLocalDateString(new Date(leave.startDate)) && dateKey <= toLocalDateString(new Date(leave.endDate)))
  }

  const isRestDay = (day: Date): boolean => {
    return restDays.includes(DAY_INDEX_TO_NAME[getDay(day)])
  }

  const selectedEmployee = employees.find((item) => item.id === selectedEmployeeId)

  const createDraftRecord = (day: Date, status: AttendanceStatus = AttendanceStatus.PRESENT): DtrLogItem | null => {
    if (!selectedEmployee) return null

    const dateKey = toLocalDateString(day)
    const attendanceDate = toPhDayStartUtcInstant(dateKey)
    if (!attendanceDate) return null

    return {
      id: `draft-${selectedEmployee.id}-${dateKey}`,
      employeeId: selectedEmployee.id,
      attendanceDate: attendanceDate.toISOString(),
      actualTimeIn: null,
      actualTimeOut: null,
      hoursWorked: 0,
      tardinessMins: 0,
      undertimeMins: 0,
      overtimeHours: 0,
      nightDiffHours: 0,
      attendanceStatus: status,
      approvalStatusCode: "PENDING",
      remarks: null,
      employee: {
        id: selectedEmployee.id,
        firstName: selectedEmployee.firstName,
        lastName: selectedEmployee.lastName,
        employeeNumber: selectedEmployee.employeeNumber,
        photoUrl: null,
      },
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ModifyDtrSheet
        companyId={companyId}
        record={editingRecord}
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false)
          setEditingRecord(null)
          if (!selectedEmployeeId) return

          getEmployeeDtrLogsAction({
            companyId,
            employeeId: selectedEmployeeId,
            startDate: currentRange.startDate,
            endDate: currentRange.endDate,
          }).then((result) => {
            if (result.ok) {
              setLogs(result.data)
            }
          })
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
        <div className="lg:col-span-4 space-y-2">
          <label className="ml-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Employee</label>
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboboxOpen}
                className="w-full h-9 justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <IconUser className="h-4 w-4 text-primary" />
                  {selectedEmployee
                    ? `${selectedEmployee.lastName}, ${selectedEmployee.firstName} (${selectedEmployee.employeeNumber})`
                    : "Select employee..."}
                </div>
                <IconChevronsDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0 border-border/40 shadow-xl" align="start">
              <Command>
                <CommandInput placeholder="Search employee..." className="h-10" />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">No employees found.</CommandEmpty>
                  <CommandGroup>
                    {employees.map((employee) => (
                      <CommandItem
                        key={employee.id}
                        value={`${employee.lastName} ${employee.firstName} ${employee.employeeNumber}`}
                        onSelect={() => {
                          setSelectedEmployeeId(employee.id)
                          setComboboxOpen(false)
                        }}
                        className="text-sm cursor-pointer"
                      >
                        <IconCheck className={cn("mr-2 h-4 w-4", selectedEmployeeId === employee.id ? "opacity-100" : "opacity-0")} />
                        {employee.lastName}, {employee.firstName}
                        <span className="ml-2 text-muted-foreground">({employee.employeeNumber})</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="lg:col-span-4 space-y-2">
          <label className="ml-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Attendance Period</label>
          <div className="flex items-center justify-between h-9 bg-muted/20 border border-border/60 px-3 rounded-md">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{format(currentMonth, "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="lg:col-span-4 flex justify-end gap-3 pb-1">
          <div className="flex items-center gap-4 px-6 h-10 border border-dashed border-border/60 bg-muted/5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-emerald-500 rounded-full" />
              <span className="text-xs text-muted-foreground">Complete</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-red-500 rounded-full" />
              <span className="text-xs text-muted-foreground">Needs Review</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-slate-400 rounded-full" />
              <span className="text-xs text-muted-foreground">Rest Day</span>
            </div>
          </div>
        </div>
      </div>

      {!selectedEmployeeId ? (
        <div className="h-[600px] border-2 border-dashed border-border/60 bg-muted/5 flex flex-col items-center justify-center gap-4 text-center">
          <div className="p-4 bg-background border border-border/60">
            <IconUser className="h-10 w-10 text-muted-foreground/20" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-medium text-foreground/70">Select Employee</h3>
            <p className="text-sm text-muted-foreground/70 max-w-[300px]">Select an employee from the list above to view their attendance calendar.</p>
          </div>
        </div>
      ) : (
        <Card className="rounded-xl border-border/60 shadow-md overflow-hidden bg-background">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-border/60 bg-muted/10">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-3 text-center border-r border-border/60 last:border-r-0">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">{day}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const log = getDayLog(day)
                const inMonth = format(day, "M") === format(currentMonth, "M")
                const dayRestDay = isRestDay(day)
                const leaveOverlay = selectedEmployeeId ? findLeaveForDate(selectedEmployeeId, day) : undefined
                const hasAnomaly = log && (!log.actualTimeIn || !log.actualTimeOut) && !dayRestDay

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => {
                      if (dayRestDay && !log && !leaveOverlay) return
                      if (log) {
                        setEditingRecord(log)
                        setIsSheetOpen(true)
                        return
                      }

                      const draft = createDraftRecord(
                        day,
                        leaveOverlay ? AttendanceStatus.ON_LEAVE : AttendanceStatus.PRESENT
                      )

                      if (draft) {
                        setEditingRecord(draft)
                        setIsSheetOpen(true)
                      }
                    }}
                    className={cn(
                      "min-h-[120px] p-3 border-r border-b border-border/60 group transition-all",
                      !inMonth && "bg-muted/10 opacity-60",
                      isToday(day) && "bg-primary/[0.01]",
                      dayRestDay && "bg-slate-500/[0.03]",
                      !dayRestDay && "cursor-pointer hover:bg-primary/[0.02]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn("text-[11px] font-medium", isToday(day) ? "bg-primary text-primary-foreground px-1.5 py-0.5 rounded" : "text-muted-foreground")}>
                        {format(day, "dd")}
                      </span>
                      {dayRestDay && !log ? <IconCoffee className="h-3 w-3 text-slate-400" /> : null}
                      {log && !dayRestDay ? (
                        hasAnomaly ? <IconSearch className="h-3 w-3 text-red-500" /> : <IconCheck className="h-3 w-3 text-emerald-500" />
                      ) : null}
                    </div>

                    {dayRestDay && !log && !leaveOverlay ? (
                      <Badge className="text-[10px] px-1 py-0 rounded w-full justify-center bg-slate-500/10 text-slate-500 border-none">
                        Rest Day
                      </Badge>
                    ) : log ? (
                      <div className="space-y-1">
                        <div className="text-[11px]">{formatTimeLabel(log.actualTimeIn)}</div>
                        <div className="text-[11px]">{formatTimeLabel(log.actualTimeOut)}</div>
                        <Badge className={`text-[10px] px-1 py-0 rounded w-full justify-center border-none ${calendarStatusClass(log.attendanceStatus)}`}>
                          {log.attendanceStatus.replace(/_/g, " ")}
                        </Badge>
                        <div className="grid grid-cols-3 gap-1">
                          <Badge className={cn(log.tardinessMins > 0 ? RED_METRIC_BADGE_CLASS : NEUTRAL_METRIC_BADGE_CLASS)}>
                            L {log.tardinessMins}m
                          </Badge>
                          <Badge className={cn(log.undertimeMins > 0 ? RED_METRIC_BADGE_CLASS : NEUTRAL_METRIC_BADGE_CLASS)}>
                            U {log.undertimeMins}m
                          </Badge>
                          <Badge className={cn(Number(log.overtimeHours) > 0 ? YELLOW_METRIC_BADGE_CLASS : NEUTRAL_METRIC_BADGE_CLASS)}>
                            O {formatOvertimeLabel(Number(log.overtimeHours))}
                          </Badge>
                        </div>
                      </div>
                    ) : leaveOverlay ? (
                      <Badge className="text-[10px] px-1 py-0 rounded w-full justify-center bg-purple-500/10 text-purple-600 border-none">
                        {leaveOverlay.leaveType.name}
                      </Badge>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
