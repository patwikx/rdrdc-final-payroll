"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  IconCalendarEvent,
  IconCalendarStats,
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
  approveLeaveByHrAction,
  approveLeaveBySupervisorAction,
  getLeaveApprovalHistoryPageAction,
  getLeaveApprovalQueuePageAction,
  rejectLeaveBySupervisorAction,
  rejectLeaveByHrAction,
} from "@/modules/leave/actions/leave-approval-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toPhDayStartUtcInstant } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import type {
  EmployeePortalLeaveApprovalDepartmentOption,
  EmployeePortalLeaveApprovalHistoryRow,
  EmployeePortalLeaveApprovalRow,
} from "@/modules/leave/types/employee-portal-leave-types"

type LeaveApprovalClientProps = {
  companyId: string
  isHR: boolean
  companyOptions: Array<{
    id: string
    name: string
  }>
  departmentOptions: EmployeePortalLeaveApprovalDepartmentOption[]
  rows: EmployeePortalLeaveApprovalRow[]
  initialQueueTotal: number
  initialQueuePage: number
  initialQueuePageSize: number
  historyRows: EmployeePortalLeaveApprovalHistoryRow[]
  initialHistoryTotal: number
  initialHistoryPage: number
  initialHistoryPageSize: number
  view?: "queue" | "history" | "both"
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

  return initials || "LV"
}

