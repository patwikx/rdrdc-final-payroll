"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import {
  IconAlertCircle,
  IconCheck,
  IconClipboardCheck,
  IconFileText,
  IconFilterOff,
  IconPackage,
  IconPrinter,
  IconSearch,
  IconTruckDelivery,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  getMaterialRequestProcessingDetailsAction,
  getMaterialRequestProcessingPageAction,
  updateMaterialRequestProcessingStatusAction,
} from "@/modules/material-requests/actions/material-request-processing-actions"
import { openMaterialRequestPrintWindow } from "@/modules/material-requests/components/material-request-print-button"
import type {
  EmployeePortalMaterialRequestProcessingDetail,
  EmployeePortalMaterialRequestProcessingRow,
  EmployeePortalMaterialRequestProcessingStatusFilter,
} from "@/modules/material-requests/types/employee-portal-material-request-types"

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const QUANTITY_TOLERANCE = 0.0005
const SEARCH_DEBOUNCE_MS = 350
const normalizeServeQuantityInput = (rawValue: string, maxValue: number): string => {
  const trimmed = rawValue.trim()
  if (!trimmed) {
    return ""
  }

  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ""
  }

  const clamped = Math.min(parsed, maxValue)
  return clamped.toFixed(3)
}

type ServeStatusUpdatePayload = {
  companyId: string
  requestId: string
  status: "IN_PROGRESS" | "COMPLETED"
  remarks: string
  processingPoNumber: string
  processingSupplierName: string
  servedItems?: Array<{
    materialRequestItemId: string
    quantityServed: number
  }>
}

type MaterialRequestProcessingClientProps = {
  companyId: string
  companyName: string
  isHR: boolean
  initialRows: EmployeePortalMaterialRequestProcessingRow[]
  initialTotal: number
  initialPage: number
  initialPageSize: number
}

type ProcessingAction =
  | { type: "NONE" }
  | {
      type: "IN_PROGRESS"
      serveMode: "INITIAL" | "ADDITIONAL"
      requestId: string
      requestNumber: string
      processingPoNumber: string | null
      processingSupplierName: string | null
    }
  | {
      type: "COMPLETED"
      requestId: string
      requestNumber: string
      processingPoNumber: string | null
      processingSupplierName: string | null
    }

const toProcessingStatusLabel = (value: string): string => value.replace(/_/g, " ")

const statusVariant = (status: string): "default" | "secondary" | "outline" => {
  if (status === "COMPLETED") {
    return "default"
  }

  if (status === "IN_PROGRESS") {
    return "secondary"
  }

  return "outline"
}

const getProcessingStatusLabel = (row: EmployeePortalMaterialRequestProcessingRow): string => {
  if (row.processingStatus === "IN_PROGRESS" && row.isPartiallyServed) {
    return "PARTIALLY_SERVED"
  }

  return row.processingStatus
}

