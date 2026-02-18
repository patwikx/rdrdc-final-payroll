"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconCheck,
  IconFileCheck,
  IconFilterOff,
  IconSearch,
  IconTimeline,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { cn } from "@/lib/utils"
import {
  approveMaterialRequestStepAction,
  getMaterialRequestApprovalDecisionDetailsAction,
  getMaterialRequestApprovalHistoryDetailsAction,
  getMaterialRequestApprovalHistoryPageAction,
  rejectMaterialRequestStepAction,
} from "@/modules/material-requests/actions/material-request-approval-actions"
import type {
  EmployeePortalMaterialRequestDepartmentOption,
  EmployeePortalMaterialRequestApprovalDecisionDetail,
  EmployeePortalMaterialRequestApprovalHistoryDetail,
  EmployeePortalMaterialRequestApprovalHistoryRow,
  EmployeePortalMaterialRequestApprovalQueueRow,
} from "@/modules/material-requests/types/employee-portal-material-request-types"

type MaterialRequestApprovalClientProps = {
  companyId: string
  isHR: boolean
  departmentOptions: EmployeePortalMaterialRequestDepartmentOption[]
  rows: EmployeePortalMaterialRequestApprovalQueueRow[]
  historyRows: EmployeePortalMaterialRequestApprovalHistoryRow[]
  initialHistoryTotal: number
  initialHistoryPage: number
  initialHistoryPageSize: number
}

type HistoryStatusFilter = "ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED"

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const HISTORY_SEARCH_DEBOUNCE_MS = 350

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "CANCELLED") return "outline"
  if (status === "DRAFT") return "outline"
  return "secondary"
}

const statusLabel = (status: string): string => status.replace(/_/g, " ")

