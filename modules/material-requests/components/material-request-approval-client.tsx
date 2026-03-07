"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconCheck,
  IconExternalLink,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  approveMaterialRequestStepAction,
  getMaterialRequestApprovalDecisionDetailsAction,
  getMaterialRequestApprovalHistoryDetailsAction,
  getMaterialRequestApprovalHistoryPageAction,
  getMaterialRequestsForMyApprovalAction,
  rejectMaterialRequestStepAction,
} from "@/modules/material-requests/actions/material-request-approval-actions"
import {
  approvePurchaseRequestAction,
  getPurchaseRequestApprovalDecisionDetailsAction,
  rejectPurchaseRequestAction,
} from "@/modules/procurement/actions/purchase-request-actions"
import type {
  PurchaseRequestApprovalDecisionDetail,
  PurchaseRequestApprovalQueueRow,
} from "@/modules/procurement/types/purchase-request-types"
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
  companyOptions: Array<{
    id: string
    name: string
  }>
  departmentOptions: EmployeePortalMaterialRequestDepartmentOption[]
  rows: EmployeePortalMaterialRequestApprovalQueueRow[]
  initialQueueTotal: number
  initialQueuePage: number
  initialQueuePageSize: number
  historyRows: EmployeePortalMaterialRequestApprovalHistoryRow[]
  initialHistoryTotal: number
  initialHistoryPage: number
  initialHistoryPageSize: number
  purchaseRequestRows?: PurchaseRequestApprovalQueueRow[]
  view?: "queue" | "history" | "both"
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
  purchaseRequestRows = [],
  view = "both",
}: MaterialRequestApprovalClientProps) {
  const router = useRouter()
  const queueRequestTokenRef = useRef(0)
  const queueSearchDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const historyRequestTokenRef = useRef(0)
  const historySearchDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [decisionType, setDecisionType] = useState<"approve" | "reject">("approve")
  const [decisionRequestType, setDecisionRequestType] = useState<"material" | "purchase">("material")
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [selectedRequestCompanyId, setSelectedRequestCompanyId] = useState<string | null>(null)
  const [remarks, setRemarks] = useState("")
  const [queueSearch, setQueueSearch] = useState("")
  const [queueCompanyId, setQueueCompanyId] = useState<string>("ALL")
  const [queueDepartmentId, setQueueDepartmentId] = useState<string>("ALL")
  const [historySearch, setHistorySearch] = useState("")
  const [historyStatus, setHistoryStatus] = useState<HistoryStatusFilter>("ALL")
  const [historyCompanyId, setHistoryCompanyId] = useState<string>("ALL")
  const [historyDepartmentId, setHistoryDepartmentId] = useState<string>("ALL")
  const [isPending, startTransition] = useTransition()
  const [isQueuePending, startQueueTransition] = useTransition()
  const [isDetailPending, startDetailTransition] = useTransition()
  const [isPurchaseDetailPending, startPurchaseDetailTransition] = useTransition()
  const [isHistoryPending, startHistoryTransition] = useTransition()
  const [isHistoryDetailPending, startHistoryDetailTransition] = useTransition()
  const [queuePage, setQueuePage] = useState(initialQueuePage)
  const [queueRowsState, setQueueRowsState] = useState(rows)
  const [queueTotal, setQueueTotal] = useState(initialQueueTotal)
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null)
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
  const [purchaseQueueRowsState, setPurchaseQueueRowsState] = useState(purchaseRequestRows)
  const [purchaseDecisionDetail, setPurchaseDecisionDetail] = useState<PurchaseRequestApprovalDecisionDetail | null>(null)
  const [purchaseDecisionDetailError, setPurchaseDecisionDetailError] = useState<string | null>(null)

  const queueItemsPerPage = initialQueuePageSize
  const historyItemsPerPage = Number(historyPageSize)
  const DECISION_ITEMS_PAGE_SIZE = 8
  const selectedRequest = useMemo(() => queueRowsState.find((row) => row.id === selectedRequestId) ?? null, [queueRowsState, selectedRequestId])
  const selectedPurchaseRequest = useMemo(
    () => purchaseQueueRowsState.find((row) => row.id === selectedRequestId) ?? null,
    [purchaseQueueRowsState, selectedRequestId]
  )
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

  const queueStats = useMemo(() => {
    const summary = queueRowsState.reduce(
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

    for (const purchaseRow of purchaseQueueRowsState) {
      summary.totalAmount += purchaseRow.grandTotal
      summary.requesters.add(purchaseRow.requesterEmployeeNumber)
    }

    return {
      ...summary,
      requests: queueTotal + purchaseQueueRowsState.length,
    }
  }, [queueRowsState, queueTotal, purchaseQueueRowsState])

  const queueFilteredPurchaseRows = useMemo(() => {
    const query = queueSearch.trim().toLowerCase()
    return purchaseQueueRowsState.filter((row) => {
      if (queueCompanyId !== "ALL" && row.companyId !== queueCompanyId) {
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
        row.requesterName,
        row.requesterEmployeeNumber,
        row.departmentName,
        row.companyName,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [purchaseQueueRowsState, queueCompanyId, queueDepartmentId, queueSearch])

  const combinedQueueTotal = queueTotal + queueFilteredPurchaseRows.length

  const queueTotalPages = Math.max(1, Math.ceil(queueTotal / queueItemsPerPage))
  const activeQueuePage = Math.min(queuePage, queueTotalPages)
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyItemsPerPage))
  const activeHistoryPage = Math.min(historyPage, historyTotalPages)
  const showQueueSection = view !== "history"
  const showHistorySection = view !== "queue"
  const getApprovalDetailHref = (requestId: string, requestCompanyId: string): string => {
    const query = new URLSearchParams({ requestCompanyId })
    return `/${companyId}/employee-portal/material-request-approvals/${requestId}?${query.toString()}`
  }

  const clearHistorySearchDebounceTimeout = () => {
    if (!historySearchDebounceTimeoutRef.current) {
      return
    }

    clearTimeout(historySearchDebounceTimeoutRef.current)
    historySearchDebounceTimeoutRef.current = null
  }

  const clearQueueSearchDebounceTimeout = () => {
    if (!queueSearchDebounceTimeoutRef.current) {
      return
    }

    clearTimeout(queueSearchDebounceTimeoutRef.current)
    queueSearchDebounceTimeoutRef.current = null
  }

  useEffect(() => {
    return () => {
      if (queueSearchDebounceTimeoutRef.current) {
        clearTimeout(queueSearchDebounceTimeoutRef.current)
      }
      if (historySearchDebounceTimeoutRef.current) {
        clearTimeout(historySearchDebounceTimeoutRef.current)
      }
    }
  }, [])

  const loadQueuePage = (params: {
    page: number
    search: string
    companyId: string
    departmentId: string
  }) => {
    const token = queueRequestTokenRef.current + 1
    queueRequestTokenRef.current = token
    setQueueLoadError(null)

    startQueueTransition(async () => {
      const response = await getMaterialRequestsForMyApprovalAction({
        companyId,
        page: params.page,
        pageSize: queueItemsPerPage,
        search: params.search,
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
      setQueuePage(response.data.page)
    })
  }

  const loadHistoryPage = (params: {
    page: number
    pageSize: number
    search: string
    status: HistoryStatusFilter
    companyId: string
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
        filterCompanyId: params.companyId === "ALL" ? undefined : params.companyId,
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

  const scheduleQueueSearch = (nextSearch: string) => {
    setQueueSearch(nextSearch)
    clearQueueSearchDebounceTimeout()
    queueSearchDebounceTimeoutRef.current = setTimeout(() => {
      loadQueuePage({
        page: 1,
        search: nextSearch,
        companyId: queueCompanyId,
        departmentId: queueDepartmentId,
      })
    }, 250)
  }

  const loadDecisionDetail = (requestId: string, requestCompanyId: string, page: number) => {
    setDecisionDetailError(null)
    startDetailTransition(async () => {
      const response = await getMaterialRequestApprovalDecisionDetailsAction({
        companyId: requestCompanyId,
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

  const loadPurchaseDecisionDetail = (requestId: string, requestCompanyId: string, page: number) => {
    setPurchaseDecisionDetailError(null)
    startPurchaseDetailTransition(async () => {
      const response = await getPurchaseRequestApprovalDecisionDetailsAction({
        companyId: requestCompanyId,
        requestId,
        page,
        pageSize: DECISION_ITEMS_PAGE_SIZE,
      })

      if (!response.ok) {
        setPurchaseDecisionDetailError(response.error)
        return
      }

      setPurchaseDecisionDetail(response.data)
    })
  }

  const openDecisionDialog = (request: EmployeePortalMaterialRequestApprovalQueueRow, type: "approve" | "reject") => {
    setDecisionRequestType("material")
    setSelectedRequestId(request.id)
    setSelectedRequestCompanyId(request.companyId)
    setDecisionType(type)
    setRemarks("")
    setDecisionDetail(null)
    setDecisionDetailError(null)
    setPurchaseDecisionDetail(null)
    setPurchaseDecisionDetailError(null)
    setOpen(true)
    loadDecisionDetail(request.id, request.companyId, 1)
  }

  const openPurchaseDecisionDialog = (request: PurchaseRequestApprovalQueueRow, type: "approve" | "reject") => {
    setDecisionRequestType("purchase")
    setSelectedRequestId(request.id)
    setSelectedRequestCompanyId(request.companyId)
    setDecisionType(type)
    setRemarks("")
    setDecisionDetail(null)
    setDecisionDetailError(null)
    setPurchaseDecisionDetail(null)
    setPurchaseDecisionDetailError(null)
    setOpen(true)
    loadPurchaseDecisionDetail(request.id, request.companyId, 1)
  }

  const toggleHistoryDetails = (request: EmployeePortalMaterialRequestApprovalHistoryRow) => {
    if (expandedHistoryRequestId === request.id) {
      setExpandedHistoryRequestId(null)
      return
    }

    setExpandedHistoryRequestId(request.id)
    if (historyDetailsById[request.id] || historyDetailLoadingId === request.id) {
      return
    }

    setHistoryDetailLoadingId(request.id)
    startHistoryDetailTransition(async () => {
      const response = await getMaterialRequestApprovalHistoryDetailsAction({
        companyId: request.companyId,
        requestId: request.id,
      })

      setHistoryDetailLoadingId((current) => (current === request.id ? null : current))

      if (!response.ok) {
        setHistoryDetailErrorById((previous) => ({
          ...previous,
          [request.id]: response.error,
        }))
        return
      }

      setHistoryDetailErrorById((previous) => {
        const next = { ...previous }
        delete next[request.id]
        return next
      })
      setHistoryDetailsById((previous) => ({
        ...previous,
        [request.id]: response.data,
      }))
    })
  }

  const submitDecision = () => {
    if (!selectedRequestId || !selectedRequestCompanyId) {
      return
    }

    if (decisionRequestType === "purchase") {
      const purchaseRequest = purchaseQueueRowsState.find((row) => row.id === selectedRequestId)
      if (!purchaseRequest) {
        toast.error("Purchase request not found in approval queue.")
        return
      }

      const decisionRemarks = remarks.trim()
      if (decisionType === "reject" && decisionRemarks.length === 0) {
        toast.error("Rejection remarks are required.")
        return
      }

      setOpen(false)

      startTransition(async () => {
        const response =
          decisionType === "approve"
            ? await approvePurchaseRequestAction({
                companyId: purchaseRequest.companyId,
                requestId: purchaseRequest.id,
                remarks: decisionRemarks.length > 0 ? decisionRemarks : undefined,
              })
            : await rejectPurchaseRequestAction({
                companyId: purchaseRequest.companyId,
                requestId: purchaseRequest.id,
                remarks: decisionRemarks,
              })

        if (!response.ok) {
          setOpen(true)
          toast.error(response.error)
          return
        }

        setPurchaseQueueRowsState((rowsState) => rowsState.filter((row) => row.id !== purchaseRequest.id))
        toast.success(response.message)
        router.refresh()
      })

      return
    }

    const requestId = selectedRequestId
    const requestCompanyId = selectedRequestCompanyId
    const decisionRemarks = remarks
    const previousQueueRows = queueRowsState
    const previousQueueTotal = queueTotal
    const previousQueuePage = queuePage
    const hadSelectedRow = previousQueueRows.some((row) => row.id === requestId)
    const nextQueueTotal = hadSelectedRow ? Math.max(0, previousQueueTotal - 1) : previousQueueTotal
    const nextQueueTotalPages = Math.max(1, Math.ceil(nextQueueTotal / queueItemsPerPage))
    const nextQueuePage = Math.min(previousQueuePage, nextQueueTotalPages)

    setOpen(false)
    setQueueRowsState((currentRows) => currentRows.filter((row) => row.id !== requestId))
    if (hadSelectedRow) {
      setQueueTotal(nextQueueTotal)
    }

    startTransition(async () => {
      const response =
        decisionType === "approve"
          ? await approveMaterialRequestStepAction({
              companyId: requestCompanyId,
              requestId,
              remarks: decisionRemarks,
            })
          : await rejectMaterialRequestStepAction({
              companyId: requestCompanyId,
              requestId,
              remarks: decisionRemarks,
            })

      if (!response.ok) {
        setQueueRowsState(previousQueueRows)
        setQueueTotal(previousQueueTotal)
        setQueuePage(previousQueuePage)
        setOpen(true)
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      loadQueuePage({
        page: nextQueuePage,
        search: queueSearch,
        companyId: queueCompanyId,
        departmentId: queueDepartmentId,
      })
    })
  }

  const hasQueueFilters = queueSearch.trim().length > 0 || queueCompanyId !== "ALL" || queueDepartmentId !== "ALL"
  const hasHistoryFilters =
    historySearch.trim().length > 0 ||
    historyStatus !== "ALL" ||
    historyCompanyId !== "ALL" ||
    historyDepartmentId !== "ALL"
  const isMaterialDecision = decisionRequestType === "material"
  const activeDecisionRequest = isMaterialDecision
    ? (decisionDetail ?? selectedRequest)
    : (purchaseDecisionDetail ?? selectedPurchaseRequest)
  const activeDecisionRequesterPhotoUrl = isMaterialDecision
    ? selectedRequest?.requesterPhotoUrl
    : selectedPurchaseRequest?.requesterPhotoUrl
  const activeDecisionPurpose = isMaterialDecision ? decisionDetail?.purpose : purchaseDecisionDetail?.purpose
  const activeDecisionItems = isMaterialDecision ? (decisionDetail?.items ?? []) : (purchaseDecisionDetail?.items ?? [])
  const activeDecisionTotalItems = isMaterialDecision
    ? (decisionDetail?.totalItems ?? 0)
    : (purchaseDecisionDetail?.totalItems ?? 0)
  const activeDecisionPage = isMaterialDecision ? decisionDetail?.page : purchaseDecisionDetail?.page
  const activeDecisionPageSize = isMaterialDecision ? decisionDetail?.pageSize : purchaseDecisionDetail?.pageSize
  const activeDecisionTotalPages = activeDecisionPageSize
    ? Math.max(1, Math.ceil(activeDecisionTotalItems / activeDecisionPageSize))
    : 1
  const isDecisionItemsLoading = isMaterialDecision
    ? isDetailPending && !decisionDetail
    : isPurchaseDetailPending && !purchaseDecisionDetail
  const activeDecisionDetailError = isMaterialDecision ? decisionDetailError : purchaseDecisionDetailError

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">Approval Workspace</p>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">MRS/PR Approvals</h1>
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

        {showQueueSection ? (
        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Approval Queue</h2>
            <span className="text-xs text-muted-foreground">
              {combinedQueueTotal} records{isQueuePending ? " • Loading..." : ""}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 lg:flex lg:items-center lg:flex-nowrap">
            <div className="relative col-span-3 sm:w-[360px]">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search request #, requester, department..."
                value={queueSearch}
                onChange={(event) => {
                  scheduleQueueSearch(event.target.value)
                }}
                className="rounded-lg pl-8"
              />
            </div>
            <div className="col-span-1 sm:w-[220px]">
              <Select
                value={queueCompanyId}
                onValueChange={(value) => {
                  setQueueCompanyId(value)
                  setQueueDepartmentId("ALL")
                  clearQueueSearchDebounceTimeout()
                  loadQueuePage({
                    page: 1,
                    search: queueSearch,
                    companyId: value,
                    departmentId: "ALL",
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
            <div className="col-span-2 sm:w-[220px]">
              <Select
                value={queueDepartmentId}
                onValueChange={(value) => {
                  setQueueDepartmentId(value)
                  clearQueueSearchDebounceTimeout()
                  loadQueuePage({
                    page: 1,
                    search: queueSearch,
                    companyId: queueCompanyId,
                    departmentId: value,
                  })
                }}
              >
                <SelectTrigger className="w-full rounded-lg">
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
            </div>
            <Button
              variant="outline"
              className="col-span-1 w-full rounded-lg text-xs sm:text-sm"
              onClick={() => {
                setQueueSearch("")
                setQueueCompanyId("ALL")
                setQueueDepartmentId("ALL")
                clearQueueSearchDebounceTimeout()
                loadQueuePage({
                  page: 1,
                  search: "",
                  companyId: "ALL",
                  departmentId: "ALL",
                })
              }}
              disabled={!hasQueueFilters}
            >
              <IconFilterOff className="h-4 w-4" />
              <span className="sm:hidden">Clear</span>
              <span className="hidden sm:inline">Clear Filters</span>
            </Button>
            {view === "queue" ? (
              <Button asChild variant="outline" className="col-span-3 w-full rounded-lg lg:ml-auto lg:w-auto">
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

          {combinedQueueTotal === 0 && !hasQueueFilters ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
              No requests pending your current approval step.
            </div>
          ) : queueRowsState.length === 0 && queueFilteredPurchaseRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
              No requests match the current filters.
            </div>
          ) : (
            <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border/60 lg:bg-card">
              <div className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 lg:grid">
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request #</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Requester</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dept / Company</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prepared / Required</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Step</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Submitted</p>
                <p className="col-span-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
              </div>

              <>
                <div className="space-y-2 lg:hidden">
                  {queueRowsState.map((row) => (
                        <motion.div
                          key={`queue-mobile-${row.id}`}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                          className="rounded-xl border border-border/60 bg-background p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Request</p>
                              <p className="truncate whitespace-nowrap text-sm font-semibold text-foreground">{row.requestNumber}</p>
                            </div>
                            <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                              Step {row.currentStep}/{row.requiredSteps}
                            </Badge>
                          </div>
                          <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Requester</p>
                            <div className="mt-1.5 flex items-center gap-2.5">
                              <Avatar className="h-9 w-9 shrink-0 rounded-md border border-border/60 after:rounded-md">
                                <AvatarImage
                                  src={row.requesterPhotoUrl ?? undefined}
                                  alt={row.requesterName}
                                  className="!rounded-md object-cover"
                                />
                                <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                                  {getNameInitials(row.requesterName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{row.requesterName}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {row.requesterEmployeeNumber} • {row.departmentName} • {row.companyName}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Date Prepared</p>
                              <p className="mt-0.5 text-xs font-medium text-foreground">{row.datePreparedLabel}</p>
                            </div>
                            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Date Required</p>
                              <p className="mt-0.5 text-xs font-medium text-foreground">{row.dateRequiredLabel}</p>
                            </div>
                            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</p>
                              <p className="mt-0.5 text-xs font-medium text-foreground">PHP {currency.format(row.grandTotal)}</p>
                            </div>
                            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Submitted</p>
                              <p className="mt-0.5 text-xs font-medium text-foreground">{row.submittedAtLabel ?? "-"}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="rounded-lg text-xs"
                                  disabled={isPending || isDetailPending}
                                  onClick={() => openDecisionDialog(row, "reject")}
                                >
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
                                <Button
                                  type="button"
                                  size="sm"
                                  className="rounded-lg bg-green-600 text-xs hover:bg-green-700"
                                  disabled={isPending || isDetailPending}
                                  onClick={() => openDecisionDialog(row, "approve")}
                                >
                                  <IconCheck className="mr-1 h-3.5 w-3.5" />
                                  Approve
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                Approve this request
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button asChild type="button" size="sm" className="rounded-lg bg-primary text-xs hover:bg-primary/90">
                                  <Link href={getApprovalDetailHref(row.id, row.companyId)}>
                                    <IconExternalLink className="mr-1 h-3.5 w-3.5" />
                                    View
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                Open request details
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </motion.div>
                      ))}
                  {queueFilteredPurchaseRows.map((row) => (
                    <motion.div
                      key={`purchase-queue-mobile-${row.id}`}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                      className="rounded-xl border border-border/60 bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Purchase Request</p>
                          <p className="truncate whitespace-nowrap text-sm font-semibold text-foreground">{row.requestNumber}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                          Step {row.currentStep}/{row.requiredSteps}
                        </Badge>
                      </div>
                      <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-9 w-9 shrink-0 rounded-md border border-border/60 after:rounded-md">
                            <AvatarImage
                              src={row.requesterPhotoUrl ?? undefined}
                              alt={row.requesterName}
                              className="!rounded-md object-cover"
                            />
                            <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                              {getNameInitials(row.requesterName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{row.requesterName}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {row.requesterEmployeeNumber} • {row.departmentName} • {row.companyName}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Date Prepared</p>
                          <p className="mt-0.5 text-xs font-medium text-foreground">{row.datePreparedLabel}</p>
                        </div>
                        <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Date Required</p>
                          <p className="mt-0.5 text-xs font-medium text-foreground">{row.dateRequiredLabel}</p>
                        </div>
                        <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</p>
                          <p className="mt-0.5 text-xs font-medium text-foreground">PHP {currency.format(row.grandTotal)}</p>
                        </div>
                        <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Submitted</p>
                          <p className="mt-0.5 text-xs font-medium text-foreground">{row.submittedAtLabel ?? "-"}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-lg text-xs"
                          disabled={isPending}
                          onClick={() => openPurchaseDecisionDialog(row, "reject")}
                        >
                          <IconX className="mr-1 h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-lg bg-green-600 text-xs hover:bg-green-700"
                          disabled={isPending}
                          onClick={() => openPurchaseDecisionDialog(row, "approve")}
                        >
                          <IconCheck className="mr-1 h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button asChild type="button" size="sm" className="rounded-lg bg-primary text-xs hover:bg-primary/90">
                          <Link href={`/${row.companyId}/employee-portal/purchase-requests/${row.id}`}>
                            <IconExternalLink className="mr-1 h-3.5 w-3.5" />
                            View
                          </Link>
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="hidden lg:block">
                  {queueRowsState.map((row) => (
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
                          <div className="col-span-1 text-xs text-foreground">
                            <p className="truncate whitespace-nowrap" title={row.departmentName}>
                              {row.departmentName}
                            </p>
                            <p className="truncate whitespace-nowrap text-[10px] text-muted-foreground" title={row.companyName}>
                              {row.companyName}
                            </p>
                          </div>
                          <div className="col-span-2 text-xs text-foreground">
                            <p>{row.datePreparedLabel}</p>
                            <p className="text-muted-foreground">to {row.dateRequiredLabel}</p>
                          </div>
                          <div className="col-span-1 text-sm text-foreground">{row.currentStep}/{row.requiredSteps}</div>
                          <div className="col-span-2 text-sm font-medium text-foreground">PHP {currency.format(row.grandTotal)}</div>
                          <div className="col-span-1 text-xs text-muted-foreground">{row.submittedAtLabel ?? "-"}</div>
                          <div className="col-span-2 flex justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="rounded-lg"
                                  disabled={isPending || isDetailPending}
                                  onClick={() => openDecisionDialog(row, "reject")}
                                >
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
                                <Button
                                  type="button"
                                  size="sm"
                                  className="rounded-lg bg-green-600 hover:bg-green-700"
                                  disabled={isPending || isDetailPending}
                                  onClick={() => openDecisionDialog(row, "approve")}
                                >
                                  <IconCheck className="mr-1 h-3.5 w-3.5" />
                                  Approve
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                Approve this request
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button asChild type="button" size="sm" className="rounded-lg bg-primary hover:bg-primary/90">
                                  <Link href={getApprovalDetailHref(row.id, row.companyId)}>
                                    <IconExternalLink className="h-3.5 w-3.5" />
                                    <span className="sr-only">View Details</span>
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                Open request details
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </motion.div>
                      ))}
                  {queueFilteredPurchaseRows.map((row) => (
                    <motion.div
                      key={`purchase-queue-${row.id}`}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                      className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/20 lg:grid"
                    >
                      <div className="col-span-1 truncate whitespace-nowrap text-xs text-foreground">{row.requestNumber}</div>
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
                      <div className="col-span-1 text-xs text-foreground">
                        <p className="truncate whitespace-nowrap" title={row.departmentName}>
                          {row.departmentName}
                        </p>
                        <p className="truncate whitespace-nowrap text-[10px] text-muted-foreground" title={row.companyName}>
                          {row.companyName}
                        </p>
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
                          disabled={isPending}
                          onClick={() => openPurchaseDecisionDialog(row, "reject")}
                        >
                          <IconX className="mr-1 h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-lg bg-green-600 hover:bg-green-700"
                          disabled={isPending}
                          onClick={() => openPurchaseDecisionDialog(row, "approve")}
                        >
                          <IconCheck className="mr-1 h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button asChild type="button" size="sm" className="rounded-lg bg-primary hover:bg-primary/90">
                          <Link href={`/${row.companyId}/employee-portal/purchase-requests/${row.id}`}>
                            <IconExternalLink className="h-3.5 w-3.5" />
                            <span className="sr-only">View Purchase Request</span>
                          </Link>
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {queueTotalPages > 1 ? (
                  <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      MR Page {activeQueuePage} of {queueTotalPages} • {queueTotal} material request records
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={activeQueuePage <= 1 || isQueuePending}
                        onClick={() =>
                          loadQueuePage({
                            page: activeQueuePage - 1,
                            search: queueSearch,
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
                        disabled={activeQueuePage >= queueTotalPages || isQueuePending}
                        onClick={() =>
                          loadQueuePage({
                            page: activeQueuePage + 1,
                            search: queueSearch,
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
            <span className="text-xs text-muted-foreground">
              {historyTotal} records{isHistoryPending ? " • Loading..." : ""}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-3">
            <div className="relative col-span-3 sm:col-span-3">
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
                      companyId: historyCompanyId,
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
                    companyId: historyCompanyId,
                    departmentId: historyDepartmentId,
                  })
                }}
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Select
                value={historyCompanyId}
                onValueChange={(value) => {
                  setHistoryCompanyId(value)
                  setHistoryDepartmentId("ALL")
                  setExpandedHistoryRequestId(null)
                  clearHistorySearchDebounceTimeout()
                  loadHistoryPage({
                    page: 1,
                    pageSize: historyItemsPerPage,
                    search: historySearch,
                    status: historyStatus,
                    companyId: value,
                    departmentId: "ALL",
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
            <div className="col-span-1 sm:col-span-1">
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
                    companyId: historyCompanyId,
                    departmentId: historyDepartmentId,
                  })
                }}
              >
                <SelectTrigger className="w-full rounded-lg">
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
            </div>
            <div className="col-span-1 sm:col-span-1">
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
                    companyId: historyCompanyId,
                    departmentId: value,
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
              variant="outline"
              className="col-span-1 w-full rounded-lg text-xs sm:text-sm"
              onClick={() => {
                setHistorySearch("")
                setHistoryStatus("ALL")
                setHistoryCompanyId("ALL")
                setHistoryDepartmentId("ALL")
                setExpandedHistoryRequestId(null)
                clearHistorySearchDebounceTimeout()
                loadHistoryPage({
                  page: 1,
                  pageSize: historyItemsPerPage,
                  search: "",
                  status: "ALL",
                  companyId: "ALL",
                  departmentId: "ALL",
                })
              }}
              disabled={!hasHistoryFilters}
            >
              <IconFilterOff className="h-4 w-4" />
              <span className="sm:hidden">Clear</span>
              <span className="hidden sm:inline">Clear Filters</span>
            </Button>
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
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dept / Company</p>
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
                            onClick={() => toggleHistoryDetails(row)}
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
                                <p className="text-[11px] text-muted-foreground">Department / Company</p>
                                <p className="text-foreground">{row.departmentName}</p>
                                <p className="text-[11px] text-muted-foreground">{row.companyName}</p>
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
                            onClick={() => toggleHistoryDetails(row)}
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
                            <div className="col-span-2 text-xs text-foreground">
                              <p className="truncate whitespace-nowrap" title={row.departmentName}>
                                {row.departmentName}
                              </p>
                              <p className="truncate whitespace-nowrap text-[10px] text-muted-foreground" title={row.companyName}>
                                {row.companyName}
                              </p>
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
                              companyId: historyCompanyId,
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
                              companyId: historyCompanyId,
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
                              companyId: historyCompanyId,
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
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setDecisionRequestType("material")
            setSelectedRequestId(null)
            setSelectedRequestCompanyId(null)
            setDecisionDetail(null)
            setDecisionDetailError(null)
            setPurchaseDecisionDetail(null)
            setPurchaseDecisionDetailError(null)
            setRemarks("")
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-border/60 shadow-none sm:max-w-2xl">
          <DialogHeader className="mb-1.5 border-b border-border/60 pb-2">
            <DialogTitle className="text-base font-semibold">
              {decisionType === "approve"
                ? `Approve ${isMaterialDecision ? "Material Request" : "Purchase Request"}`
                : `Reject ${isMaterialDecision ? "Material Request" : "Purchase Request"}`}
            </DialogTitle>
            <DialogDescription className="break-words text-sm text-muted-foreground">
              {activeDecisionRequest
                ? `${activeDecisionRequest.requestNumber} • ${activeDecisionRequest.requesterName} • Step ${activeDecisionRequest.currentStep}/${activeDecisionRequest.requiredSteps}`
                : "Confirm your decision."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="rounded-xl border border-border/60 bg-muted/25 p-2.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <Avatar className="h-9 w-9 shrink-0 rounded-md border border-border/60 after:rounded-md">
                      <AvatarImage
                        src={activeDecisionRequesterPhotoUrl ?? undefined}
                        alt={activeDecisionRequest?.requesterName ?? "Requester"}
                        className="!rounded-md object-cover"
                      />
                      <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                        {getNameInitials(activeDecisionRequest?.requesterName ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{activeDecisionRequest?.requesterName ?? "-"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {activeDecisionRequest?.requesterEmployeeNumber ?? "-"} • {activeDecisionRequest?.departmentName ?? "-"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                    Step {activeDecisionRequest?.currentStep ?? "-"}/{activeDecisionRequest?.requiredSteps ?? "-"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Amount</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">
                    PHP {currency.format(activeDecisionRequest?.grandTotal ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date Prepared</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">{activeDecisionRequest?.datePreparedLabel ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date Required</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">{activeDecisionRequest?.dateRequiredLabel ?? "-"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <Label className="text-xs text-foreground">Purpose</Label>
                <p className="mt-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-foreground">
                  {activeDecisionPurpose?.trim() || "-"}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-foreground">Requested Items</Label>
                <span className="text-xs text-muted-foreground">
                  {activeDecisionRequest ? `${activeDecisionTotalItems} items` : "Loading..."}
                </span>
              </div>

              {activeDecisionDetailError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {activeDecisionDetailError}
                </div>
              ) : null}

              {isDecisionItemsLoading ? (
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                  Loading request items...
                </div>
              ) : null}

              {activeDecisionRequest ? (
                <div className="space-y-2">
                  <div className="max-h-[28vh] overflow-y-auto rounded-lg border border-border/60 sm:max-h-56">
                    <div className="grid grid-cols-[34px_minmax(0,1fr)_52px_64px_96px] items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <p>#</p>
                      <p>Description</p>
                      <p>UoM</p>
                      <p>Qty</p>
                      <p>Price</p>
                    </div>
                    {activeDecisionItems.map((item) => (
                      <div key={item.id} className="border-b border-border/60 px-2 py-2 text-[11px] last:border-b-0">
                        <div className="grid grid-cols-[34px_minmax(0,1fr)_52px_64px_96px] items-center gap-2">
                          <p className="text-foreground">{item.lineNumber}</p>
                          <div className="min-w-0">
                            <p className="truncate text-foreground">{item.description}</p>
                            <p className="truncate text-[10px] text-muted-foreground">Code: {item.itemCode ?? "-"}</p>
                          </div>
                          <p className="truncate text-foreground">{item.uom}</p>
                          <p className="truncate text-foreground">{item.quantity.toFixed(3)}</p>
                          <p className="truncate text-foreground">PHP {currency.format(item.unitPrice ?? 0)}</p>
                        </div>
                        {item.remarks?.trim() ? (
                          <p className="mt-1 truncate pl-[42px] text-[10px] text-muted-foreground">
                            Remarks: {item.remarks}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {activeDecisionTotalItems > (activeDecisionPageSize ?? 0) ? (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Page {activeDecisionPage ?? 1} of {activeDecisionTotalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-lg text-xs"
                          disabled={
                            isDecisionItemsLoading ||
                            (activeDecisionPage ?? 1) <= 1 ||
                            !selectedRequestId ||
                            !selectedRequestCompanyId
                          }
                          onClick={() => {
                            if (!selectedRequestId || !selectedRequestCompanyId || !activeDecisionPage) {
                              return
                            }

                            if (isMaterialDecision) {
                              loadDecisionDetail(selectedRequestId, selectedRequestCompanyId, activeDecisionPage - 1)
                              return
                            }

                            loadPurchaseDecisionDetail(selectedRequestId, selectedRequestCompanyId, activeDecisionPage - 1)
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
                            isDecisionItemsLoading ||
                            (activeDecisionPage ?? 1) >= activeDecisionTotalPages ||
                            !selectedRequestId ||
                            !selectedRequestCompanyId
                          }
                          onClick={() => {
                            if (!selectedRequestId || !selectedRequestCompanyId || !activeDecisionPage) {
                              return
                            }

                            if (isMaterialDecision) {
                              loadDecisionDetail(selectedRequestId, selectedRequestCompanyId, activeDecisionPage + 1)
                              return
                            }

                            loadPurchaseDecisionDetail(selectedRequestId, selectedRequestCompanyId, activeDecisionPage + 1)
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
              <Label className="text-xs text-foreground">
                {decisionType === "approve" ? "Approval Remarks (Optional)" : "Rejection Reason"}
              </Label>
              <Input
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder={decisionType === "approve" ? "Add remarks..." : "Provide rejection reason..."}
                className="rounded-lg"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="rounded-lg sm:min-w-[96px]" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className={cn("rounded-lg sm:min-w-[96px]", decisionType === "reject" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                onClick={submitDecision}
                disabled={isPending || isDecisionItemsLoading || Boolean(activeDecisionDetailError)}
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