export function MaterialRequestProcessingClient({
  companyId,
  companyName,
  isHR,
  initialRows,
  initialTotal,
  initialPage,
  initialPageSize,
}: MaterialRequestProcessingClientProps) {
  const loadTokenRef = useRef(0)
  const searchDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [rows, setRows] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(String(initialPageSize))
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<EmployeePortalMaterialRequestProcessingStatusFilter>("OPEN")

  const [action, setAction] = useState<ProcessingAction>({ type: "NONE" })
  const [actionRemarks, setActionRemarks] = useState("")
  const [poNumber, setPoNumber] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [serveQuantities, setServeQuantities] = useState<Record<string, string>>({})
  const [actionDetail, setActionDetail] = useState<EmployeePortalMaterialRequestProcessingDetail | null>(null)
  const [actionDetailError, setActionDetailError] = useState<string | null>(null)
  const [printingRequestId, setPrintingRequestId] = useState<string | null>(null)
  const [partialServePayload, setPartialServePayload] = useState<ServeStatusUpdatePayload | null>(null)
  const [isPartialConfirmOpen, setIsPartialConfirmOpen] = useState(false)

  const [isListPending, startListTransition] = useTransition()
  const [isActionPending, startActionTransition] = useTransition()
  const [isActionDetailPending, startActionDetailTransition] = useTransition()
  const [isPrintPending, startPrintTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / Number(pageSize)))

  const clearSearchDebounceTimeout = () => {
    if (!searchDebounceTimeoutRef.current) {
      return
    }

    clearTimeout(searchDebounceTimeoutRef.current)
    searchDebounceTimeoutRef.current = null
  }

  useEffect(() => {
    return () => {
      if (searchDebounceTimeoutRef.current) {
        clearTimeout(searchDebounceTimeoutRef.current)
      }
    }
  }, [])

  const summary = useMemo(() => {
    return rows.reduce(
      (accumulator, row) => {
        accumulator.totalAmount += row.grandTotal

        if (row.processingStatus === "PENDING_PURCHASER") {
          accumulator.pending += 1
        }

        if (row.processingStatus === "IN_PROGRESS") {
          accumulator.inProgress += 1
        }

        if (row.processingStatus === "COMPLETED") {
          accumulator.completed += 1
        }

        return accumulator
      },
      {
        pending: 0,
        inProgress: 0,
        completed: 0,
        totalAmount: 0,
      }
    )
  }, [rows])

  const loadPage = (params: {
    page: number
    pageSize: number
    search: string
    status: EmployeePortalMaterialRequestProcessingStatusFilter
  }) => {
    const nextToken = loadTokenRef.current + 1
    loadTokenRef.current = nextToken

    startListTransition(async () => {
      const response = await getMaterialRequestProcessingPageAction({
        companyId,
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        status: params.status,
      })

      if (loadTokenRef.current !== nextToken) {
        return
      }

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      setRows(response.data.rows)
      setTotal(response.data.total)
      setPage(response.data.page)
      setPageSize(String(response.data.pageSize))
    })
  }

  const loadActionDetail = (requestId: string, actionType: "IN_PROGRESS" | "COMPLETED") => {
    setActionDetail(null)
    setActionDetailError(null)
    setServeQuantities({})

    startActionDetailTransition(async () => {
      const response = await getMaterialRequestProcessingDetailsAction({
        companyId,
        requestId,
      })

      if (!response.ok) {
        setActionDetailError(response.error)
        return
      }

      setActionDetail(response.data)

      if (actionType === "IN_PROGRESS") {
        const nextServeQuantities = response.data.items.reduce<Record<string, string>>((accumulator, item) => {
          if (item.remainingQuantity > QUANTITY_TOLERANCE) {
            accumulator[item.id] = String(item.remainingQuantity)
          }

          return accumulator
        }, {})

        setServeQuantities(nextServeQuantities)
      }
    })
  }

  const openStatusAction = (params: {
    type: "IN_PROGRESS" | "COMPLETED"
    serveMode?: "INITIAL" | "ADDITIONAL"
    requestId: string
    requestNumber: string
    processingPoNumber: string | null
    processingSupplierName: string | null
  }) => {
    if (params.type === "IN_PROGRESS") {
      setAction({
        type: "IN_PROGRESS",
        serveMode: params.serveMode ?? "INITIAL",
        requestId: params.requestId,
        requestNumber: params.requestNumber,
        processingPoNumber: params.processingPoNumber,
        processingSupplierName: params.processingSupplierName,
      })
    } else {
      setAction({
        type: "COMPLETED",
        requestId: params.requestId,
        requestNumber: params.requestNumber,
        processingPoNumber: params.processingPoNumber,
        processingSupplierName: params.processingSupplierName,
      })
    }
    setActionRemarks("")
    setPoNumber(params.processingPoNumber ?? "")
    setSupplierName(params.processingSupplierName ?? "")
    loadActionDetail(params.requestId, params.type)
  }

  const closeStatusAction = () => {
    if (isActionPending) {
      return
    }

    setAction({ type: "NONE" })
    setActionRemarks("")
    setPoNumber("")
    setSupplierName("")
    setServeQuantities({})
    setActionDetail(null)
    setActionDetailError(null)
    setPartialServePayload(null)
    setIsPartialConfirmOpen(false)
  }

  const executeStatusAction = (payload: ServeStatusUpdatePayload) => {
    startActionTransition(async () => {
      const response = await updateMaterialRequestProcessingStatusAction(payload)

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      closeStatusAction()

      loadPage({
        page,
        pageSize: Number(pageSize),
        search,
        status,
      })
    })
  }

  const submitStatusAction = () => {
    if (action.type === "NONE") {
      return
    }

    const trimmedPoNumber = poNumber.trim()
    const trimmedSupplierName = supplierName.trim()
    const servedItems =
      action.type === "IN_PROGRESS"
        ? Object.entries(serveQuantities)
            .map(([materialRequestItemId, quantityInput]) => ({
              materialRequestItemId,
              quantityServed: Number.parseFloat(quantityInput),
            }))
            .filter((servedItem) => Number.isFinite(servedItem.quantityServed) && servedItem.quantityServed > 0)
        : []

    if (action.type === "IN_PROGRESS" && (!trimmedPoNumber || !trimmedSupplierName)) {
      toast.error("PO # and supplier are required to mark request as served.")
      return
    }

    if (action.type === "IN_PROGRESS" && servedItems.length === 0) {
      toast.error("Enter at least one line item quantity to serve.")
      return
    }

    if (
      action.type === "COMPLETED" &&
      actionDetail?.items.some((item) => item.remainingQuantity > QUANTITY_TOLERANCE)
    ) {
      toast.error("Cannot mark completed while there are remaining quantities to serve.")
      return
    }

    const payload: ServeStatusUpdatePayload = {
      companyId,
      requestId: action.requestId,
      status: action.type,
      remarks: actionRemarks,
      processingPoNumber: trimmedPoNumber,
      processingSupplierName: trimmedSupplierName,
      servedItems: action.type === "IN_PROGRESS" ? servedItems : undefined,
    }

    if (action.type === "IN_PROGRESS" && actionDetail) {
      const enteredByItemId = new Map(
        servedItems.map((servedItem) => [servedItem.materialRequestItemId, servedItem.quantityServed] as const)
      )
      const willRemainAfterServe = actionDetail.items.some((item) => {
        const enteredQuantity = enteredByItemId.get(item.id) ?? 0
        return item.remainingQuantity - enteredQuantity > QUANTITY_TOLERANCE
      })

      if (willRemainAfterServe) {
        setPartialServePayload(payload)
        setIsPartialConfirmOpen(true)
        return
      }
    }

    executeStatusAction(payload)
  }
  const isAdditionalServeAction = action.type === "IN_PROGRESS" && action.serveMode === "ADDITIONAL"

  const printRequest = (row: EmployeePortalMaterialRequestProcessingRow) => {
    setPrintingRequestId(row.id)

    startPrintTransition(async () => {
      try {
        const response = await getMaterialRequestProcessingDetailsAction({
          companyId,
          requestId: row.id,
        })

        if (!response.ok) {
          toast.error(response.error)
          return
        }

        const detail = response.data
        openMaterialRequestPrintWindow({
          companyName,
          requestNumber: detail.requestNumber,
          series: detail.series,
          requestType: detail.requestType,
          statusLabel: "APPROVED",
          requesterName: detail.requesterName,
          requesterEmployeeNumber: detail.requesterEmployeeNumber,
          departmentName: detail.departmentName,
          datePreparedLabel: detail.datePreparedLabel,
          dateRequiredLabel: detail.dateRequiredLabel,
          submittedAtLabel: detail.submittedAtLabel,
          approvedAtLabel: detail.approvedAtLabel,
          processingStartedAtLabel: detail.processingStartedAtLabel,
          processingCompletedAtLabel: detail.processingCompletedAtLabel,
          processedByName: detail.processedByName,
          purpose: detail.purpose,
          remarks: detail.remarks,
          processingRemarks: detail.processingRemarks,
          subTotal: detail.subTotal,
          freight: detail.freight,
          discount: detail.discount,
          grandTotal: detail.grandTotal,
          items: detail.items.map((item) => ({
            lineNumber: item.lineNumber,
            itemCode: item.itemCode,
            description: item.description,
            uom: item.uom,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            remarks: item.remarks,
          })),
          approvalSteps: detail.approvalSteps.map((step) => ({
            stepNumber: step.stepNumber,
            stepName: step.stepName,
            approverName: step.approverName,
            status: step.status,
            actedByName: step.actedByName,
            actedAtLabel: step.actedAtLabel,
            remarks: step.remarks,
          })),
        })
      } finally {
        setPrintingRequestId((current) => (current === row.id ? null : current))
      }
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">Purchasing Workspace</p>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Material Request Processing</h1>
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {isHR ? "HR/Admin + Purchaser" : "Assigned Purchaser"}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Pending", value: String(summary.pending), icon: IconPackage },
            { label: "In Progress", value: String(summary.inProgress), icon: IconTruckDelivery },
            { label: "Completed", value: String(summary.completed), icon: IconCheck },
            { label: "Page Amount", value: `PHP ${currency.format(summary.totalAmount)}`, icon: IconClipboardCheck },
          ].map((item) => (
            <div key={item.label} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-2xl font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-[360px] sm:flex-none">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  const nextSearch = event.target.value
                  setSearch(nextSearch)
                  clearSearchDebounceTimeout()
                  searchDebounceTimeoutRef.current = setTimeout(() => {
                    loadPage({
                      page: 1,
                      pageSize: Number(pageSize),
                      search: nextSearch,
                      status,
                    })
                  }, SEARCH_DEBOUNCE_MS)
                }}
                placeholder="Search request number, requester, department"
                className="rounded-lg pl-8"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return
                  }

                  event.preventDefault()
                  clearSearchDebounceTimeout()
                  loadPage({
                    page: 1,
                    pageSize: Number(pageSize),
                    search,
                    status,
                  })
                }}
              />
            </div>

            <Select
              value={status}
              onValueChange={(value) => {
                const nextStatus = value as EmployeePortalMaterialRequestProcessingStatusFilter
                setStatus(nextStatus)
                clearSearchDebounceTimeout()
                loadPage({
                  page: 1,
                  pageSize: Number(pageSize),
                  search,
                  status: nextStatus,
                })
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open (Pending + In Progress)</SelectItem>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING_PURCHASER">Pending Purchaser</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearSearchDebounceTimeout()
                setSearch("")
                setStatus("OPEN")
                setPageSize("10")
                loadPage({
                  page: 1,
                  pageSize: 10,
                  search: "",
                  status: "OPEN",
                })
              }}
              disabled={isListPending}
            >
              <IconFilterOff className="mr-2 size-4" />
              Reset
            </Button>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
              No approved material requests match the current filters.
            </div>
          ) : (
            <div className="overflow-hidden border border-border/60 bg-card">
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-12 items-center gap-1 border-b border-border/60 bg-muted/30 px-3 py-2">
                  <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request #</p>
                  <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Requester</p>
                  <p className="col-span-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Department</p>
                  <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Required</p>
                  <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Items</p>
                  <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                  <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="col-span-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                </div>

                {rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 items-center gap-1 border-b border-border/60 px-3 py-2 text-xs last:border-b-0 hover:bg-muted/20">
                    <div className="col-span-1 text-foreground truncate" title={row.requestNumber}>{row.requestNumber}</div>
                    <div className="col-span-2">
                      <p className="truncate text-xs text-foreground" title={row.requesterName}>{row.requesterName}</p>
                    </div>
                    <div className="col-span-3 truncate text-foreground" title={row.departmentName}>{row.departmentName}</div>
                    <div className="col-span-1 text-foreground">{row.dateRequiredLabel}</div>
                    <div className="col-span-1 text-foreground">{row.itemCount}</div>
                    <div className="col-span-1 font-medium text-foreground">PHP {currency.format(row.grandTotal)}</div>
                    <div className="col-span-1">
                      <Badge variant={statusVariant(row.processingStatus)} className="w-full justify-center rounded-full border px-2 py-1 text-[10px] shadow-none">
                        {toProcessingStatusLabel(getProcessingStatusLabel(row))}
                      </Badge>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" asChild>
                            <Link href={`/${companyId}/employee-portal/material-request-processing/${row.id}`}>
                              <IconFileText className="h-4 w-4" />
                              <span className="sr-only">View Details</span>
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                          View Details
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => printRequest(row)}
                            disabled={isPrintPending && printingRequestId === row.id}
                          >
                            <IconPrinter className="h-4 w-4" />
                            <span className="sr-only">Print</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                          {isPrintPending && printingRequestId === row.id ? "Preparing print..." : "Print"}
                        </TooltipContent>
                      </Tooltip>
                      {row.canMarkCompleted ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() =>
                                openStatusAction({
                                  type: "COMPLETED",
                                  requestId: row.id,
                                  requestNumber: row.requestNumber,
                                  processingPoNumber: row.processingPoNumber,
                                  processingSupplierName: row.processingSupplierName,
                                })
                              }
                              disabled={isActionPending}
                            >
                              <IconCheck className="h-4 w-4" />
                              <span className="sr-only">Mark Completed</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6}>
                            Mark Completed
                          </TooltipContent>
                        </Tooltip>
                      ) : row.processingStatus === "PENDING_PURCHASER" || row.processingStatus === "IN_PROGRESS" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() =>
                                openStatusAction({
                                  type: "IN_PROGRESS",
                                  serveMode: row.processingStatus === "PENDING_PURCHASER" ? "INITIAL" : "ADDITIONAL",
                                  requestId: row.id,
                                  requestNumber: row.requestNumber,
                                  processingPoNumber: row.processingPoNumber,
                                  processingSupplierName: row.processingSupplierName,
                                })
                              }
                              disabled={isActionPending}
                            >
                              <IconTruckDelivery className="h-4 w-4" />
                              <span className="sr-only">Serve Qty</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6}>
                            Serve Qty
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <p className="text-muted-foreground">
                  Page {page} of {totalPages} • {total} records
                </p>
                <Select
                  value={pageSize}
                  onValueChange={(value) => {
                    setPageSize(value)
                    clearSearchDebounceTimeout()
                    loadPage({
                      page: 1,
                      pageSize: Number(value),
                      search,
                      status,
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-[112px] rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="30">30 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg"
                  disabled={isListPending || page <= 1}
                  onClick={() =>
                    loadPage({
                      page: page - 1,
                      pageSize: Number(pageSize),
                      search,
                      status,
                    })
                  }
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg"
                  disabled={isListPending || page >= totalPages}
                  onClick={() =>
                    loadPage({
                      page: page + 1,
                      pageSize: Number(pageSize),
                      search,
                      status,
                    })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={action.type !== "NONE"} onOpenChange={(open) => (open ? null : closeStatusAction())}>
        <DialogContent className="max-h-[90vh] w-[96vw] max-w-[96vw] overflow-y-auto rounded-2xl border-border/60 shadow-none sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {action.type === "IN_PROGRESS"
                ? isAdditionalServeAction
                  ? "Add Served Quantity"
                  : "Mark Request as Served"
                : "Mark Request as Completed"}
            </DialogTitle>
            <DialogDescription>
              {action.type === "IN_PROGRESS"
                ? isAdditionalServeAction
                  ? "Record additional served quantities for this request."
                  : "Confirm the initial serving quantities for this request."
                : "Confirm that this material request is fully served and ready for posting."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-lg border border-border/60 bg-muted/20">
                <div className="border-b border-border/60 px-3 py-2">
                  <p className="text-sm font-semibold text-foreground">Request Information</p>
                </div>
                <div className="space-y-3 px-3 py-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Document No</p>
                    <p className="text-xl font-semibold text-foreground">{action.type !== "NONE" ? action.requestNumber : "-"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-muted-foreground">Requested By</p>
                      <p className="font-medium text-foreground">{actionDetail?.requesterName ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Department</p>
                      <p className="font-medium text-foreground">{actionDetail?.departmentName ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date Requested</p>
                      <p className="font-medium text-foreground">{actionDetail?.datePreparedLabel ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Items</p>
                      <p className="font-medium text-foreground">{actionDetail ? `${actionDetail.items.length} items` : "-"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Items to Serve</p>
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <div className="grid grid-cols-14 items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <p className="col-span-1">#</p>
                    <p className="col-span-4">Description</p>
                    <p className="col-span-2 text-right">Req.</p>
                    <p className="col-span-2 text-right">Prev.</p>
                    <p className="col-span-2 text-right">Rem.</p>
                    <p className="col-span-3 text-right">Serve</p>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {isActionDetailPending && !actionDetail ? (
                      <div className="px-3 py-6 text-center text-xs text-muted-foreground">Loading request items...</div>
                    ) : actionDetailError ? (
                      <div className="px-3 py-4 text-xs text-destructive">{actionDetailError}</div>
                    ) : actionDetail && actionDetail.items.length > 0 ? (
                      actionDetail.items.map((item) => (
                        <div key={item.id} className="grid grid-cols-14 items-center gap-2 border-b border-border/60 px-2 py-2 text-xs last:border-b-0">
                          <p className="col-span-1 text-muted-foreground">{item.lineNumber}</p>
                          <div className="col-span-4">
                            <p className="text-foreground">{item.description}</p>
                            <p className="text-[11px] text-muted-foreground">{item.uom}</p>
                          </div>
                          <p className="col-span-2 text-right font-medium text-foreground">{item.quantity.toFixed(3)}</p>
                          <p className="col-span-2 text-right font-medium text-muted-foreground">{item.servedQuantity.toFixed(3)}</p>
                          <p className="col-span-2 text-right font-medium text-amber-600 dark:text-amber-400">
                            {item.remainingQuantity.toFixed(3)}
                          </p>
                          <div className="col-span-3">
                            {action.type === "IN_PROGRESS" ? (
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={item.remainingQuantity}
                                step="0.001"
                                value={serveQuantities[item.id] ?? ""}
                                onChange={(event) =>
                                  setServeQuantities((current) => ({
                                    ...current,
                                    [item.id]: event.target.value,
                                  }))
                                }
                                onBlur={(event) => {
                                  const normalizedValue = normalizeServeQuantityInput(
                                    event.target.value,
                                    item.remainingQuantity
                                  )
                                  setServeQuantities((current) => ({
                                    ...current,
                                    [item.id]: normalizedValue,
                                  }))
                                }}
                                disabled={isActionPending || item.remainingQuantity <= QUANTITY_TOLERANCE}
                                className="w-full text-right font-medium tabular-nums"
                              />
                            ) : (
                              <p className="text-right font-medium text-foreground">-</p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-6 text-center text-xs text-muted-foreground">No line items.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>
                  Supplier <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  placeholder="Supplier name"
                  maxLength={160}
                  disabled={isActionPending}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Purchase Order Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={poNumber}
                  onChange={(event) => setPoNumber(event.target.value)}
                  placeholder="Enter PO number from SAP"
                  maxLength={80}
                  disabled={isActionPending}
                />
                <p className="text-xs text-muted-foreground">Enter the purchase order number from SAP system.</p>
              </div>

              <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-3 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <IconAlertCircle className="h-4 w-4" />
                  Important
                </div>
                <p className="text-sm">
                  {action.type === "IN_PROGRESS"
                    ? "You can serve partial quantities now and continue serving the remaining quantities later."
                    : "Only complete this request when all quantities have been fully served."}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={actionRemarks}
                  onChange={(event) => setActionRemarks(event.target.value)}
                  placeholder="Add any notes about serving this request..."
                  rows={6}
                  maxLength={1000}
                  disabled={isActionPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeStatusAction} disabled={isActionPending}>
              Cancel
            </Button>
            <Button type="button" onClick={submitStatusAction} disabled={isActionPending}>
              {isActionPending
                ? "Saving..."
                : action.type === "IN_PROGRESS"
                  ? isAdditionalServeAction
                    ? "Save Served Qty"
                    : "Mark as Served"
                  : "Mark Completed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isPartialConfirmOpen} onOpenChange={setIsPartialConfirmOpen}>
        <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Proceed as Partially Served?</AlertDialogTitle>
            <AlertDialogDescription>
              This serve action does not complete all requested quantities yet. The request will remain in progress and
              you can add another served batch later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionPending}>Review Quantities</AlertDialogCancel>
            <AlertDialogAction
              disabled={isActionPending || !partialServePayload}
              onClick={() => {
                if (!partialServePayload) {
                  return
                }

                executeStatusAction(partialServePayload)
              }}
            >
              Confirm Partial Serve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