const getNameInitials = (fullName: string): string => {
  const initials = fullName
    .split(" ")
    .filter((part) => part.trim().length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return initials || "MR"
}

export function MaterialRequestApprovalClient({
  companyId,
  isHR,
  departmentOptions,
  rows,
  historyRows,
  initialHistoryTotal,
  initialHistoryPage,
  initialHistoryPageSize,
}: MaterialRequestApprovalClientProps) {
  const router = useRouter()
  const historyRequestTokenRef = useRef(0)
  const historySearchDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [decisionType, setDecisionType] = useState<"approve" | "reject">("approve")
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [remarks, setRemarks] = useState("")
  const [queueSearch, setQueueSearch] = useState("")
  const [queueDepartmentId, setQueueDepartmentId] = useState<string>("ALL")
  const [historySearch, setHistorySearch] = useState("")
  const [historyStatus, setHistoryStatus] = useState<HistoryStatusFilter>("ALL")
  const [historyDepartmentId, setHistoryDepartmentId] = useState<string>("ALL")
  const [isPending, startTransition] = useTransition()
  const [isDetailPending, startDetailTransition] = useTransition()
  const [isHistoryPending, startHistoryTransition] = useTransition()
  const [isHistoryDetailPending, startHistoryDetailTransition] = useTransition()
  const [queuePage, setQueuePage] = useState(1)
  const [historyRowsState, setHistoryRowsState] = useState(historyRows)
  const [historyTotal, setHistoryTotal] = useState(initialHistoryTotal)
  const [historyPage, setHistoryPage] = useState(initialHistoryPage)
  const [historyPageSize, setHistoryPageSize] = useState(String(initialHistoryPageSize))
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null)
  const [decisionDetail, setDecisionDetail] = useState<EmployeePortalMaterialRequestApprovalDecisionDetail | null>(null)
  const [decisionDetailError, setDecisionDetailError] = useState<string | null>(null)
  const [expandedHistoryRequestId, setExpandedHistoryRequestId] = useState<string | null>(null)
  const [historyDetailsById, setHistoryDetailsById] = useState<Record<string, EmployeePortalMaterialRequestApprovalHistoryDetail>>({})
  const [historyDetailErrorById, setHistoryDetailErrorById] = useState<Record<string, string>>({})
  const [historyDetailLoadingId, setHistoryDetailLoadingId] = useState<string | null>(null)

  const ITEMS_PER_PAGE = 10
  const historyItemsPerPage = Number(historyPageSize)
  const DECISION_ITEMS_PAGE_SIZE = 12
  const debouncedQueueSearch = useDebouncedValue(queueSearch, 180)

  const selectedRequest = useMemo(() => rows.find((row) => row.id === selectedRequestId) ?? null, [rows, selectedRequestId])
  const filteredQueueRows = useMemo(() => {
    const query = debouncedQueueSearch.trim().toLowerCase()
    if (!query && queueDepartmentId === "ALL") {
      return rows
    }

    return rows.filter((row) => {
      if (queueDepartmentId !== "ALL" && row.departmentId !== queueDepartmentId) {
        return false
      }

      const haystack = [
        row.requestNumber,
        row.requesterName,
        row.requesterEmployeeNumber,
        row.departmentName,
        row.datePreparedLabel,
        row.dateRequiredLabel,
        row.submittedAtLabel ?? "",
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [debouncedQueueSearch, queueDepartmentId, rows])

  const queueStats = useMemo(() => {
    return rows.reduce(
      (accumulator, row) => {
        accumulator.requests += 1
        accumulator.totalAmount += row.grandTotal
        accumulator.requesters.add(row.requesterEmployeeNumber)
        return accumulator
      },
      {
        requests: 0,
        totalAmount: 0,
        requesters: new Set<string>(),
      }
    )
  }, [rows])

  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyItemsPerPage))
  const activeHistoryPage = Math.min(historyPage, historyTotalPages)
  const hasQueueFilters = queueSearch.trim().length > 0 || queueDepartmentId !== "ALL"

  const clearHistorySearchDebounceTimeout = () => {
    if (!historySearchDebounceTimeoutRef.current) {
      return
    }

    clearTimeout(historySearchDebounceTimeoutRef.current)
    historySearchDebounceTimeoutRef.current = null
  }

  useEffect(() => {
    return () => {
      if (historySearchDebounceTimeoutRef.current) {
        clearTimeout(historySearchDebounceTimeoutRef.current)
      }
    }
  }, [])

  const loadHistoryPage = (params: {
    page: number
    pageSize: number
    search: string
    status: HistoryStatusFilter
    departmentId: string
  }) => {
    const token = historyRequestTokenRef.current + 1
    historyRequestTokenRef.current = token
    setHistoryLoadError(null)

    startHistoryTransition(async () => {
      const response = await getMaterialRequestApprovalHistoryPageAction({
        companyId,
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        status: params.status,
        departmentId: params.departmentId === "ALL" ? undefined : params.departmentId,
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

  const loadDecisionDetail = (requestId: string, page: number) => {
    setDecisionDetailError(null)
    startDetailTransition(async () => {
      const response = await getMaterialRequestApprovalDecisionDetailsAction({
        companyId,
        requestId,
        page,
        pageSize: DECISION_ITEMS_PAGE_SIZE,
      })

      if (!response.ok) {
        setDecisionDetailError(response.error)
        return
      }

      setDecisionDetail(response.data)
    })
  }

  const openDecisionDialog = (requestId: string, type: "approve" | "reject") => {
    setSelectedRequestId(requestId)
    setDecisionType(type)
    setRemarks("")
    setDecisionDetail(null)
    setDecisionDetailError(null)
    setOpen(true)
    loadDecisionDetail(requestId, 1)
  }

  const toggleHistoryDetails = (requestId: string) => {
    if (expandedHistoryRequestId === requestId) {
      setExpandedHistoryRequestId(null)
      return
    }

    setExpandedHistoryRequestId(requestId)
    if (historyDetailsById[requestId] || historyDetailLoadingId === requestId) {
      return
    }

    setHistoryDetailLoadingId(requestId)
    startHistoryDetailTransition(async () => {
      const response = await getMaterialRequestApprovalHistoryDetailsAction({
        companyId,
        requestId,
      })

      setHistoryDetailLoadingId((current) => (current === requestId ? null : current))

      if (!response.ok) {
        setHistoryDetailErrorById((previous) => ({
          ...previous,
          [requestId]: response.error,
        }))
        return
      }

      setHistoryDetailErrorById((previous) => {
        const next = { ...previous }
        delete next[requestId]
        return next
      })
      setHistoryDetailsById((previous) => ({
        ...previous,
        [requestId]: response.data,
      }))
    })
  }

  const submitDecision = () => {
    if (!selectedRequestId) {
      return
    }

    startTransition(async () => {
      const response =
        decisionType === "approve"
          ? await approveMaterialRequestStepAction({
              companyId,
              requestId: selectedRequestId,
              remarks,
            })
          : await rejectMaterialRequestStepAction({
              companyId,
              requestId: selectedRequestId,
              remarks,
            })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      setOpen(false)
      router.refresh()
    })
  }

  const hasHistoryFilters =
    historySearch.trim().length > 0 || historyStatus !== "ALL" || historyDepartmentId !== "ALL"

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">Approval Workspace</p>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Material Request Approvals</h1>
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {isHR ? "HR/Admin Reviewer" : "Assigned Reviewer"}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {(() => {
          const statItems = [
            { label: "Requests In Queue", value: String(queueStats.requests), icon: IconFileCheck },
            { label: "Total Amount", value: `PHP ${currency.format(queueStats.totalAmount)}`, icon: IconTimeline },
            { label: "Requesters", value: String(queueStats.requesters.size), icon: IconUserCircle },
            { label: "History Rows", value: String(historyTotal), icon: IconTimeline },
          ]

          return (
            <>
              <div className="grid grid-cols-2 gap-2 sm:hidden">
                {statItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/60 bg-card p-3">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-lg font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="hidden grid-cols-1 gap-3 sm:grid md:grid-cols-2 lg:grid-cols-4">
                {statItems.map((item) => (
                  <div key={item.label} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-2xl font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )
        })()}

        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Approval Queue</h2>
            <span className="text-xs text-muted-foreground">{filteredQueueRows.length} records</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-[280px] sm:w-[360px]">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search request #, requester, department..."
                value={queueSearch}
                onChange={(event) => {
                  setQueueSearch(event.target.value)
                  setQueuePage(1)
                }}
                className="rounded-lg pl-8"
              />
            </div>
            <Select
              value={queueDepartmentId}
              onValueChange={(value) => {
                setQueueDepartmentId(value)
                setQueuePage(1)
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
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                setQueueSearch("")
                setQueueDepartmentId("ALL")
                setQueuePage(1)
              }}
              disabled={!hasQueueFilters}
            >
              <IconFilterOff className="h-4 w-4" />
            </Button>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
              No material requests pending your current approval step.
            </div>
          ) : filteredQueueRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
              No requests match the current filters.
            </div>
          ) : (
            <div className="overflow-hidden border border-border/60 bg-card">
              <div className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 lg:grid">
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request #</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Requester</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dept</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prepared / Required</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Step</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Submitted</p>
                <p className="col-span-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
              </div>

              {(() => {
                const totalPages = Math.max(1, Math.ceil(filteredQueueRows.length / ITEMS_PER_PAGE))
                const safeQueuePage = Math.min(queuePage, totalPages)
                const startIndex = (safeQueuePage - 1) * ITEMS_PER_PAGE
                const paginatedRows = filteredQueueRows.slice(startIndex, startIndex + ITEMS_PER_PAGE)

                return (
                  <>
                    <div className="space-y-2 p-3 lg:hidden">
                      {paginatedRows.map((row) => (
                        <motion.div
                          key={`queue-mobile-${row.id}`}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                          className="rounded-xl border border-border/60 bg-background p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] text-muted-foreground">Request #</p>
                              <p className="truncate whitespace-nowrap text-sm font-medium text-foreground">{row.requestNumber}</p>
                            </div>
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              Step {row.currentStep}/{row.requiredSteps}
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                            <div>
                              <p className="text-[11px] text-muted-foreground">Requester</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Avatar className="h-7 w-7 shrink-0 rounded-md border border-border/60 after:rounded-md">
                                  <AvatarImage
                                    src={row.requesterPhotoUrl ?? undefined}
                                    alt={row.requesterName}
                                    className="!rounded-md object-cover"
                                  />
                                  <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                    {getNameInitials(row.requesterName)}
                                  </AvatarFallback>
                                </Avatar>
                                <p className="truncate text-foreground">{row.requesterName}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Department</p>
                              <p className="text-foreground">{row.departmentName}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-[11px] text-muted-foreground">Date Range</p>
                              <p className="text-foreground">{row.datePreparedLabel} to {row.dateRequiredLabel}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Amount</p>
                              <p className="text-foreground">PHP {currency.format(row.grandTotal)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Submitted</p>
                              <p className="text-foreground">{row.submittedAtLabel ?? "-"}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="rounded-lg text-xs"
                              disabled={isPending || isDetailPending}
                              onClick={() => openDecisionDialog(row.id, "reject")}
                            >
                              <IconX className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-lg bg-green-600 text-xs hover:bg-green-700"
                              disabled={isPending || isDetailPending}
                              onClick={() => openDecisionDialog(row.id, "approve")}
                            >
                              <IconCheck className="mr-1 h-3.5 w-3.5" />
                              Approve
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="hidden lg:block">
                      {paginatedRows.map((row) => (
                        <motion.div
                          key={row.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                          className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/20 lg:grid"
                        >
                          <div className="col-span-1 truncate whitespace-nowrap text-xs text-foreground" title={row.requestNumber}>
                            {row.requestNumber}
                          </div>
                          <div className="col-span-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7 shrink-0 rounded-md border border-border/60 after:rounded-md">
                                <AvatarImage
                                  src={row.requesterPhotoUrl ?? undefined}
                                  alt={row.requesterName}
                                  className="!rounded-md object-cover"
                                />
                                <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                  {getNameInitials(row.requesterName)}
                                </AvatarFallback>
                              </Avatar>
                              <p className="truncate text-xs text-foreground">{row.requesterName}</p>
                            </div>
                          </div>
                          <div className="col-span-1 truncate whitespace-nowrap text-xs text-foreground" title={row.departmentName}>
                            {row.departmentName}
                          </div>
                          <div className="col-span-2 text-xs text-foreground">
                            <p>{row.datePreparedLabel}</p>
                            <p className="text-muted-foreground">to {row.dateRequiredLabel}</p>
                          </div>
                          <div className="col-span-1 text-sm text-foreground">{row.currentStep}/{row.requiredSteps}</div>
                          <div className="col-span-2 text-sm font-medium text-foreground">PHP {currency.format(row.grandTotal)}</div>
                          <div className="col-span-1 text-xs text-muted-foreground">{row.submittedAtLabel ?? "-"}</div>
                          <div className="col-span-2 flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="rounded-lg"
                              disabled={isPending || isDetailPending}
                              onClick={() => openDecisionDialog(row.id, "reject")}
                            >
                              <IconX className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-lg bg-green-600 hover:bg-green-700"
                              disabled={isPending || isDetailPending}
                              onClick={() => openDecisionDialog(row.id, "approve")}
                            >
                              <IconCheck className="mr-1 h-3.5 w-3.5" />
                              Approve
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {totalPages > 1 ? (
                      <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Page {safeQueuePage} of {totalPages} • {filteredQueueRows.length} records
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            disabled={safeQueuePage <= 1}
                            onClick={() => setQueuePage(safeQueuePage - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            disabled={safeQueuePage >= totalPages}
                            onClick={() => setQueuePage(safeQueuePage + 1)}
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[360px_minmax(0,1fr)]">
            <div className="relative min-w-0">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search request #, requester, department..."
                value={historySearch}
                onChange={(event) => {
                  const nextSearch = event.target.value
                  setHistorySearch(nextSearch)
                  setExpandedHistoryRequestId(null)
                  clearHistorySearchDebounceTimeout()
                  historySearchDebounceTimeoutRef.current = setTimeout(() => {
                    loadHistoryPage({
                      page: 1,
                      pageSize: historyItemsPerPage,
                      search: nextSearch,
                      status: historyStatus,
                      departmentId: historyDepartmentId,
                    })
                  }, HISTORY_SEARCH_DEBOUNCE_MS)
                }}
                className="rounded-lg pl-8"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return
                  }

                  event.preventDefault()
                  clearHistorySearchDebounceTimeout()
                  loadHistoryPage({
                    page: 1,
                    pageSize: historyItemsPerPage,
                    search: historySearch,
                    status: historyStatus,
                    departmentId: historyDepartmentId,
                  })
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={historyStatus}
                onValueChange={(value) => {
                  const nextStatus = value as HistoryStatusFilter
                  setHistoryStatus(nextStatus)
                  setExpandedHistoryRequestId(null)
                  clearHistorySearchDebounceTimeout()
                  loadHistoryPage({
                    page: 1,
                    pageSize: historyItemsPerPage,
                    search: historySearch,
                    status: nextStatus,
                    departmentId: historyDepartmentId,
                  })
                }}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={historyDepartmentId}
                onValueChange={(value) => {
                  setHistoryDepartmentId(value)
                  setExpandedHistoryRequestId(null)
                  clearHistorySearchDebounceTimeout()
                  loadHistoryPage({
                    page: 1,
                    pageSize: historyItemsPerPage,
                    search: historySearch,
                    status: historyStatus,
                    departmentId: value,
                  })
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
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  setHistorySearch("")
                  setHistoryStatus("ALL")
                  setHistoryDepartmentId("ALL")
                  setExpandedHistoryRequestId(null)
                  clearHistorySearchDebounceTimeout()
                  loadHistoryPage({
                    page: 1,
                    pageSize: historyItemsPerPage,
                    search: "",
                    status: "ALL",
                    departmentId: "ALL",
                  })
                }}
                disabled={!hasHistoryFilters}
              >
                <IconFilterOff className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {historyLoadError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {historyLoadError}
            </div>
          ) : null}

          {historyRowsState.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              No history records for current filters.
            </div>
          ) : (
            <div className="overflow-hidden border border-border/60 bg-card">
              <div className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 lg:grid">
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request #</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Requester</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dept</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Date Required</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="col-span-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Remarks</p>
              </div>

              {(() => {
                return (
                  <>
                    {historyRowsState.map((row) => {
                      const isExpanded = expandedHistoryRequestId === row.id
                      const detail = historyDetailsById[row.id]
                      const detailError = historyDetailErrorById[row.id]
                      const isLoadingDetail = historyDetailLoadingId === row.id && isHistoryDetailPending

                      return (
                        <div
                          key={row.id}
                          className={cn(
                            "group border-b border-border/60 last:border-b-0 transition-colors",
                            isExpanded && "bg-primary/10"
                          )}
                        >
                          <button
                            type="button"
                            className="w-full px-3 py-3 text-left hover:bg-muted/20 lg:hidden"
                            onClick={() => toggleHistoryDetails(row.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[11px] text-muted-foreground">Request #</p>
                                <p className="truncate whitespace-nowrap text-sm font-medium text-foreground">{row.requestNumber}</p>
                              </div>
                              <Badge variant={statusVariant(row.status)} className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]">
                                {statusLabel(row.status)}
                              </Badge>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                              <div>
                                <p className="text-[11px] text-muted-foreground">Requester</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <Avatar className="h-7 w-7 shrink-0 rounded-md border border-border/60 after:rounded-md">
                                    <AvatarImage
                                      src={row.requesterPhotoUrl ?? undefined}
                                      alt={row.requesterName}
                                      className="!rounded-md object-cover"
                                    />
                                    <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                      {getNameInitials(row.requesterName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <p className="truncate text-foreground">{row.requesterName}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground">Department</p>
                                <p className="text-foreground">{row.departmentName}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground">Date Required</p>
                                <p className="text-foreground">{row.dateRequiredLabel}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground">Amount</p>
                                <p className="text-foreground">PHP {currency.format(row.grandTotal)}</p>
                              </div>
                            </div>
                          </button>
                          <div
                            className="hidden cursor-pointer grid-cols-12 items-start gap-3 px-3 py-2 hover:bg-muted/20 lg:grid"
                            onClick={() => toggleHistoryDetails(row.id)}
                          >
                            <div className="col-span-1 truncate whitespace-nowrap text-xs text-foreground" title={row.requestNumber}>
                              {row.requestNumber}
                            </div>
                            <div className="col-span-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7 shrink-0 rounded-md border border-border/60 after:rounded-md">
                                  <AvatarImage
                                    src={row.requesterPhotoUrl ?? undefined}
                                    alt={row.requesterName}
                                    className="!rounded-md object-cover"
                                  />
                                  <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                    {getNameInitials(row.requesterName)}
                                  </AvatarFallback>
                                </Avatar>
                                <p className="truncate text-xs text-foreground">{row.requesterName}</p>
                              </div>
                            </div>
                            <div className="col-span-2 truncate whitespace-nowrap text-xs text-foreground" title={row.departmentName}>
                              {row.departmentName}
                            </div>
                            <div className="col-span-2 text-xs text-foreground">{row.dateRequiredLabel}</div>
                            <div className="col-span-1 text-xs text-foreground">PHP {currency.format(row.grandTotal)}</div>
                            <div className="col-span-1">
                              <Badge variant={statusVariant(row.status)} className="rounded-full border px-2 py-0.5 text-[10px]">
                                {statusLabel(row.status)}
                              </Badge>
                            </div>
                            <div className="col-span-3 text-xs text-muted-foreground">
                              {row.actedRemarks ?? row.finalDecisionRemarks ?? "-"}
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
                                  className="space-y-3 border-t border-border/60 bg-muted/30 px-4 py-3"
                                >
                              {isLoadingDetail ? (
                                <div className="rounded-lg border border-border/60 bg-background px-3 py-6 text-center text-xs text-muted-foreground">
                                  Loading request details...
                                </div>
                              ) : null}

                              {detailError ? (
                                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                                  {detailError}
                                </div>
                              ) : null}

                              {detail ? (
                                <>
                                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground lg:grid-cols-4">
                                    <div>
                                      <p className="font-medium text-foreground">Series / Type</p>
                                      <p>{detail.series}/{detail.requestType}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium text-foreground">Submitted At</p>
                                      <p>{detail.submittedAtLabel ?? "-"}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium text-foreground">Approved At</p>
                                      <p>{detail.approvedAtLabel ?? "-"}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium text-foreground">Rejected At</p>
                                      <p>{detail.rejectedAtLabel ?? "-"}</p>
                                    </div>
                                  </div>

                                  {detail.purpose || detail.remarks || detail.finalDecisionRemarks ? (
                                    <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-3">
                                      {detail.purpose ? (
                                        <div>
                                          <p className="font-medium text-foreground">Purpose</p>
                                          <p>{detail.purpose}</p>
                                        </div>
                                      ) : null}
                                      {detail.remarks ? (
                                        <div>
                                          <p className="font-medium text-foreground">Remarks</p>
                                          <p>{detail.remarks}</p>
                                        </div>
                                      ) : null}
                                      {detail.finalDecisionRemarks ? (
                                        <div>
                                          <p className="font-medium text-foreground">Decision Remarks</p>
                                          <p>{detail.finalDecisionRemarks}</p>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className="overflow-hidden border border-border/60 bg-card">
                                    <div className="overflow-x-auto">
                                      <div className="min-w-[720px]">
                                        <div className="grid grid-cols-12 items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-2">
                                          <p className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Line</p>
                                          <p className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Code</p>
                                          <p className="col-span-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                                          <p className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">UOM</p>
                                          <p className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Qty</p>
                                          <p className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Line Total</p>
                                          <p className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Remarks</p>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto">
                                          {detail.items.map((item) => (
                                            <div key={item.id} className="grid grid-cols-12 items-start gap-2 border-b border-border/60 px-2 py-2 text-xs last:border-b-0">
                                              <div className="col-span-1 text-foreground">{item.lineNumber}</div>
                                              <div className="col-span-2 text-muted-foreground">{item.itemCode ?? "-"}</div>
                                              <div className="col-span-3 text-foreground">{item.description}</div>
                                              <div className="col-span-1 text-foreground">{item.uom}</div>
                                              <div className="col-span-1 text-foreground">{item.quantity.toFixed(3)}</div>
                                              <div className="col-span-2 text-foreground">PHP {currency.format(item.lineTotal ?? 0)}</div>
                                              <div className="col-span-2 text-muted-foreground">{item.remarks ?? "-"}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {detail.approvalSteps.length > 0 ? (
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-foreground">Approval Trail</p>
                                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                        {detail.approvalSteps.map((step) => (
                                          <div key={step.id} className="rounded-lg border border-border/60 bg-card px-3 py-2 text-xs">
                                            <div className="mb-1 flex items-center justify-between gap-2">
                                              <p className="font-medium text-foreground">
                                                {(step.stepName?.trim() || `Step ${step.stepNumber}`)} • {step.approverName}
                                              </p>
                                              <Badge variant={statusVariant(step.status)} className="rounded-full border px-2 py-0.5 text-[10px]">
                                                {statusLabel(step.status)}
                                              </Badge>
                                            </div>
                                            <p className="text-muted-foreground">Acted by: {step.actedByName ?? "-"}</p>
                                            <p className="text-muted-foreground">Acted at: {step.actedAtLabel ?? "-"}</p>
                                            {step.remarks ? <p className="mt-1 text-muted-foreground">Remarks: {step.remarks}</p> : null}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </>
                              ) : null}
                                </motion.div>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      )
                    })}

                    <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          Page {activeHistoryPage} of {historyTotalPages} • {historyTotal} records
                        </p>
                        <Select
                          value={historyPageSize}
                          onValueChange={(value) => {
                            const nextPageSize = Number(value)
                            setExpandedHistoryRequestId(null)
                            clearHistorySearchDebounceTimeout()
                            loadHistoryPage({
                              page: 1,
                              pageSize: nextPageSize,
                              search: historySearch,
                              status: historyStatus,
                              departmentId: historyDepartmentId,
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
                            clearHistorySearchDebounceTimeout()
                            loadHistoryPage({
                              page: Math.max(1, activeHistoryPage - 1),
                              pageSize: historyItemsPerPage,
                              search: historySearch,
                              status: historyStatus,
                              departmentId: historyDepartmentId,
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
                            clearHistorySearchDebounceTimeout()
                            loadHistoryPage({
                              page: Math.min(historyTotalPages, activeHistoryPage + 1),
                              pageSize: historyItemsPerPage,
                              search: historySearch,
                              status: historyStatus,
                              departmentId: historyDepartmentId,
                            })
                          }}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[96vw] max-w-[96vw] overflow-hidden rounded-2xl border-border/60 shadow-none sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {decisionType === "approve" ? "Approve Material Request" : "Reject Material Request"}
            </DialogTitle>
            <DialogDescription>
              {(decisionDetail ?? selectedRequest)
                ? `${(decisionDetail ?? selectedRequest)?.requestNumber} • ${(decisionDetail ?? selectedRequest)?.requesterName} • Step ${(decisionDetail ?? selectedRequest)?.currentStep}/${(decisionDetail ?? selectedRequest)?.requiredSteps}`
                : "Confirm your decision."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground">
              <p>Amount: PHP {currency.format(decisionDetail?.grandTotal ?? selectedRequest?.grandTotal ?? 0)}</p>
              <p className="text-xs text-muted-foreground">
                Prepared {(decisionDetail ?? selectedRequest)?.datePreparedLabel ?? "-"} • Required {(decisionDetail ?? selectedRequest)?.dateRequiredLabel ?? "-"}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-foreground">Request Items</Label>
                <span className="text-xs text-muted-foreground">
                  {decisionDetail ? `${decisionDetail.totalItems} items` : "Loading..."}
                </span>
              </div>

              {decisionDetailError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {decisionDetailError}
                </div>
              ) : null}

              {isDetailPending && !decisionDetail ? (
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                  Loading request items...
                </div>
              ) : null}

              {decisionDetail ? (
                <div className="space-y-2">
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-2 lg:hidden">
                    {decisionDetail.items.map((item) => (
                      <div key={item.id} className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground">Line {item.lineNumber}</p>
                          <p className="text-muted-foreground">{item.uom}</p>
                        </div>
                        <p className="text-foreground">{item.description}</p>
                        <p className="text-muted-foreground">Code: {item.itemCode ?? "-"}</p>
                        <p className="text-muted-foreground">Qty: {item.quantity.toFixed(3)}</p>
                        <p className="text-muted-foreground">
                          Unit: PHP {currency.format(item.unitPrice ?? 0)} • Total: PHP {currency.format(item.lineTotal ?? 0)}
                        </p>
                        <p className="text-muted-foreground">Remarks: {item.remarks ?? "-"}</p>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-hidden rounded-lg border border-border/60 lg:block">
                    <div className="overflow-x-auto">
                      <div className="min-w-[720px]">
                        <div className="grid grid-cols-12 items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-2">
                          <p className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">#</p>
                          <p className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Code</p>
                          <p className="col-span-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                          <p className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">UOM</p>
                          <p className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Qty</p>
                          <p className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Line Total</p>
                          <p className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Remarks</p>
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {decisionDetail.items.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 items-start gap-2 border-b border-border/60 px-2 py-2 text-xs last:border-b-0">
                              <div className="col-span-1 text-foreground">{item.lineNumber}</div>
                              <div className="col-span-2 text-muted-foreground">{item.itemCode ?? "-"}</div>
                              <div className="col-span-3 text-foreground">{item.description}</div>
                              <div className="col-span-1 text-foreground">{item.uom}</div>
                              <div className="col-span-1 text-foreground">{item.quantity.toFixed(3)}</div>
                              <div className="col-span-2 text-foreground">PHP {currency.format(item.lineTotal ?? 0)}</div>
                              <div className="col-span-2 text-muted-foreground">{item.remarks ?? "-"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {decisionDetail.totalItems > decisionDetail.pageSize ? (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Page {decisionDetail.page} of {Math.ceil(decisionDetail.totalItems / decisionDetail.pageSize)}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-lg text-xs"
                          disabled={isDetailPending || decisionDetail.page <= 1 || !selectedRequestId}
                          onClick={() => {
                            if (!selectedRequestId) {
                              return
                            }
                            loadDecisionDetail(selectedRequestId, decisionDetail.page - 1)
                          }}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-lg text-xs"
                          disabled={
                            isDetailPending ||
                            decisionDetail.page >= Math.ceil(decisionDetail.totalItems / decisionDetail.pageSize) ||
                            !selectedRequestId
                          }
                          onClick={() => {
                            if (!selectedRequestId) {
                              return
                            }
                            loadDecisionDetail(selectedRequestId, decisionDetail.page + 1)
                          }}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-foreground">Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder={decisionType === "approve" ? "Approval notes (optional)" : "Reason for rejection"}
                className="min-h-[110px] resize-none rounded-lg text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
              <Button type="button" variant="outline" className="rounded-lg" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className={cn("rounded-lg", decisionType === "reject" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                onClick={submitDecision}
                disabled={isPending || isDetailPending || Boolean(decisionDetailError)}
              >
                {isPending ? "Saving..." : decisionType === "approve" ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