export function LeaveApprovalClient({
  companyId,
  isHR,
  companyOptions,
  departmentOptions,
  rows,
  initialQueueTotal,
  initialQueuePage,
  initialQueuePageSize,
  historyRows,
  initialHistoryTotal,
  initialHistoryPage,
  initialHistoryPageSize,
  view = "both",
}: LeaveApprovalClientProps) {
  const router = useRouter()
  const queueRequestTokenRef = useRef(0)
  const queueSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const historyRequestTokenRef = useRef(0)
  const historySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject">("approve")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedRequestCompanyId, setSelectedRequestCompanyId] = useState<string | null>(null)
  const [remarks, setRemarks] = useState("")
  const [queueSearch, setQueueSearch] = useState("")
  const [queueStatus, setQueueStatus] = useState<QueueStatusFilter>("ALL")
  const [queueCompanyId, setQueueCompanyId] = useState<string>("ALL")
  const [queueDepartmentId, setQueueDepartmentId] = useState<string>("ALL")
  const [historySearch, setHistorySearch] = useState("")
  const [historyStatus, setHistoryStatus] = useState<HistoryStatusFilter>("ALL")
  const [historyCompanyId, setHistoryCompanyId] = useState<string>("ALL")
  const [historyDepartmentId, setHistoryDepartmentId] = useState<string>("ALL")
  const [historyFromDate, setHistoryFromDate] = useState("")
  const [historyToDate, setHistoryToDate] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isQueuePending, startQueueTransition] = useTransition()
  const [isHistoryPending, startHistoryTransition] = useTransition()
  const [rowsPage, setRowsPage] = useState(initialQueuePage)
  const [queueRowsState, setQueueRowsState] = useState(rows)
  const [queueTotal, setQueueTotal] = useState(initialQueueTotal)
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null)
  const [historyRowsState, setHistoryRowsState] = useState(historyRows)
  const [historyTotal, setHistoryTotal] = useState(initialHistoryTotal)
  const [historyPage, setHistoryPage] = useState(initialHistoryPage)
  const [historyPageSize, setHistoryPageSize] = useState(String(initialHistoryPageSize))
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null)
  const [expandedHistoryRequestId, setExpandedHistoryRequestId] = useState<string | null>(null)
  const queueItemsPerPage = initialQueuePageSize
  const historyItemsPerPage = Number(historyPageSize)
  const selected = useMemo(() => queueRowsState.find((row) => row.id === selectedId) ?? null, [queueRowsState, selectedId])
  const stats = useMemo(() => {
    const totalDays = queueRowsState.reduce((sum, row) => sum + row.numberOfDays, 0)
    const employeeCount = new Set(queueRowsState.map((row) => row.employeeNumber)).size
    return {
      totalRequests: queueTotal,
      totalDays,
      employeeCount,
    }
  }, [queueRowsState, queueTotal])
  const queueTotalPages = Math.max(1, Math.ceil(queueTotal / queueItemsPerPage))
  const activeRowsPage = Math.min(rowsPage, queueTotalPages)
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyItemsPerPage))
  const activeHistoryPage = Math.min(historyPage, historyTotalPages)
  const queueDepartmentOptions = useMemo(
    () =>
      queueCompanyId === "ALL"
        ? departmentOptions
        : departmentOptions.filter((department) => department.companyId === queueCompanyId),
    [departmentOptions, queueCompanyId]
  )
  const historyDepartmentOptions = useMemo(
    () =>
      historyCompanyId === "ALL"
        ? departmentOptions
        : departmentOptions.filter((department) => department.companyId === historyCompanyId),
    [departmentOptions, historyCompanyId]
  )
  const hasActiveQueueFilters =
    queueSearch.trim().length > 0 || queueStatus !== "ALL" || queueCompanyId !== "ALL" || queueDepartmentId !== "ALL"
  const hasActiveHistoryFilters =
    historySearch.trim().length > 0 ||
    historyStatus !== "ALL" ||
    historyCompanyId !== "ALL" ||
    historyDepartmentId !== "ALL" ||
    Boolean(historyFromDate) ||
    Boolean(historyToDate)
  const showQueueSection = view !== "history"
  const showHistorySection = view !== "queue"

  const clearHistorySearchTimer = () => {
    if (!historySearchTimerRef.current) return
    clearTimeout(historySearchTimerRef.current)
    historySearchTimerRef.current = null
  }

  const clearQueueSearchTimer = () => {
    if (!queueSearchTimerRef.current) return
    clearTimeout(queueSearchTimerRef.current)
    queueSearchTimerRef.current = null
  }

  const loadQueuePage = (params: {
    page: number
    search: string
    status: QueueStatusFilter
    companyId: string
    departmentId: string
  }) => {
    const token = queueRequestTokenRef.current + 1
    queueRequestTokenRef.current = token
    setQueueLoadError(null)

    startQueueTransition(async () => {
      const response = await getLeaveApprovalQueuePageAction({
        companyId,
        page: params.page,
        pageSize: queueItemsPerPage,
        search: params.search,
        status: params.status,
        filterCompanyId: params.companyId === "ALL" ? undefined : params.companyId,
        departmentId: params.departmentId === "ALL" ? undefined : params.departmentId,
      })

      if (queueRequestTokenRef.current !== token) {
        return
      }

      if (!response.ok) {
        setQueueLoadError(response.error)
        return
      }

      setQueueRowsState(response.data.rows)
      setQueueTotal(response.data.total)
      setRowsPage(response.data.page)
    })
  }

  const scheduleQueueSearch = (nextSearch: string) => {
    setQueueSearch(nextSearch)
    clearQueueSearchTimer()
    queueSearchTimerRef.current = setTimeout(() => {
      loadQueuePage({
        page: 1,
        search: nextSearch,
        status: queueStatus,
        companyId: queueCompanyId,
        departmentId: queueDepartmentId,
      })
    }, 250)
  }

  const loadHistoryPage = (params: {
    page: number
    pageSize: number
    search: string
    status: HistoryStatusFilter
    companyId: string
    departmentId: string
    fromDate: string
    toDate: string
  }) => {
    const token = historyRequestTokenRef.current + 1
    historyRequestTokenRef.current = token
    setHistoryLoadError(null)

    startHistoryTransition(async () => {
      const response = await getLeaveApprovalHistoryPageAction({
        companyId,
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        status: params.status,
        filterCompanyId: params.companyId === "ALL" ? undefined : params.companyId,
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
        companyId: historyCompanyId,
        departmentId: historyDepartmentId,
        fromDate: historyFromDate,
        toDate: historyToDate,
      })
    }, 250)
  }

  useEffect(() => {
    return () => {
      if (queueSearchTimerRef.current) {
        clearTimeout(queueSearchTimerRef.current)
        queueSearchTimerRef.current = null
      }
      if (!historySearchTimerRef.current) return
      clearTimeout(historySearchTimerRef.current)
      historySearchTimerRef.current = null
    }
  }, [])

  const openDecision = (rowId: string, requestCompanyId: string, type: "approve" | "reject") => {
    setSelectedId(rowId)
    setSelectedRequestCompanyId(requestCompanyId)
    setActionType(type)
    setRemarks("")
    setOpen(true)
  }

  const submit = () => {
    if (!selectedId) return

    startTransition(async () => {
      const requestCompanyId = selectedRequestCompanyId ?? companyId
      const response = isHR
        ? actionType === "approve"
          ? await approveLeaveByHrAction({ companyId: requestCompanyId, requestId: selectedId, remarks })
          : await rejectLeaveByHrAction({ companyId: requestCompanyId, requestId: selectedId, remarks })
        : actionType === "approve"
          ? await approveLeaveBySupervisorAction({ companyId: requestCompanyId, requestId: selectedId, remarks })
          : await rejectLeaveBySupervisorAction({ companyId: requestCompanyId, requestId: selectedId, remarks })

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
        <p className="text-xs text-foreground/70">Request Management</p>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Leave Approvals</h1>
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {isHR ? "HR Final Approval" : "Supervisor Queue"}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {(() => {
          const statItems = [
            { label: "Requests In Queue", value: String(stats.totalRequests), icon: IconListCheck },
            { label: "Total Leave Days", value: `${stats.totalDays.toFixed(1)} days`, icon: IconCalendarStats },
            { label: "Employees", value: String(stats.employeeCount), icon: IconUserCircle },
            { label: "Approval Stage", value: isHR ? "HR Final" : "Supervisor", icon: IconClockHour4 },
          ]

          return (
            <>
              <div className="grid grid-cols-2 gap-2 sm:hidden">
                {statItems.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border/60 bg-card p-3">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-xs text-foreground/70">{stat.label}</p>
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
                      <p className="text-xs text-foreground/70">{stat.label}</p>
                      <stat.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-2xl font-semibold text-foreground">{stat.value}</span>
                  </div>
                ))}
              </div>
            </>
          )
        })()}

        {showQueueSection ? (
        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Approval Queue</h2>
            <span className="text-xs text-foreground/70">
              {queueTotal} records{isQueuePending ? " • Loading..." : ""}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="relative col-span-3 sm:w-[360px]">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/70" />
              <Input
                placeholder="Search employee/request..."
                value={queueSearch}
                onChange={(event) => {
                  scheduleQueueSearch(event.target.value)
                }}
                className="rounded-lg pl-8"
              />
            </div>
            <Select
              value={queueStatus}
              onValueChange={(value) => {
                const nextStatus = value as QueueStatusFilter
                setQueueStatus(nextStatus)
                clearQueueSearchTimer()
                loadQueuePage({
                  page: 1,
                  search: queueSearch,
                  status: nextStatus,
                  companyId: queueCompanyId,
                  departmentId: queueDepartmentId,
                })
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
              value={queueCompanyId}
              onValueChange={(value) => {
                setQueueCompanyId(value)
                setQueueDepartmentId("ALL")
                clearQueueSearchTimer()
                loadQueuePage({
                  page: 1,
                  search: queueSearch,
                  status: queueStatus,
                  companyId: value,
                  departmentId: "ALL",
                })
              }}
            >
              <SelectTrigger className="w-full rounded-lg sm:w-[200px]">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="ALL">All companies</SelectItem>
                {companyOptions.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={queueDepartmentId}
              onValueChange={(value) => {
                setQueueDepartmentId(value)
                clearQueueSearchTimer()
                loadQueuePage({
                  page: 1,
                  search: queueSearch,
                  status: queueStatus,
                  companyId: queueCompanyId,
                  departmentId: value,
                })
              }}
            >
              <SelectTrigger className="w-full rounded-lg sm:w-[220px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="ALL">All departments</SelectItem>
                {queueDepartmentOptions.map((department) => (
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
                setQueueCompanyId("ALL")
                setQueueDepartmentId("ALL")
                clearQueueSearchTimer()
                loadQueuePage({
                  page: 1,
                  search: "",
                  status: "ALL",
                  companyId: "ALL",
                  departmentId: "ALL",
                })
              }}
              disabled={!hasActiveQueueFilters}
            >
              <IconFilterOff className="h-4 w-4" />
              <span>Clear</span>
            </Button>
            {view === "queue" ? (
              <Button asChild variant="outline" className="col-span-3 w-full rounded-lg sm:ml-auto sm:w-auto">
                <Link href={`/${companyId}/employee-portal/approval-history`}>
                  View Approval History
                </Link>
              </Button>
            ) : null}
          </div>

          {queueLoadError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {queueLoadError}
            </div>
          ) : null}

          {queueTotal === 0 && !hasActiveQueueFilters ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-foreground/70">No requests pending your approval.</div>
          ) : queueRowsState.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-foreground/70">
              No requests match the current filters.
            </div>
          ) : (
            <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border/60 lg:bg-card">
              <div className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 lg:grid">
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Request #</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Employee</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Leave Type</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Date Range</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Days</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Reason</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Status</p>
                <p className="col-span-2 text-right text-[11px] font-medium uppercase tracking-wide text-foreground/70">Action</p>
              </div>
              <>
                <div className="space-y-2 lg:hidden">
                  {queueRowsState.map((row) => (
                        <div key={row.id} className="rounded-xl border border-border/60 bg-background p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide text-foreground/60">Request</p>
                              <p className="truncate whitespace-nowrap text-sm font-semibold text-foreground">{row.requestNumber}</p>
                            </div>
                            <Badge variant={row.statusCode === "PENDING" ? "secondary" : "default"} className="shrink-0 rounded-full text-[10px]">
                              {toLabel(row.statusCode)}
                            </Badge>
                          </div>

                          <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-foreground/60">Employee</p>
                            <div className="mt-1.5 flex items-center gap-2.5">
                              <Avatar className="h-9 w-9 shrink-0 rounded-md border border-border/60 after:rounded-md">
                                <AvatarImage src={row.employeePhotoUrl ?? undefined} alt={row.employeeName} className="!rounded-md object-cover" />
                                <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                  {getNameInitials(row.employeeName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{row.employeeName}</p>
                                <p className="truncate text-[11px] text-foreground/70">
                                  {row.employeeNumber} • {row.departmentName}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-foreground/60">Leave Type</p>
                              <p className="mt-0.5 line-clamp-1 text-xs font-medium text-foreground">{row.leaveTypeName}</p>
                            </div>
                            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-foreground/60">Duration</p>
                              <p className="mt-0.5 text-xs font-medium text-foreground">{row.numberOfDays} day(s)</p>
                            </div>
                            <div className="col-span-2 rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-foreground/60">
                                <IconCalendarEvent className="h-3.5 w-3.5" />
                                Date Range
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-foreground">{row.startDate} to {row.endDate}</p>
                            </div>
                          </div>

                          <div className="mt-3 rounded-md border border-border/50 bg-muted/30 px-2.5 py-2 text-xs">
                            <p className="text-[10px] uppercase tracking-wide text-foreground/60">Reason</p>
                            <p className="mt-0.5 line-clamp-2 text-foreground">{row.reason ?? "No reason provided."}</p>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="destructive" size="sm" className="rounded-lg text-xs" onClick={() => openDecision(row.id, row.companyId, "reject")} disabled={isPending}>
                                  <IconX className="mr-1 h-3.5 w-3.5" />
                                  Reject
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                Reject this request
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" className="rounded-lg bg-green-600 text-xs hover:bg-green-700" onClick={() => openDecision(row.id, row.companyId, "approve")} disabled={isPending}>
                                  <IconCheck className="mr-1 h-3.5 w-3.5" />
                                  Approve
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                Approve this request
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                </div>

                <div className="hidden lg:block">
                  {queueRowsState.map((row) => (
                        <div key={row.id} className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 px-3 py-4 last:border-b-0 hover:bg-muted/20 lg:grid">
                          <div className="col-span-1 min-w-0">
                            <p className="truncate whitespace-nowrap text-xs text-foreground/70" title={row.requestNumber}>{row.requestNumber}</p>
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
                                  <p className="truncate text-xs text-foreground">{row.employeeName}</p>
                                  <p className="truncate text-[10px] text-foreground/70">{row.employeeNumber}</p>
                                </div>
                              </div>
                          </div>
                          <div className="col-span-2 text-xs text-foreground">{row.leaveTypeName}</div>
                          <div className="col-span-2 whitespace-normal break-words text-xs leading-tight text-foreground">
                            <p>{row.startDate}</p>
                            <p className="text-foreground/70">to {row.endDate}</p>
                          </div>
                          <div className="col-span-1 text-sm text-foreground">{row.numberOfDays}</div>
                          <div className="col-span-1 text-xs text-foreground/70 line-clamp-2">{row.reason ?? "-"}</div>
                          <div className="col-span-1">
                            <Badge variant={row.statusCode === "PENDING" ? "secondary" : "default"} className="w-full justify-center rounded-full text-xs">
                              {toLabel(row.statusCode)}
                            </Badge>
                          </div>
                          <div className="col-span-2 flex justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => openDecision(row.id, row.companyId, "reject")} disabled={isPending}>
                                  <IconX className="mr-1 h-3.5 w-3.5" />
                                  Reject
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                Reject this request
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" className="rounded-lg bg-green-600 hover:bg-green-700" onClick={() => openDecision(row.id, row.companyId, "approve")} disabled={isPending}>
                                  <IconCheck className="mr-1 h-3.5 w-3.5" />
                                  Approve
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                Approve this request
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                </div>
                {queueTotalPages > 1 ? (
                  <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Page {activeRowsPage} of {queueTotalPages} • {queueTotal} records
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={activeRowsPage <= 1 || isQueuePending}
                        onClick={() =>
                          loadQueuePage({
                            page: activeRowsPage - 1,
                            search: queueSearch,
                            status: queueStatus,
                            companyId: queueCompanyId,
                            departmentId: queueDepartmentId,
                          })
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={activeRowsPage >= queueTotalPages || isQueuePending}
                        onClick={() =>
                          loadQueuePage({
                            page: activeRowsPage + 1,
                            search: queueSearch,
                            status: queueStatus,
                            companyId: queueCompanyId,
                            departmentId: queueDepartmentId,
                          })
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            </div>
          )}
        </div>
        ) : null}

        {showHistorySection ? (
        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Approval History</h2>
            <span className="text-xs text-foreground/70">
              {historyTotal} records{isHistoryPending ? " • Loading..." : ""}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-7 sm:gap-3">
            <div className="relative col-span-3 sm:col-span-1">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/70" />
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
                    companyId: historyCompanyId,
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
                value={historyCompanyId}
                onValueChange={(value) => {
                  setHistoryCompanyId(value)
                  setHistoryDepartmentId("ALL")
                  setExpandedHistoryRequestId(null)
                  clearHistorySearchTimer()
                  loadHistoryPage({
                    page: 1,
                    pageSize: historyItemsPerPage,
                    search: historySearch,
                    status: historyStatus,
                    companyId: value,
                    departmentId: "ALL",
                    fromDate: historyFromDate,
                    toDate: historyToDate,
                  })
                }}
              >
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="ALL">All companies</SelectItem>
                  {companyOptions.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
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
                    companyId: historyCompanyId,
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
                  {historyDepartmentOptions.map((department) => (
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
                setHistoryCompanyId("ALL")
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
                  companyId: "ALL",
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
                  <Button variant="outline" className={cn("w-full justify-start rounded-lg text-left", !historyFromDate && "text-foreground/70")}>
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
                        companyId: historyCompanyId,
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
                  <Button variant="outline" className={cn("w-full justify-start rounded-lg text-left", !historyToDate && "text-foreground/70")}>
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
                        companyId: historyCompanyId,
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
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-sm text-foreground/70">
              No approval history found for the selected filters.
            </div>
          ) : (
            <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border/60 lg:bg-card">
              <div className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 lg:grid">
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Request #</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Employee</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Leave Type</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Date Range</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Days</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Reason</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-foreground/70">Status</p>
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
                            <p className="text-[11px] text-foreground/70">Request #</p>
                            <p className="truncate whitespace-nowrap text-sm font-medium text-foreground">{row.requestNumber}</p>
                            <p className="truncate text-xs text-foreground/70">
                              {row.employeeName} • {row.leaveTypeName}
                            </p>
                            <p className="mt-1 text-[11px] text-foreground/70">Decided: {row.decidedAtLabel}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={row.statusCode === "REJECTED" ? "destructive" : "default"} className="shrink-0 text-xs">
                              {toLabel(row.statusCode)}
                            </Badge>
                            <IconChevronDown className={cn("h-4 w-4 text-foreground/70 transition-transform", isExpanded && "rotate-180")} />
                          </div>
                        </div>
                      </button>
                      {isExpanded ? (
                        <div className="space-y-3 border-t border-border/60 bg-muted/30 px-3 py-3 text-xs">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                            <div>
                              <p className="text-[11px] text-foreground/70">Employee</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Avatar className="h-8 w-8 shrink-0 rounded-md border border-border/60 after:rounded-md">
                                  <AvatarImage src={row.employeePhotoUrl ?? undefined} alt={row.employeeName} className="!rounded-md object-cover" />
                                  <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                    {getNameInitials(row.employeeName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate text-foreground">{row.employeeName}</p>
                                  <p className="truncate text-[11px] text-foreground/70">{row.employeeNumber}</p>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] text-foreground/70">Leave Type</p>
                              <p className="text-foreground">{row.leaveTypeName}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-[11px] text-foreground/70">Date Range</p>
                              <p className="text-foreground">{row.startDate} to {row.endDate}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-foreground/70">Days</p>
                              <p className="text-foreground">{row.numberOfDays}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-foreground/70">Status</p>
                              <p className="text-foreground">{toLabel(row.statusCode)}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] text-foreground/70">Reason</p>
                            <p className="text-foreground">{row.reason ?? "-"}</p>
                          </div>
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
                          <p className="truncate whitespace-nowrap text-xs text-foreground/70" title={row.requestNumber}>{row.requestNumber}</p>
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
                              <p className="truncate text-xs text-foreground">{row.employeeName}</p>
                              <p className="truncate text-[10px] text-foreground/70">{row.employeeNumber}</p>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 text-xs text-foreground">{row.leaveTypeName}</div>
                        <div className="col-span-2 whitespace-normal break-words text-xs leading-tight text-foreground">
                          <p>{row.startDate}</p>
                          <p className="text-foreground/70">to {row.endDate}</p>
                        </div>
                        <div className="col-span-1 text-sm text-foreground">{row.numberOfDays}</div>
                        <div className="col-span-2 text-xs text-foreground/70 line-clamp-2">{row.reason ?? "-"}</div>
                        <div className="col-span-2 space-y-1">
                          <Badge variant={row.statusCode === "REJECTED" ? "destructive" : "default"} className="w-full justify-center rounded-full text-xs">
                            {toLabel(row.statusCode)}
                          </Badge>
                          <p className="text-center text-[11px] text-foreground/70">{row.decidedAtLabel}</p>
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
                              className="grid grid-cols-1 gap-2 border-t border-border/60 bg-muted/30 px-4 py-3 text-xs text-foreground/70 md:grid-cols-3"
                            >
                              <div>
                                <p className="font-medium text-foreground">Requested Date Range</p>
                                <p>{row.startDate} to {row.endDate}</p>
                              </div>
                              <div>
                                <p className="font-medium text-foreground">Duration</p>
                                <p>{row.numberOfDays} day(s)</p>
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
                        companyId: historyCompanyId,
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
                        companyId: historyCompanyId,
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
                        companyId: historyCompanyId,
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
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-border/60 shadow-none sm:max-w-2xl">
          <DialogHeader className="mb-1.5 border-b border-border/60 pb-2">
            <DialogTitle className="text-base font-semibold">
              {actionType === "approve" ? "Approve" : "Reject"} Leave Request
            </DialogTitle>
            <DialogDescription className="text-sm text-foreground/70">
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
                      <p className="truncate text-xs text-foreground/70">
                        {selected?.employeeNumber ?? "-"} • {selected?.departmentName ?? "-"}
                      </p>
                      <p className="mt-1 truncate text-xs text-foreground/70">Request {selected?.requestNumber ?? "-"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                    {selected ? (
                      <Badge variant={selected.statusCode === "REJECTED" ? "destructive" : "secondary"} className="rounded-full text-[10px]">
                        {toLabel(selected.statusCode)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-foreground/70">Leave Type</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">{selected?.leaveTypeName ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-foreground/70">Duration</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">
                    {selected ? `${selected.numberOfDays} day(s)` : "-"}
                  </p>
                </div>
                <div className="hidden sm:block sm:col-span-1">
                  <p className="text-[11px] uppercase tracking-wide text-foreground/70">Decision Stage</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">{isHR ? "HR Final Approval" : "Supervisor Approval"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-foreground/70">Start Date</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">{selected?.startDate ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-foreground/70">End Date</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">{selected?.endDate ?? "-"}</p>
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
