"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  IconCalendarEvent,
  IconCheck,
  IconChevronDown,
  IconClockHour4,
  IconFilterOff,
  IconListCheck,
  IconSearch,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  approveOvertimeByHrAction,
  getOvertimeApprovalHistoryPageAction,
  approveOvertimeBySupervisorAction,
  rejectOvertimeBySupervisorAction,
  rejectOvertimeByHrAction,
} from "@/modules/overtime/actions/overtime-approval-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toPhDayStartUtcInstant } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import type {
  EmployeePortalOvertimeApprovalDepartmentOption,
  EmployeePortalOvertimeApprovalHistoryRow,
  EmployeePortalOvertimeApprovalRow,
} from "@/modules/overtime/types/overtime-domain-types"

type OvertimeApprovalClientProps = {
  companyId: string
  isHR: boolean
  departmentOptions: EmployeePortalOvertimeApprovalDepartmentOption[]
  rows: EmployeePortalOvertimeApprovalRow[]
  historyRows: EmployeePortalOvertimeApprovalHistoryRow[]
  initialHistoryTotal: number
  initialHistoryPage: number
  initialHistoryPageSize: number
}

type QueueStatusFilter = "ALL" | "PENDING" | "SUPERVISOR_APPROVED"
type HistoryStatusFilter = "ALL" | "APPROVED" | "REJECTED" | "SUPERVISOR_APPROVED"

const toLabel = (statusCode: string): string => {
  if (statusCode === "SUPERVISOR_APPROVED") return "Supervisor Approved"
  return statusCode.replace(/_/g, " ")
}

