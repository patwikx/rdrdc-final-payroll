"use client"

import Link from "next/link"
import { useCallback, useDeferredValue, useMemo, useState, useTransition } from "react"
import { DateRange } from "react-day-picker"
import { eachDayOfInterval, format, subDays } from "date-fns"
import { usePathname, useRouter } from "next/navigation"
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconCheckupList,
  IconClock,
  IconDownload,
  IconDots,
  IconRefresh,
  IconSearch,
  IconUserCheck,
  IconUserX,
  IconUsers,
  IconX,
} from "@tabler/icons-react"
import { AttendanceStatus } from "@prisma/client"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { toPhDayStartUtcInstant } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import { exportDtrCsvAction } from "@/modules/attendance/dtr/actions/export-dtr-csv-action"
import { EmployeeDtrCalendar } from "@/modules/attendance/dtr/components/employee-dtr-calendar"
import { ModifyDtrSheet } from "@/modules/attendance/dtr/components/modify-dtr-sheet"
import type { DtrLogItem, LeaveOverlayItem, WorkbenchItem, WorkbenchStats } from "@/modules/attendance/dtr/types"
import { formatWallClockLabel } from "@/modules/attendance/dtr/utils/wall-clock"

type DtrClientPageProps = {
  companyId: string
  logs: DtrLogItem[]
  stats: {
    totalEmployees: number
    presentToday: number
    absentToday: number
  }
  workbenchData: {
    items: WorkbenchItem[]
    stats: WorkbenchStats
  }
  leaveOverlays: LeaveOverlayItem[]
  filters: {
    startDate: string
    endDate: string
  }
}

const toLocalDateString = (value: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)

const formatDatePh = (value: string): string => {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value))

  return formatted.replaceAll("-", ".")
}

const getStatusColor = (status: string): string => {
  switch (status.toUpperCase()) {
    case "PRESENT":
      return "bg-green-500 text-white border-none"
    case "ABSENT":
      return "bg-red-500 text-white border-none"
    case "ON_LEAVE":
      return "bg-purple-500 text-white border-none"
    default:
      return "bg-slate-500 text-white border-none"
  }
}

type DtrViewTab = "directory" | "calendar" | "workbench"
type WorkbenchFilter = "ALL" | "PENDING" | "ANOMALY"

