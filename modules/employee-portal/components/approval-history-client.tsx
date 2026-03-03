"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import {
  IconCalendarEvent,
  IconClockHour4,
  IconExternalLink,
  IconFilterOff,
  IconPackage,
  IconSearch,
} from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getConsolidatedApprovalHistoryPageAction } from "@/modules/employee-portal/actions/approval-history-actions"
import type {
  ConsolidatedApprovalStatusFilter,
  ConsolidatedApprovalTypeFilter,
  EmployeePortalConsolidatedApprovalHistoryItem,
  EmployeePortalConsolidatedApprovalHistoryStats,
} from "@/modules/employee-portal/utils/approval-history-read-model"

type ApprovalHistoryClientProps = {
  companyId: string
  initialRows: EmployeePortalConsolidatedApprovalHistoryItem[]
  initialTotal: number
  initialPage: number
  initialPageSize: number
  initialStats: EmployeePortalConsolidatedApprovalHistoryStats
  initialStatusOptions: ConsolidatedApprovalStatusFilter[]
}

const toStatusLabel = (statusCode: string): string => statusCode.replace(/_/g, " ")

const statusVariant = (statusCode: string): "default" | "secondary" | "destructive" | "outline" => {
  if (statusCode.includes("REJECT")) return "destructive"
  if (statusCode.includes("APPROVED")) return "default"
  if (statusCode.includes("CANCELLED")) return "outline"
  return "secondary"
}

const typeBadgeVariant = (
  approvalType: EmployeePortalConsolidatedApprovalHistoryItem["approvalType"]
): "default" | "secondary" | "destructive" | "outline" => {
  if (approvalType === "LEAVE") return "secondary"
  if (approvalType === "OVERTIME") return "outline"
  return "default"
}

const typeBadgeLabel = (approvalType: EmployeePortalConsolidatedApprovalHistoryItem["approvalType"]): string => {
  if (approvalType === "MATERIAL") return "MRS"
  return approvalType
}

const getNameInitials = (fullName: string): string => {
  const initials = fullName
    .split(" ")
    .filter((part) => part.trim().length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return initials || "AP"
}

const buildPaginationItems = (currentPage: number, totalPages: number): Array<number | "ellipsis-start" | "ellipsis-end"> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [1]
  const windowStart = Math.max(2, currentPage - 1)
  const windowEnd = Math.min(totalPages - 1, currentPage + 1)

  if (windowStart > 2) {
    items.push("ellipsis-start")
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page)
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis-end")
  }

  items.push(totalPages)
  return items
}