const toDateValue = (date?: Date): string => (date ? format(date, "yyyy-MM-dd") : "")
const fromDateValue = (value: string): Date | undefined => (value ? (toPhDayStartUtcInstant(value) ?? undefined) : undefined)
const getNameInitials = (fullName: string): string => {
  const initials = fullName
    .split(" ")
    .filter((part) => part.trim().length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return initials || "OT"
}

export function OvertimeApprovalClient({
  companyId,
  isHR,
  departmentOptions,
  rows,
  historyRows,
  initialHistoryTotal,
  initialHistoryPage,
  initialHistoryPageSize,
}: OvertimeApprovalClientProps) {
  const router = useRouter()
  const historyRequestTokenRef = useRef(0)
  const historySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject">("approve")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [remarks, setRemarks] = useState("")
  const [queueSearch, setQueueSearch] = useState("")
  const [queueStatus, setQueueStatus] = useState<QueueStatusFilter>("ALL")
  const [queueDepartmentId, setQueueDepartmentId] = useState<string>("ALL")
  const [historySearch, setHistorySearch] = useState("")
  const [historyStatus, setHistoryStatus] = useState<HistoryStatusFilter>("ALL")
  const [historyDepartmentId, setHistoryDepartmentId] = useState<string>("ALL")
  const [historyFromDate, setHistoryFromDate] = useState("")
  const [historyToDate, setHistoryToDate] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isHistoryPending, startHistoryTransition] = useTransition()
  const [rowsPage, setRowsPage] = useState(1)
  const [historyRowsState, setHistoryRowsState] = useState(historyRows)
  const [historyTotal, setHistoryTotal] = useState(initialHistoryTotal)
  const [historyPage, setHistoryPage] = useState(initialHistoryPage)
  const [historyPageSize, setHistoryPageSize] = useState(String(initialHistoryPageSize))
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null)
  const [expandedHistoryRequestId, setExpandedHistoryRequestId] = useState<string | null>(null)
  const ITEMS_PER_PAGE = 10
  const historyItemsPerPage = Number(historyPageSize)
  const deferredQueueSearch = useDeferredValue(queueSearch.trim().toLowerCase())

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId])
  const stats = useMemo(() => {
    const totalHours = rows.reduce((sum, row) => sum + row.hours, 0)
    const employeeCount = new Set(rows.map((row) => row.employeeNumber)).size
    return {
      totalRequests: rows.length,
      totalHours,
      employeeCount,
    }
  }, [rows])
  const filteredRows = useMemo(() => {
    const query = deferredQueueSearch

    return rows.filter((row) => {
      if (queueStatus !== "ALL" && row.statusCode !== queueStatus) {
        return false
      }

      if (queueDepartmentId !== "ALL" && row.departmentId !== queueDepartmentId) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = [
        row.requestNumber,
        row.employeeName,
        row.employeeNumber,
        row.departmentName,
        row.overtimeDate,
        row.reason ?? "",
        row.statusCode,
        toLabel(row.statusCode),
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [deferredQueueSearch, queueDepartmentId, queueStatus, rows])
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyItemsPerPage))
  const activeHistoryPage = Math.min(historyPage, historyTotalPages)
  const hasActiveQueueFilters = queueSearch.trim().length > 0 || queueStatus !== "ALL" || queueDepartmentId !== "ALL"
  const hasActiveHistoryFilters =
    historySearch.trim().length > 0 ||
    historyStatus !== "ALL" ||
    historyDepartmentId !== "ALL" ||
    Boolean(historyFromDate) ||
    Boolean(historyToDate)

  const clearHistorySearchTimer = () => {
    if (!historySearchTimerRef.current) return
    clearTimeout(historySearchTimerRef.current)
    historySearchTimerRef.current = null
  }

  const loadHistoryPage = (params: {
    page: number
    pageSize: number
    search: string
    status: HistoryStatusFilter
    departmentId: string
    fromDate: string
    toDate: string
  }) => {
    const token = historyRequestTokenRef.current + 1
    historyRequestTokenRef.current = token
    setHistoryLoadError(null)

    startHistoryTransition(async () => {
      const response = await getOvertimeApprovalHistoryPageAction({
        companyId,
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        status: params.status,
        departmentId: params.departmentId === "ALL" ? undefined : params.departmentId,
        fromDate: params.fromDate,
        toDate: params.toDate,
      })

      if (historyRequestTokenRef.current !== token) {
        return
      }

      if (!response.ok) {
        setHistoryLoadError(response.error)
        return
      }

      setHistoryRowsState(response.data.rows)
      setHistoryTotal(response.data.total)
      setHistoryPage(response.data.page)
      setHistoryPageSize(String(response.data.pageSize))
    })
  }

  const scheduleHistorySearch = (nextSearch: string) => {
    setHistorySearch(nextSearch)
    setExpandedHistoryRequestId(null)
    clearHistorySearchTimer()
    historySearchTimerRef.current = setTimeout(() => {
      loadHistoryPage({
        page: 1,
        pageSize: historyItemsPerPage,
        search: nextSearch,
        status: historyStatus,
        departmentId: historyDepartmentId,
        fromDate: historyFromDate,
        toDate: historyToDate,
      })
    }, 250)
  }

  useEffect(() => {
    return () => {
      if (!historySearchTimerRef.current) return
      clearTimeout(historySearchTimerRef.current)
      historySearchTimerRef.current = null
    }
  }, [])

  const openDecision = (rowId: string, type: "approve" | "reject") => {
    setSelectedId(rowId)
    setActionType(type)
    setRemarks("")
    setOpen(true)
  }

  const submit = () => {
    if (!selectedId) return

    startTransition(async () => {
      const response = isHR
        ? actionType === "approve"
          ? await approveOvertimeByHrAction({ companyId, requestId: selectedId, remarks })
          : await rejectOvertimeByHrAction({ companyId, requestId: selectedId, remarks })
        : actionType === "approve"
          ? await approveOvertimeBySupervisorAction({ companyId, requestId: selectedId, remarks })
          : await rejectOvertimeBySupervisorAction({ companyId, requestId: selectedId, remarks })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">Request Management</p>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Overtime Approvals</h1>
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {isHR ? "HR Final Approval" : "Supervisor Queue"}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {(() => {
          const statItems = [
            { label: "Requests In Queue", value: String(stats.totalRequests), icon: IconListCheck },
            { label: "Total OT Hours", value: `${stats.totalHours.toFixed(2)} hrs`, icon: IconClockHour4 },
            { label: "Employees", value: String(stats.employeeCount), icon: IconUserCircle },
            { label: "Approval Stage", value: isHR ? "HR Final" : "Supervisor", icon: IconClockHour4 },
          ]

          return (
            <>
              <div className="grid grid-cols-2 gap-2 sm:hidden">
                {statItems.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border/60 bg-card p-3">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <stat.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-lg font-semibold text-foreground">{stat.value}</span>
                  </div>
                ))}
              </div>

              <div className="hidden grid-cols-1 gap-3 sm:grid md:grid-cols-2 lg:grid-cols-4">
                {statItems.map((stat) => (
                  <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <stat.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-2xl font-semibold text-foreground">{stat.value}</span>
                  </div>
                ))}
              </div>
            </>
          )
        })()}

        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Approval Queue</h2>
            <span className="text-xs text-muted-foreground">{filteredRows.length} records</span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="relative col-span-3 sm:w-[360px]">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee/request..."
                value={queueSearch}
                onChange={(event) => {
                  setQueueSearch(event.target.value)
                  setRowsPage(1)
                }}
                className="rounded-lg pl-8"
              />
            </div>
            <Select
              value={queueStatus}
              onValueChange={(value) => {
                setQueueStatus(value as QueueStatusFilter)
                setRowsPage(1)
              }}
            >
              <SelectTrigger className="w-full rounded-lg sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SUPERVISOR_APPROVED">Supervisor Approved</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={queueDepartmentId}
              onValueChange={(value) => {
                setQueueDepartmentId(value)
                setRowsPage(1)
              }}
            >
              <SelectTrigger className="w-full rounded-lg sm:w-[220px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="ALL">All departments</SelectItem>
                {departmentOptions.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                    {!department.isActive ? " (Inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-lg text-xs sm:w-auto sm:text-sm"
              onClick={() => {
                setQueueSearch("")
                setQueueStatus("ALL")
                setQueueDepartmentId("ALL")
                setRowsPage(1)
              }}
              disabled={!hasActiveQueueFilters}
            >
              <IconFilterOff className="h-4 w-4" />
              <span>Clear</span>
            </Button>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
              No requests pending your approval.
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
              No requests match the current filters.
            </div>
          ) : (
            <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border/60 lg:bg-card">
              <div className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 lg:grid">
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Request #</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Employee</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">OT Date</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Hours</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Reason</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Status</p>
                <p className="col-span-2 text-right text-[11px] font-medium uppercase tracking-wide text-foreground/70">Action</p>
              </div>
              {(() => {
                const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE))
                const safeRowsPage = Math.min(rowsPage, totalPages)
                const startIndex = (safeRowsPage - 1) * ITEMS_PER_PAGE
                const paginatedRows = filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE)

                return (
                  <>
                    <div className="space-y-2 lg:hidden">
                      {paginatedRows.map((row) => (
                        <div key={row.id} className="rounded-xl border border-border/60 bg-background p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Request</p>
                              <p className="truncate whitespace-nowrap text-sm font-semibold text-foreground">{row.requestNumber}</p>
                            </div>
                            <Badge variant={row.statusCode === "PENDING" ? "secondary" : "default"} className="shrink-0 rounded-full text-[10px]">
                              {toLabel(row.statusCode)}
                            </Badge>
                          </div>

                          <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Employee</p>
                            <div className="mt-1.5 flex items-center gap-2.5">
                              <Avatar className="h-9 w-9 shrink-0 rounded-md border border-border/60 after:rounded-md">
                                <AvatarImage src={row.employeePhotoUrl ?? undefined} alt={row.employeeName} className="!rounded-md object-cover" />
                                <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                  {getNameInitials(row.employeeName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{row.employeeName}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {row.employeeNumber} • {row.departmentName}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                <IconCalendarEvent className="h-3.5 w-3.5" />
                                OT Date
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-foreground">{row.overtimeDate}</p>
                            </div>
                            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hours</p>
                              <p className="mt-0.5 text-xs font-medium text-foreground">{row.hours.toFixed(2)} hour(s)</p>
                              {isHR && row.ctoConversionPreview ? (
                                <Badge className="mt-1.5 h-5 bg-primary px-1.5 text-[10px] text-primary-foreground">CTO 1:1</Badge>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 rounded-md border border-border/50 bg-muted/30 px-2.5 py-2 text-xs">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason</p>
                            <p className="mt-0.5 line-clamp-2 text-foreground">{row.reason ?? "No reason provided."}</p>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button variant="destructive" size="sm" className="rounded-lg text-xs" onClick={() => openDecision(row.id, "reject")} disabled={isPending}>
                              <IconX className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                            <Button size="sm" className="rounded-lg bg-green-600 text-xs hover:bg-green-700" onClick={() => openDecision(row.id, "approve")} disabled={isPending}>
                              <IconCheck className="mr-1 h-3.5 w-3.5" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden lg:block">
                      {paginatedRows.map((row) => (
                        <div key={row.id} className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 px-3 py-4 last:border-b-0 hover:bg-muted/20 lg:grid">
                          <div className="col-span-1 min-w-0">
                            <p className="truncate whitespace-nowrap text-xs text-muted-foreground" title={row.requestNumber}>{row.requestNumber}</p>
                          </div>
                          <div className="col-span-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8 shrink-0 rounded-md border border-border/60 after:rounded-md">
                                <AvatarImage src={row.employeePhotoUrl ?? undefined} alt={row.employeeName} className="!rounded-md object-cover" />
                                <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                  {getNameInitials(row.employeeName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{row.employeeName}</p>
                                <p className="truncate text-[10px] text-muted-foreground">{row.employeeNumber}</p>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-2 text-sm text-foreground">{row.overtimeDate}</div>
                          <div className="col-span-1">
                            <p className="text-sm text-foreground">{row.hours.toFixed(2)}h</p>
                            {isHR && row.ctoConversionPreview ? (
                              <Badge className="mt-1 bg-primary text-primary-foreground">CTO 1:1</Badge>
                            ) : null}
                          </div>
                          <div className="col-span-2 text-xs text-muted-foreground line-clamp-2">{row.reason ?? "-"}</div>
                          <div className="col-span-2">
                            <Badge variant={row.statusCode === "PENDING" ? "secondary" : "default"} className="w-full justify-center rounded-full text-xs">
                              {toLabel(row.statusCode)}
                            </Badge>
                          </div>
                          <div className="col-span-2 flex justify-end gap-2">
                            <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => openDecision(row.id, "reject")} disabled={isPending}>
                              <IconX className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                            <Button size="sm" className="rounded-lg bg-green-600 hover:bg-green-700" onClick={() => openDecision(row.id, "approve")} disabled={isPending}>
                              <IconCheck className="mr-1 h-3.5 w-3.5" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {totalPages > 1 ? (
                      <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Page {safeRowsPage} of {totalPages} • {filteredRows.length} records
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            disabled={safeRowsPage <= 1}
                            onClick={() => setRowsPage(safeRowsPage - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            disabled={safeRowsPage >= totalPages}
                            onClick={() => setRowsPage(safeRowsPage + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )
              })()}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Approval History</h2>
            <span className="text-xs text-muted-foreground">
              {historyTotal} records{isHistoryPending ? " • Loading..." : ""}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
            <div className="relative col-span-3 sm:col-span-1">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee/request..."
                value={historySearch}
                onChange={(event) => {
                  scheduleHistorySearch(event.target.value)
                }}
                className="rounded-lg pl-8"
              />
            </div>
            <div className="col-span-1">
              <Select
                value={historyStatus}
                onValueChange={(value) => {
                  const nextStatus = value as HistoryStatusFilter
                  setHistoryStatus(nextStatus)
                  setExpandedHistoryRequestId(null)
                  clearHistorySearchTimer()
                  loadHistoryPage({
                    page: 1,
                    pageSize: historyItemsPerPage,
                    search: historySearch,
                    status: nextStatus,
                    departmentId: historyDepartmentId,
                    fromDate: historyFromDate,
                    toDate: historyToDate,
                  })
                }}
              >
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="SUPERVISOR_APPROVED">Supervisor Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Select
                value={historyDepartmentId}
                onValueChange={(value) => {
                  setHistoryDepartmentId(value)
                  setExpandedHistoryRequestId(null)
                  clearHistorySearchTimer()
                  loadHistoryPage({
                    page: 1,
                    pageSize: historyItemsPerPage,
                    search: historySearch,
                    status: historyStatus,
                    departmentId: value,
                    fromDate: historyFromDate,
                    toDate: historyToDate,
                  })
                }}
              >
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="ALL">All departments</SelectItem>
                  {departmentOptions.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                      {!department.isActive ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="col-span-1 w-full rounded-lg text-xs sm:text-sm"
              onClick={() => {
                setHistorySearch("")
                setHistoryStatus("ALL")
                setHistoryDepartmentId("ALL")
                setHistoryFromDate("")
                setHistoryToDate("")
                setExpandedHistoryRequestId(null)
                clearHistorySearchTimer()
                loadHistoryPage({
                  page: 1,
                  pageSize: historyItemsPerPage,
                  search: "",
                  status: "ALL",
                  departmentId: "ALL",
                  fromDate: "",
                  toDate: "",
                })
              }}
              disabled={!hasActiveHistoryFilters}
            >
              <IconFilterOff className="h-4 w-4" />
              <span className="sm:hidden">Clear</span>
              <span className="hidden sm:inline">Clear Filters</span>
            </Button>
            <div className="col-span-3 sm:col-span-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start rounded-lg text-left", !historyFromDate && "text-muted-foreground")}>
                    <IconCalendarEvent className="mr-2 h-4 w-4" />
                    {historyFromDate ? format(fromDateValue(historyFromDate) as Date, "PPP") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDateValue(historyFromDate)}
                    onSelect={(date) => {
                      const nextFrom = toDateValue(date)
                      const nextTo = historyToDate && nextFrom && historyToDate < nextFrom ? "" : historyToDate
                      setHistoryFromDate(nextFrom)
                      if (nextTo !== historyToDate) {
                        setHistoryToDate(nextTo)
                      }
                      setExpandedHistoryRequestId(null)
                      clearHistorySearchTimer()
                      loadHistoryPage({
                        page: 1,
                        pageSize: historyItemsPerPage,
                        search: historySearch,
                        status: historyStatus,
                        departmentId: historyDepartmentId,
                        fromDate: nextFrom,
                        toDate: nextTo,
                      })
                    }}
                    captionLayout="dropdown"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="col-span-3 sm:col-span-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start rounded-lg text-left", !historyToDate && "text-muted-foreground")}>
                    <IconCalendarEvent className="mr-2 h-4 w-4" />
                    {historyToDate ? format(fromDateValue(historyToDate) as Date, "PPP") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDateValue(historyToDate)}
                    onSelect={(date) => {
                      const nextTo = toDateValue(date)
                      setHistoryToDate(nextTo)
                      setExpandedHistoryRequestId(null)
                      clearHistorySearchTimer()
                      loadHistoryPage({
                        page: 1,
                        pageSize: historyItemsPerPage,
                        search: historySearch,
                        status: historyStatus,
                        departmentId: historyDepartmentId,
                        fromDate: historyFromDate,
                        toDate: nextTo,
                      })
                    }}
                    disabled={(date) => {
                      if (!historyFromDate) return false
                      const fromDate = fromDateValue(historyFromDate)
                      if (!fromDate) return false
                      return date < fromDate
                    }}
                    captionLayout="dropdown"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {historyLoadError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {historyLoadError}
            </div>
          ) : null}

          {historyRowsState.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              No approval history found for the selected filters.
            </div>
          ) : (
            <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border/60 lg:bg-card">
              <div className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 lg:grid">
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request #</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Employee</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">OT Date</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Hours</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="col-span-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">CTO</p>
              </div>

              <div className="space-y-2 lg:hidden">
                {historyRowsState.map((row) => {
                  const isExpanded = expandedHistoryRequestId === row.id
                  return (
                    <div key={`history-mobile-${row.id}`} className={cn("rounded-xl border border-border/60 bg-background transition-colors", isExpanded && "border-primary/40 bg-primary/10")}>
                      <button
                        type="button"
                        className="w-full p-3 text-left"
                        onClick={() => setExpandedHistoryRequestId((current) => (current === row.id ? null : row.id))}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground">Request #</p>
                            <p className="truncate whitespace-nowrap text-sm font-medium text-foreground">{row.requestNumber}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.employeeName} • {row.hours.toFixed(2)}h
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">Decided: {row.decidedAtLabel}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={row.statusCode === "REJECTED" ? "destructive" : "default"} className="shrink-0 text-xs">
                              {toLabel(row.statusCode)}
                            </Badge>
                            <IconChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                          </div>
                        </div>
                      </button>
                      {isExpanded ? (
                        <div className="space-y-3 border-t border-border/60 bg-muted/30 px-3 py-3 text-xs">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                            <div>
                              <p className="text-[11px] text-muted-foreground">Employee</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Avatar className="h-8 w-8 shrink-0 rounded-md border border-border/60 after:rounded-md">
                                  <AvatarImage src={row.employeePhotoUrl ?? undefined} alt={row.employeeName} className="!rounded-md object-cover" />
                                  <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                    {getNameInitials(row.employeeName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate text-foreground">{row.employeeName}</p>
                                  <p className="truncate text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">OT Date</p>
                              <p className="text-foreground">{row.overtimeDate}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Hours</p>
                              <p className="text-foreground">{row.hours.toFixed(2)} hour(s)</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Status</p>
                              <p className="text-foreground">{toLabel(row.statusCode)}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Reason</p>
                            <p className="text-foreground">{row.reason ?? "-"}</p>
                          </div>
                          {isHR && row.ctoConversionPreview ? (
                            <div>
                              <p className="text-[11px] text-muted-foreground">CTO</p>
                              <p className="text-foreground">CTO 1:1</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <div className="hidden lg:block">
                {historyRowsState.map((row) => {
                  const isExpanded = expandedHistoryRequestId === row.id
                  return (
                    <div key={`history-${row.id}`} className={cn("group border-b border-border/60 last:border-b-0 transition-colors", isExpanded && "bg-primary/10")}>
                      <div
                        className="hidden cursor-pointer grid-cols-12 items-center gap-3 px-3 py-4 hover:bg-muted/20 lg:grid"
                        onClick={() => setExpandedHistoryRequestId((current) => (current === row.id ? null : row.id))}
                      >
                        <div className="col-span-1 min-w-0">
                          <p className="truncate whitespace-nowrap text-xs text-muted-foreground" title={row.requestNumber}>
                            {row.requestNumber}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8 shrink-0 rounded-md border border-border/60 after:rounded-md">
                              <AvatarImage src={row.employeePhotoUrl ?? undefined} alt={row.employeeName} className="!rounded-md object-cover" />
                              <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                {getNameInitials(row.employeeName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{row.employeeName}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{row.employeeNumber}</p>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 text-sm text-foreground">{row.overtimeDate}</div>
                        <div className="col-span-1">
                          <p className="text-sm text-foreground">{row.hours.toFixed(2)}h</p>
                          {isHR && row.ctoConversionPreview ? (
                            <Badge className="mt-1 bg-primary text-primary-foreground">CTO 1:1</Badge>
                          ) : null}
                        </div>
                        <div className="col-span-2 text-xs text-muted-foreground line-clamp-2">{row.reason ?? "-"}</div>
                        <div className="col-span-2 space-y-1">
                          <Badge variant={row.statusCode === "REJECTED" ? "destructive" : "default"} className="w-full justify-center rounded-full text-xs">
                            {toLabel(row.statusCode)}
                          </Badge>
                          <p className="text-center text-[11px] text-muted-foreground">{row.decidedAtLabel}</p>
                        </div>
                        <div className="col-span-2 text-right text-xs text-muted-foreground">
                          {isHR && row.ctoConversionPreview ? "CTO 1:1" : "-"}
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {isExpanded ? (
                          <motion.div
                            key={`${row.id}-details`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
                            className="overflow-hidden"
                          >
                            <motion.div
                              initial={{ y: -6, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: -6, opacity: 0 }}
                              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                              className="grid grid-cols-1 gap-2 border-t border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground md:grid-cols-3"
                            >
                              <div>
                                <p className="font-medium text-foreground">Overtime Date</p>
                                <p>{row.overtimeDate}</p>
                              </div>
                              <div>
                                <p className="font-medium text-foreground">Hours</p>
                                <p>{row.hours.toFixed(2)} hour(s)</p>
                              </div>
                              <div>
                                <p className="font-medium text-foreground">Decided At</p>
                                <p>{row.decidedAtLabel}</p>
                              </div>
                              <div className="md:col-span-3">
                                <p className="font-medium text-foreground">Reason</p>
                                <p>{row.reason ?? "-"}</p>
                              </div>
                            </motion.div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    Page {activeHistoryPage} of {historyTotalPages} • {historyTotal} records
                  </p>
                  <Select
                    value={historyPageSize}
                    onValueChange={(value) => {
                      setExpandedHistoryRequestId(null)
                      clearHistorySearchTimer()
                      loadHistoryPage({
                        page: 1,
                        pageSize: Number(value),
                        search: historySearch,
                        status: historyStatus,
                        departmentId: historyDepartmentId,
                        fromDate: historyFromDate,
                        toDate: historyToDate,
                      })
                    }}
                  >
                    <SelectTrigger className="h-8 w-[112px] rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="20">20 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    disabled={activeHistoryPage <= 1 || isHistoryPending}
                    onClick={() => {
                      setExpandedHistoryRequestId(null)
                      clearHistorySearchTimer()
                      loadHistoryPage({
                        page: Math.max(1, activeHistoryPage - 1),
                        pageSize: historyItemsPerPage,
                        search: historySearch,
                        status: historyStatus,
                        departmentId: historyDepartmentId,
                        fromDate: historyFromDate,
                        toDate: historyToDate,
                      })
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    disabled={activeHistoryPage >= historyTotalPages || isHistoryPending}
                    onClick={() => {
                      setExpandedHistoryRequestId(null)
                      clearHistorySearchTimer()
                      loadHistoryPage({
                        page: Math.min(historyTotalPages, activeHistoryPage + 1),
                        pageSize: historyItemsPerPage,
                        search: historySearch,
                        status: historyStatus,
                        departmentId: historyDepartmentId,
                        fromDate: historyFromDate,
                        toDate: historyToDate,
                      })
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-border/60 shadow-none sm:max-w-2xl">
          <DialogHeader className="mb-1.5 border-b border-border/60 pb-2">
            <DialogTitle className="text-base font-semibold">
              {actionType === "approve" ? "Approve" : "Reject"} Overtime Request
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Review the request details before you submit your decision.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="rounded-xl border border-border/60 bg-muted/25 p-2.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Avatar className="h-9 w-9 shrink-0 rounded-md border border-border/60 after:rounded-md">
                      <AvatarImage src={selected?.employeePhotoUrl ?? undefined} alt={selected?.employeeName ?? "Employee"} className="!rounded-md object-cover" />
                      <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                        {getNameInitials(selected?.employeeName ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{selected?.employeeName ?? "-"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selected?.employeeNumber ?? "-"} • {selected?.departmentName ?? "-"}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">Request {selected?.requestNumber ?? "-"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                    {selected ? (
                      <Badge variant={selected.statusCode === "REJECTED" ? "destructive" : "secondary"} className="rounded-full text-[10px]">
                        {toLabel(selected.statusCode)}
                      </Badge>
                    ) : null}
                    {isHR && selected?.ctoConversionPreview ? (
                      <Badge className="rounded-full bg-primary text-[10px] text-primary-foreground">CTO 1:1</Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">{selected?.overtimeDate ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Hours</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">
                    {selected ? `${selected.hours.toFixed(2)} hour(s)` : "-"}
                  </p>
                </div>
                <div className="hidden sm:block sm:col-span-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Decision Stage</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">{isHR ? "HR Final Approval" : "Supervisor Approval"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-foreground">Request Reason</Label>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-foreground">
                {selected?.reason?.trim() ? selected.reason : "No reason provided."}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-foreground">
                {actionType === "approve" ? "Approval Remarks (Optional)" : "Rejection Reason"}
              </Label>
              <Textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                className="min-h-[84px] rounded-lg text-sm"
                placeholder={actionType === "approve" ? "Add remarks..." : "Provide rejection reason..."}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-3 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-lg sm:min-w-[96px]" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
              <Button
                className={cn("rounded-lg sm:min-w-[96px]", actionType === "reject" && "bg-destructive hover:bg-destructive/90")}
                onClick={submit}
                disabled={isPending || (actionType === "reject" && !remarks.trim())}
              >
                {isPending ? <IconClockHour4 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {actionType === "approve" ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