export function DtrClientPage({ companyId, logs, stats, workbenchData, leaveOverlays, filters }: DtrClientPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isRangeRefreshPending, startRangeRefreshTransition] = useTransition()

  const [currentTab, setCurrentTab] = useState<DtrViewTab>("directory")
  const [mountedTabs, setMountedTabs] = useState<Record<DtrViewTab, boolean>>({
    directory: true,
    calendar: false,
    workbench: false,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [wbFilter, setWbFilter] = useState<WorkbenchFilter>("ALL")
  const [wbPage, setWbPage] = useState(1)

  const [editingRecord, setEditingRecord] = useState<DtrLogItem | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [localSearch, setLocalSearch] = useState("")
  const [localWbSearch, setLocalWbSearch] = useState("")
  const deferredSearchTerm = useDeferredValue(localSearch.trim().toLowerCase())
  const deferredWorkbenchSearchTerm = useDeferredValue(localWbSearch.trim().toLowerCase())

  const startParam = filters.startDate
  const endParam = filters.endDate
  const [date, setDate] = useState<DateRange | undefined>({
    from: startParam ? (toPhDayStartUtcInstant(startParam) ?? subDays(new Date(), 30)) : subDays(new Date(), 30),
    to: endParam ? (toPhDayStartUtcInstant(endParam) ?? new Date()) : new Date(),
  })

  const updateDateRange = (range: DateRange | undefined) => {
    setDate(range)
    if (!range?.from || !range.to) return
    setCurrentPage(1)
    setWbPage(1)

    const params = new URLSearchParams()
    params.set("startDate", format(range.from, "yyyy-MM-dd"))
    params.set("endDate", format(range.to, "yyyy-MM-dd"))

    startRangeRefreshTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const setTab = useCallback((tab: DtrViewTab) => {
    setCurrentTab(tab)
    setMountedTabs((previous) => (previous[tab] ? previous : { ...previous, [tab]: true }))
  }, [])

  const logDateKeys = useMemo(() => {
    const keys = new Set<string>()
    logs.forEach((log) => {
      keys.add(`${log.employeeId}-${toLocalDateString(new Date(log.attendanceDate))}`)
    })
    return keys
  }, [logs])

  const leaveRows = useMemo<DtrLogItem[]>(() => {
    const rows: DtrLogItem[] = []
    leaveOverlays.forEach((leave) => {
      const days = eachDayOfInterval({ start: new Date(leave.startDate), end: new Date(leave.endDate) })
      days.forEach((day) => {
        const dateKey = toLocalDateString(day)
        if (logDateKeys.has(`${leave.employeeId}-${dateKey}`)) return
        const attendanceDate = toPhDayStartUtcInstant(dateKey)
        if (!attendanceDate) return

        rows.push({
          id: `leave-${leave.id}-${dateKey}`,
          employeeId: leave.employeeId,
          attendanceDate: attendanceDate.toISOString(),
          actualTimeIn: null,
          actualTimeOut: null,
          hoursWorked: 0,
          tardinessMins: 0,
          undertimeMins: 0,
          overtimeHours: 0,
          nightDiffHours: 0,
          attendanceStatus: AttendanceStatus.ON_LEAVE,
          approvalStatusCode: "APPROVED",
          remarks: leave.leaveType.name,
          employee: {
            id: leave.employee.id,
            firstName: leave.employee.firstName,
            lastName: leave.employee.lastName,
            employeeNumber: leave.employee.employeeNumber,
            photoUrl: leave.employee.photoUrl,
          },
        })
      })
    })
    return rows
  }, [leaveOverlays, logDateKeys])

  const combinedLogs = useMemo(() => {
    return [...logs, ...leaveRows].sort((a, b) => new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime())
  }, [logs, leaveRows])

  const filteredLogs = useMemo(() => {
    if (!deferredSearchTerm) return combinedLogs
    return combinedLogs.filter((log) => {
      const fullName = `${log.employee.firstName} ${log.employee.lastName}`.toLowerCase()
      return fullName.includes(deferredSearchTerm) || log.employee.employeeNumber.toLowerCase().includes(deferredSearchTerm)
    })
  }, [combinedLogs, deferredSearchTerm])

  const itemsPerPage = 10
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedLogs = filteredLogs.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage)

  const filteredWorkbench = useMemo(() => {
    return workbenchData.items.filter((item) => {
      const matchesFilter =
        wbFilter === "ALL" || (wbFilter === "PENDING" && item.status === "PENDING") || (wbFilter === "ANOMALY" && item.status === "ANOMALY")
      const matchesSearch =
        !deferredWorkbenchSearchTerm ||
        item.employeeName.toLowerCase().includes(deferredWorkbenchSearchTerm) ||
        item.details.toLowerCase().includes(deferredWorkbenchSearchTerm)
      return matchesFilter && matchesSearch
    })
  }, [deferredWorkbenchSearchTerm, wbFilter, workbenchData.items])

  const wbItemsPerPage = 10
  const wbTotalPages = Math.max(1, Math.ceil(filteredWorkbench.length / wbItemsPerPage))
  const safeWorkbenchPage = Math.min(wbPage, wbTotalPages)
  const paginatedWorkbench = filteredWorkbench.slice((safeWorkbenchPage - 1) * wbItemsPerPage, safeWorkbenchPage * wbItemsPerPage)

  const handleExport = async () => {
    const from = (date?.from && format(date.from, "yyyy-MM-dd")) || startParam
    const to = (date?.to && format(date.to, "yyyy-MM-dd")) || endParam
    if (!from || !to) {
      toast.error("Select a date range first")
      return
    }

    const result = await exportDtrCsvAction({ companyId, startDate: from, endDate: to })
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    const blob = new Blob([result.content], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = result.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("DTR CSV exported")
  }

  const openModify = (log: DtrLogItem) => {
    if (log.id.startsWith("leave-")) {
      toast.info("Leave overlay rows are read-only")
      return
    }
    setEditingRecord(log)
    setIsSheetOpen(true)
  }

  return (
    <div className="w-full min-h-screen bg-background animate-in fade-in duration-500">
      <ModifyDtrSheet
        companyId={companyId}
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false)
          setEditingRecord(null)
          router.refresh()
        }}
        record={editingRecord}
      />

      <div className="px-6 py-6 border-b border-border/60 flex flex-col md:flex-row md:items-end justify-between gap-4 bg-muted/20">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Human Resources</p>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl text-foreground">Attendance Logs</h1>
            <div className="px-2 py-0.5 rounded-md border border-primary/20 bg-primary/5 text-primary text-xs">
              {combinedLogs.length} Records
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport}>
            <IconDownload className="h-3.5 w-3.5" /> Export
          </Button>
          <Link href={`/${companyId}/attendance/schedules`}>
            <Button>
              <IconRefresh className="h-3.5 w-3.5" /> Shifts & Schedules
            </Button>
          </Link>
        </div>
      </div>

      <div className="w-full">
        <div className="px-6 border-b border-border/60 bg-background/50">
          <div className="py-2">
            <div className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 p-1">
              <Button
                type="button"
                size="sm"
                variant={currentTab === "directory" ? "default" : "ghost"}
                onClick={() => setTab("directory")}
              >
                Directory View
              </Button>
              <Button
                type="button"
                size="sm"
                variant={currentTab === "calendar" ? "default" : "ghost"}
                onClick={() => setTab("calendar")}
              >
                Individual Calendar
              </Button>
              <Button
                type="button"
                size="sm"
                variant={currentTab === "workbench" ? "default" : "ghost"}
                onClick={() => setTab("workbench")}
              >
                Workbench
                {workbenchData.items.length > 0 ? <Badge className="ml-1 h-4 px-1 rounded-full bg-amber-500 text-[10px] text-white">{workbenchData.items.length}</Badge> : null}
              </Button>
            </div>
            {isRangeRefreshPending ? <p className="mt-2 text-xs text-muted-foreground">Refreshing records...</p> : null}
          </div>
        </div>

        {mountedTabs.directory ? (
          <div className={cn("flex flex-col lg:flex-row min-h-[calc(100vh-230px)]", currentTab === "directory" ? "flex" : "hidden")}>
            <aside className="w-full lg:w-72 border-r border-border/60 p-6 space-y-6 shrink-0 bg-background/30">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-9 justify-start text-left", !date && "text-muted-foreground")}>
                    <IconCalendarEvent className="mr-2 h-3.5 w-3.5 text-primary" />
                    {date?.from && date.to ? `${format(date.from, "yyyy.MM.dd")} - ${format(date.to, "yyyy.MM.dd")}` : "PICK DATE RANGE"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-border/60 shadow-xl" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={updateDateRange}
                    numberOfMonths={2}
                    className="rounded-md"
                  />
                </PopoverContent>
              </Popover>

              <Separator className="bg-border/60" />

              <div className="space-y-3">
                <h3 className="text-sm text-muted-foreground">Search</h3>
                <div className="relative group">
                  <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ID OR NAME"
                    value={localSearch}
                    onChange={(event) => {
                      setLocalSearch(event.target.value)
                      setCurrentPage(1)
                    }}
                    className="pl-9 h-9"
                  />
                </div>
              </div>

              <Separator className="bg-border/60" />

              <div className="space-y-6">
                <h3 className="text-sm text-muted-foreground">Snapshot</h3>
                <div className="grid grid-cols-1 gap-px bg-border/60 border border-border/60">
                  <div className="p-4 bg-background border-l-2 border-primary">
                    <p className="text-xs text-muted-foreground flex items-center gap-2"><IconUsers className="h-3 w-3" /> Total</p>
                    <p className="text-2xl mt-1">{stats.totalEmployees}</p>
                  </div>
                  <div className="p-4 bg-background border-l-2 border-emerald-500">
                    <p className="text-xs text-emerald-600 flex items-center gap-2"><IconUserCheck className="h-3 w-3" /> Present</p>
                    <p className="text-2xl mt-1">{stats.presentToday}</p>
                  </div>
                  <div className="p-4 bg-background border-l-2 border-red-500">
                    <p className="text-xs text-red-600 flex items-center gap-2"><IconUserX className="h-3 w-3" /> Absent</p>
                    <p className="text-2xl mt-1">{stats.absentToday}</p>
                  </div>
                </div>
              </div>
            </aside>

            <main className="flex-1 p-0 bg-background flex flex-col">
              <div className="border-b border-border/60 bg-muted/10 sticky top-0 z-10">
                <div className="grid grid-cols-16 px-8 h-10 items-center text-xs text-muted-foreground">
                  <div className="col-span-4">Employee</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2 text-center">In</div>
                  <div className="col-span-2 text-center">Out</div>
                  <div className="col-span-2 text-center">Hours</div>
                  <div className="col-span-1 text-center">Late</div>
                  <div className="col-span-1 text-center">UT</div>
                  <div className="col-span-1 text-center">OT</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>
              </div>

              <div className="divide-y divide-border/60 bg-background flex-1">
                {paginatedLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
                    <div className="p-4 bg-muted/20 border border-border/60 rounded-md">
                      <IconClock className="h-8 w-8 text-muted-foreground/70" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-foreground">No Logs Found</p>
                      <p className="text-sm text-muted-foreground">Import data to populate records.</p>
                    </div>
                  </div>
                ) : (
                  paginatedLogs.map((log) => (
                    <div key={log.id} className="grid grid-cols-16 px-8 py-4 items-center group hover:bg-muted/5 transition-colors">
                      <div className="col-span-4 flex items-center gap-4">
                        <Avatar className="h-8 w-8 border border-border/60 shrink-0">
                          <AvatarImage src={log.employee.photoUrl || ""} alt={log.employee.firstName} />
                          <AvatarFallback className="bg-primary/5 text-primary text-xs">
                            {log.employee.firstName[0]}{log.employee.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-0.5 truncate">
                          <p className="text-sm leading-none truncate">{log.employee.lastName}, {log.employee.firstName}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-foreground/70">{log.employee.employeeNumber}</span>
                            <Badge className={cn("px-1.5 py-0 text-[11px] border rounded", getStatusColor(log.attendanceStatus))}>{log.attendanceStatus}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 text-sm text-foreground/90">{formatDatePh(log.attendanceDate)}</div>
                      <div className="col-span-2 text-center text-sm">{formatWallClockLabel(log.actualTimeIn)}</div>
                      <div className="col-span-2 text-center text-sm">{formatWallClockLabel(log.actualTimeOut)}</div>
                      <div className="col-span-2 text-center text-sm text-foreground/80">{Number(log.hoursWorked).toFixed(2)}</div>
                      <div className="col-span-1 text-center text-sm text-foreground/70">{log.tardinessMins}m</div>
                      <div className="col-span-1 text-center text-sm text-foreground/70">{log.undertimeMins}m</div>
                      <div className="col-span-1 text-center text-sm text-foreground/70">{log.overtimeHours}h</div>
                      <div className="col-span-1 flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm"><IconDots className="h-4 w-4 text-muted-foreground" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-border/60">
                            <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">Action</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border/60" />
                            <DropdownMenuItem className="cursor-pointer py-1.5" onClick={() => openModify(log)}>
                              Modify
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {filteredLogs.length > 0 ? (
                <div className="px-8 h-12 border-t border-border/60 bg-background flex items-center justify-between sticky bottom-0">
                  <div className="text-xs text-muted-foreground">Page {safeCurrentPage} of {totalPages} - {filteredLogs.length} Records</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={safeCurrentPage === 1} onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}>
                      Prev
                    </Button>
                    <Button variant="outline" size="sm" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}>
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </main>
          </div>
        ) : null}

        {mountedTabs.calendar ? (
          <div className={cn("m-0 border-none outline-none p-8 bg-background min-h-[calc(100vh-230px)]", currentTab === "calendar" ? "block" : "hidden")}>
          <EmployeeDtrCalendar companyId={companyId} leaveOverlays={leaveOverlays} />
          </div>
        ) : null}

        {mountedTabs.workbench ? (
          <div className={cn("flex flex-col lg:flex-row min-h-[calc(100vh-230px)]", currentTab === "workbench" ? "flex" : "hidden")}>
            <aside className="w-full lg:w-72 border-r border-border/60 p-6 space-y-6 shrink-0 bg-background/30">
              <div className="space-y-6">
                <h3 className="text-sm text-muted-foreground">Queue Analysis</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-4 bg-muted/20 border-l-2 border-primary cursor-pointer" onClick={() => {
                    setWbFilter("ALL")
                    setWbPage(1)
                  }}>
                    <p className="text-xs text-muted-foreground flex justify-between"><span>Total Items</span>{wbFilter === "ALL" ? <IconCheckupList className="h-3 w-3 text-primary" /> : null}</p>
                    <p className="text-2xl mt-1">{workbenchData.items.length}</p>
                  </div>
                  <div className="p-4 bg-blue-500/[0.03] border-l-2 border-blue-500 cursor-pointer" onClick={() => {
                    setWbFilter("PENDING")
                    setWbPage(1)
                  }}>
                    <p className="text-xs text-blue-600">Pending</p>
                    <p className="text-2xl mt-1">{workbenchData.stats.pendingLeaves + workbenchData.stats.pendingOTs}</p>
                  </div>
                  <div className="p-4 bg-amber-500/[0.03] border-l-2 border-amber-500 cursor-pointer" onClick={() => {
                    setWbFilter("ANOMALY")
                    setWbPage(1)
                  }}>
                    <p className="text-xs text-amber-600">Exceptions</p>
                    <p className="text-2xl mt-1">{workbenchData.stats.missingLogs + workbenchData.stats.absences}</p>
                  </div>
                </div>
              </div>

              <Separator className="bg-border/60" />

              <div className="space-y-3">
                <h3 className="text-sm text-muted-foreground">Search</h3>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search item..."
                    value={localWbSearch}
                    onChange={(event) => {
                      setLocalWbSearch(event.target.value)
                      setWbPage(1)
                    }}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </aside>

            <main className="flex-1 p-0 bg-background flex flex-col">
              <div className="border-b border-border/60 bg-muted/10 sticky top-0 z-10">
                <div className="grid grid-cols-12 px-8 h-10 items-center text-xs text-muted-foreground">
                  <div className="col-span-4">Employee</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Details</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>
              </div>

              <div className="divide-y divide-border/60 bg-background flex-1">
                {paginatedWorkbench.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
                    <div className="p-4 bg-muted/20 border border-border/60 rounded-md shadow-none"><IconCheckupList className="h-8 w-8 text-muted-foreground/70" /></div>
                    <div className="space-y-1">
                      <p className="text-sm text-foreground">All Clear</p>
                      <p className="text-sm text-muted-foreground">No items found matching criteria.</p>
                    </div>
                  </div>
                ) : (
                  paginatedWorkbench.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 px-8 py-4 items-center group hover:bg-muted/5 transition-colors">
                      <div className="col-span-4 flex items-center gap-4">
                        <div
                          className={cn(
                            "h-8 w-8 shrink-0 flex items-center justify-center border border-border/60 bg-background",
                            item.status === "PENDING" ? "text-blue-500" : "text-amber-500"
                          )}
                        >
                          {item.type === "LEAVE_REQUEST" ? <IconCalendarEvent className="h-4 w-4" /> : null}
                          {item.type === "OT_REQUEST" ? <IconClock className="h-4 w-4" /> : null}
                          {item.type === "MISSING_LOG" ? <IconAlertCircle className="h-4 w-4" /> : null}
                          {item.type === "ATTENDANCE_EXCEPTION" ? <IconAlertCircle className="h-4 w-4" /> : null}
                          {item.type === "ABSENCE" ? <IconX className="h-4 w-4" /> : null}
                        </div>
                        <div className="space-y-0.5 truncate">
                          <p className="text-sm leading-none truncate">{item.employeeName}</p>
                          <p className="text-xs text-foreground/70">{item.employeeId.slice(0, 8)}...</p>
                        </div>
                      </div>
                      <div className="col-span-2 text-sm text-foreground/80">{formatDatePh(item.date)}</div>
                      <div className="col-span-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border px-1.5 py-0.5 text-[11px] rounded",
                            item.status === "PENDING"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          )}
                        >
                          {item.type.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-sm text-foreground/70 truncate" title={item.details}>{item.details}</div>
                      <div className="col-span-2 text-right">
                        <Button
                          size="sm"
                          className="h-7 border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                          variant="outline"
                          onClick={() => {
                            if (item.data) {
                              openModify(item.data)
                            }
                          }}
                        >
                          Fix
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {filteredWorkbench.length > 0 ? (
                <div className="px-8 h-12 border-t border-border/60 bg-background flex items-center justify-between sticky bottom-0">
                  <div className="text-xs text-muted-foreground">Page {safeWorkbenchPage} of {wbTotalPages} - {filteredWorkbench.length} Items</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={safeWorkbenchPage === 1} onClick={() => setWbPage((previous) => Math.max(1, previous - 1))}>Prev</Button>
                    <Button variant="outline" size="sm" disabled={safeWorkbenchPage >= wbTotalPages} onClick={() => setWbPage((previous) => Math.min(wbTotalPages, previous + 1))}>Next</Button>
                  </div>
                </div>
              ) : null}
            </main>
          </div>
        ) : null}
      </div>
    </div>
  )
}