export function ApprovalHistoryClient({
  companyId,
  initialRows,
  initialTotal,
  initialPage,
  initialPageSize,
  initialStats,
  initialStatusOptions,
}: ApprovalHistoryClientProps) {
  const requestTokenRef = useRef(0)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<ConsolidatedApprovalTypeFilter>("ALL")
  const [statusFilter, setStatusFilter] = useState<ConsolidatedApprovalStatusFilter>("ALL")
  const [rowsState, setRowsState] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [stats, setStats] = useState(initialStats)
  const [statusOptions, setStatusOptions] = useState(initialStatusOptions)
  const [loadError, setLoadError] = useState<string | null>(null)
  const ITEMS_PER_PAGE = initialPageSize

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const hasActiveFilters = search.trim().length > 0 || typeFilter !== "ALL" || statusFilter !== "ALL"
  const paginationItems = buildPaginationItems(safeCurrentPage, totalPages)

  const clearSearchTimer = () => {
    if (!searchTimerRef.current) return
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = null
  }

  useEffect(() => {
    return () => {
      if (!searchTimerRef.current) return
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
  }, [])

  const loadHistoryPage = (params: {
    page: number
    search: string
    type: ConsolidatedApprovalTypeFilter
    status: ConsolidatedApprovalStatusFilter
  }) => {
    const token = requestTokenRef.current + 1
    requestTokenRef.current = token
    setLoadError(null)

    startTransition(async () => {
      const response = await getConsolidatedApprovalHistoryPageAction({
        companyId,
        page: params.page,
        pageSize: ITEMS_PER_PAGE,
        search: params.search,
        type: params.type,
        status: params.status,
      })

      if (requestTokenRef.current !== token) {
        return
      }

      if (!response.ok) {
        setLoadError(response.error)
        return
      }

      setRowsState(response.data.rows)
      setTotal(response.data.total)
      setCurrentPage(response.data.page)
      setStats(response.data.stats)
      setStatusOptions(response.data.statusOptions)
    })
  }

  const scheduleSearch = (nextSearch: string) => {
    setSearch(nextSearch)
    clearSearchTimer()
    searchTimerRef.current = setTimeout(() => {
      loadHistoryPage({
        page: 1,
        search: nextSearch,
        type: typeFilter,
        status: statusFilter,
      })
    }, 250)
  }

  const goToPage = (page: number) => {
    loadHistoryPage({
      page,
      search,
      type: typeFilter,
      status: statusFilter,
    })
  }

  const clearFilters = () => {
    setSearch("")
    setTypeFilter("ALL")
    setStatusFilter("ALL")
    clearSearchTimer()
    loadHistoryPage({
      page: 1,
      search: "",
      type: "ALL",
      status: "ALL",
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">Approval Workspace</p>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Approval History</h1>
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Consolidated
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-xs text-muted-foreground">Leave</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{stats.leave}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-xs text-muted-foreground">Overtime</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{stats.overtime}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-xs text-muted-foreground">Material</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{stats.material}</p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3 lg:flex-nowrap">
            <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:contents">
              <div className="relative w-full sm:w-[22rem]">
                <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search request #, employee, department..."
                  value={search}
                  onChange={(event) => {
                    scheduleSearch(event.target.value)
                  }}
                  className="w-full rounded-lg pl-8 !text-xs/relaxed placeholder:text-xs/relaxed"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-lg sm:hidden"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                aria-label="Clear filters"
              >
                <IconFilterOff className="h-4 w-4" />
              </Button>
            </div>
            <div className="col-span-1 min-w-0 sm:w-auto">
              <Select
                value={typeFilter}
                onValueChange={(value) => {
                  const nextType = value as ConsolidatedApprovalTypeFilter
                  setTypeFilter(nextType)
                  setStatusFilter("ALL")
                  clearSearchTimer()
                  loadHistoryPage({
                    page: 1,
                    search,
                    type: nextType,
                    status: "ALL",
                  })
                }}
              >
                <SelectTrigger className="h-9 w-full rounded-lg !text-xs/relaxed sm:min-w-[8.75rem]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="ALL">All types</SelectItem>
                  <SelectItem value="LEAVE">Leave</SelectItem>
                  <SelectItem value="OVERTIME">Overtime</SelectItem>
                  <SelectItem value="MATERIAL">Material</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 min-w-0 sm:w-auto">
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  const nextStatus = value as ConsolidatedApprovalStatusFilter
                  setStatusFilter(nextStatus)
                  clearSearchTimer()
                  loadHistoryPage({
                    page: 1,
                    search,
                    type: typeFilter,
                    status: nextStatus,
                  })
                }}
              >
                <SelectTrigger className="h-9 w-full rounded-lg !text-xs/relaxed sm:min-w-[10.5rem]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {statusOptions.filter((statusCode) => statusCode !== "ALL").map((statusCode) => (
                    <SelectItem key={statusCode} value={statusCode}>
                      {toStatusLabel(statusCode)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="hidden rounded-lg sm:inline-flex"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              <IconFilterOff className="h-4 w-4" />
              <span>Clear Filters</span>
            </Button>
          </div>

          {loadError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {loadError}
            </div>
          ) : null}

          {rowsState.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              No approval history records for current filters.
            </div>
          ) : (
            <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border/60 lg:bg-card">
              <div className="space-y-2 lg:hidden">
                {rowsState.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Request</p>
                        <p className="truncate text-sm font-semibold text-foreground">{item.requestNumber}</p>
                      </div>
                      <Badge variant={typeBadgeVariant(item.approvalType)} className="rounded-full text-[10px]">
                        {typeBadgeLabel(item.approvalType)}
                      </Badge>
                    </div>

                    <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Employee</p>
                      <div className="mt-1.5 flex items-center gap-2.5">
                        <Avatar className="h-9 w-9 shrink-0 rounded-md border border-border/60 after:rounded-md">
                          <AvatarImage src={item.photoUrl ?? undefined} alt={item.employeeName} className="!rounded-md object-cover" />
                          <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                            {getNameInitials(item.employeeName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{item.employeeName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {item.employeeNumber} • {item.departmentName}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Summary</p>
                        <p className="mt-0.5 text-xs font-medium text-foreground">{item.summaryPrimary}</p>
                      </div>
                      <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                        <Badge variant={statusVariant(item.statusCode)} className="mt-1 rounded-full text-[10px]">
                          {toStatusLabel(item.statusCode)}
                        </Badge>
                      </div>
                      <div className="col-span-2 rounded-md border border-border/60 bg-background px-2.5 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Additional Info</p>
                        <p className="mt-0.5 text-xs font-medium text-foreground">{item.summarySecondary}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                      <p className="text-xs text-muted-foreground">Decided {item.decidedAtLabel}</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button asChild size="sm" className="rounded-lg bg-primary px-2 text-xs hover:bg-primary/90">
                            <Link href={item.requestHref}>
                              <IconExternalLink className="h-3.5 w-3.5" />
                              <span className="sr-only">Open details</span>
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                          Open details
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block">
                <div className="grid grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2">
                  <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request</p>
                  <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Type</p>
                  <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Employee</p>
                  <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
                  <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Decided At</p>
                  <p className="col-span-1 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                </div>
                {rowsState.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/20">
                    <div className="col-span-2 truncate text-xs text-foreground" title={item.requestNumber}>
                      {item.requestNumber}
                    </div>
                    <div className="col-span-2">
                      <Badge variant={typeBadgeVariant(item.approvalType)} className="rounded-full text-[10px]">
                        {typeBadgeLabel(item.approvalType)}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0 rounded-md border border-border/60 after:rounded-md">
                          <AvatarImage src={item.photoUrl ?? undefined} alt={item.employeeName} className="!rounded-md object-cover" />
                          <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                            {getNameInitials(item.employeeName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-xs text-foreground">{item.employeeName}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{item.employeeNumber}</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <p className="truncate text-xs text-foreground">{item.summaryPrimary}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{item.summarySecondary}</p>
                    </div>
                    <div className="col-span-1 min-w-0">
                      <Badge variant={statusVariant(item.statusCode)} className="max-w-full rounded-full text-[10px]">
                        <span className="truncate">{toStatusLabel(item.statusCode)}</span>
                      </Badge>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">{item.decidedAtLabel}</div>
                    <div className="col-span-1 flex justify-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button asChild size="sm" className="rounded-lg bg-primary hover:bg-primary/90">
                            <Link href={item.requestHref}>
                              <IconExternalLink className="h-3.5 w-3.5" />
                              <span className="sr-only">Open details</span>
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                          Open details
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>

	              {totalPages > 1 ? (
	                <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
	                  <p className="text-xs text-muted-foreground">
	                    Page {safeCurrentPage} of {totalPages} • {total} records{isPending ? " • Loading..." : ""}
	                  </p>
	                  <div className="flex flex-wrap items-center gap-1.5">
	                    <Button
	                      variant="outline"
	                      size="sm"
	                      className="h-8 rounded-lg text-xs"
	                      disabled={safeCurrentPage <= 1 || isPending}
	                      onClick={() => goToPage(Math.max(1, safeCurrentPage - 1))}
	                    >
	                      Previous
	                    </Button>
	                    {paginationItems.map((item) => {
	                      if (item === "ellipsis-start" || item === "ellipsis-end") {
	                        return (
	                          <span key={item} className="px-1 text-xs text-muted-foreground">
	                            ...
	                          </span>
	                        )
	                      }

	                      const isActivePage = item === safeCurrentPage
	                      return (
	                        <Button
	                          key={item}
	                          variant={isActivePage ? "default" : "outline"}
	                          size="sm"
	                          className="h-8 min-w-8 rounded-lg px-2 text-xs"
	                          disabled={isPending || isActivePage}
	                          onClick={() => goToPage(item)}
	                        >
	                          {item}
	                        </Button>
	                      )
	                    })}
	                    <Button
	                      variant="outline"
	                      size="sm"
	                      className="h-8 rounded-lg text-xs"
	                      disabled={safeCurrentPage >= totalPages || isPending}
	                      onClick={() => goToPage(Math.min(totalPages, safeCurrentPage + 1))}
	                    >
	                      Next
	                    </Button>
	                  </div>
	                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={`/${companyId}/employee-portal/leave-approvals`}>
              <IconCalendarEvent className="mr-2 h-4 w-4" />
              Leave Queue
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={`/${companyId}/employee-portal/overtime-approvals`}>
              <IconClockHour4 className="mr-2 h-4 w-4" />
              Overtime Queue
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={`/${companyId}/employee-portal/material-request-approvals`}>
              <IconPackage className="mr-2 h-4 w-4" />
              Material Queue
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
