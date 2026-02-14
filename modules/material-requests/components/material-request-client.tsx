"use client"

import { useMemo, useState, useTransition } from "react"
import {
  IconArrowNarrowRight,
  IconChecklist,
  IconEdit,
  IconFilePlus,
  IconFilterOff,
  IconPackage,
  IconPlus,
  IconSearch,
  IconSend,
  IconX,
} from "@tabler/icons-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  cancelMaterialRequestAction,
  submitMaterialRequestAction,
} from "@/modules/material-requests/actions/material-request-actions"
import type { EmployeePortalMaterialRequestRow } from "@/modules/material-requests/types/employee-portal-material-request-types"

type MaterialRequestClientProps = {
  companyId: string
  requests: EmployeePortalMaterialRequestRow[]
  canCreateRequest?: boolean
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "CANCELLED") return "outline"
  if (status === "DRAFT") return "outline"
  return "secondary"
}

const statusLabel = (status: string): string => status.replace(/_/g, " ")

export function MaterialRequestClient({
  companyId,
  requests,
  canCreateRequest = true,
}: MaterialRequestClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState("10")
  const [logSearch, setLogSearch] = useState("")
  const [logStatus, setLogStatus] = useState("ALL")
  const itemsPerPage = Number(pageSize)

  const summary = useMemo(() => {
    return requests.reduce(
      (accumulator, request) => {
        accumulator.total += 1
        accumulator.amount += request.grandTotal

        if (request.status === "DRAFT") accumulator.draft += 1
        if (request.status === "PENDING_APPROVAL") accumulator.pending += 1
        if (request.status === "APPROVED") accumulator.approved += 1
        if (request.status === "REJECTED") accumulator.rejected += 1

        return accumulator
      },
      {
        total: 0,
        draft: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        amount: 0,
      }
    )
  }, [requests])

  const filteredRequests = useMemo(() => {
    const query = logSearch.trim().toLowerCase()

    return requests.filter((request) => {
      if (logStatus !== "ALL" && request.status !== logStatus) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = [
        request.requestNumber,
        request.series,
        request.requestType,
        request.departmentName,
        request.purpose ?? "",
        request.remarks ?? "",
        request.status,
        statusLabel(request.status),
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [logSearch, logStatus, requests])

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const paginatedRows = filteredRequests.slice(startIndex, startIndex + itemsPerPage)

  const submitRequest = (requestId: string) => {
    startTransition(async () => {
      const result = await submitMaterialRequestAction({
        companyId,
        requestId,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  const cancelRequest = (requestId: string) => {
    startTransition(async () => {
      const result = await cancelMaterialRequestAction({
        companyId,
        requestId,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Employee Self-Service</p>
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Material Requests</h1>
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Requisition
            </div>
          </div>
        </div>

        {canCreateRequest ? (
          <Button className="rounded-lg bg-primary hover:bg-primary/90" asChild>
            <Link href={`/${companyId}/employee-portal/material-requests/new`}>
              <IconPlus className="mr-2 h-4 w-4" />
              New Request
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total Requests", value: String(summary.total), icon: IconChecklist },
            { label: "Draft", value: String(summary.draft), icon: IconEdit },
            { label: "Pending", value: String(summary.pending), icon: IconSend },
            { label: "Approved", value: String(summary.approved), icon: IconArrowNarrowRight },
            { label: "Total Amount", value: `PHP ${currency.format(summary.amount)}`, icon: IconPackage },
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

        <div>
          <div className="mb-3 flex items-center gap-2 border-t border-border/60 pt-3">
            <IconFilePlus className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Request Log</h2>
          </div>

          {requests.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-border/60 bg-muted/30 py-14 text-center">
              <p className="text-sm font-semibold text-foreground">No Material Requests Yet</p>
              <p className="text-sm text-muted-foreground">
                {canCreateRequest
                  ? "Create your first requisition draft to get started."
                  : "No requests are linked to your account for this company yet."}
              </p>
              {canCreateRequest ? (
                <div>
                  <Button asChild>
                    <Link href={`/${companyId}/employee-portal/material-requests/new`}>
                      <IconPlus className="mr-2 h-4 w-4" />
                      Create Draft
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="flex flex-col gap-2 border-b border-border/60 bg-muted/20 px-3 py-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={logSearch}
                    onChange={(event) => {
                      setLogSearch(event.target.value)
                      setCurrentPage(1)
                      setExpandedRequestId(null)
                    }}
                    placeholder="Search request #, type, department, notes"
                    className="pl-9"
                  />
                </div>
                <Select
                  value={logStatus}
                  onValueChange={(value) => {
                    setLogStatus(value)
                    setCurrentPage(1)
                    setExpandedRequestId(null)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLogSearch("")
                    setLogStatus("ALL")
                    setCurrentPage(1)
                    setExpandedRequestId(null)
                  }}
                >
                  <IconFilterOff className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No material requests match the current filters.
                </div>
              ) : null}

              <div className="grid grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2">
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request #</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Type</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prepared</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Required</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Items</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="col-span-1 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
              </div>

              {filteredRequests.length > 0 ? (
                <>
                  {paginatedRows.map((request) => {
                      const isExpanded = expandedRequestId === request.id
                      const canEdit = request.status === "DRAFT"
                      const canSubmit = request.status === "DRAFT" && request.items.length > 0
                      const canCancel = request.status === "DRAFT" || request.status === "PENDING_APPROVAL"
                      const requestHref =
                        request.status === "DRAFT"
                          ? `/${companyId}/employee-portal/material-requests/${request.id}/edit`
                          : `/${companyId}/employee-portal/material-requests/${request.id}`

                      return (
                        <div
                          key={request.id}
                          className={cn(
                            "group border-b border-border/60 last:border-b-0 transition-colors",
                            isExpanded && "bg-primary/10"
                          )}
                        >
                          <div
                            className="grid cursor-pointer grid-cols-12 items-center gap-3 px-3 py-4"
                            onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}
                          >
                            <div className="col-span-2 text-xs text-foreground">
                              <Link
                                href={requestHref}
                                onClick={(event) => event.stopPropagation()}
                                className="hover:underline"
                              >
                                {request.requestNumber}
                              </Link>
                            </div>
                            <div className="col-span-1 text-xs text-foreground">{request.series}/{request.requestType}</div>
                            <div className="col-span-2 text-sm text-foreground">{request.datePreparedLabel}</div>
                            <div className="col-span-2 text-sm text-foreground">{request.dateRequiredLabel}</div>
                            <div className="col-span-1 text-sm text-foreground">{request.items.length}</div>
                            <div className="col-span-2 text-sm font-medium text-foreground">PHP {currency.format(request.grandTotal)}</div>
                            <div className="col-span-1">
                              <Badge variant={statusVariant(request.status)} className="w-full justify-center rounded-full border px-2 py-1 text-xs shadow-none">
                                {statusLabel(request.status)}
                              </Badge>
                            </div>
                            <div className="col-span-1 flex justify-end" onClick={(event) => event.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {canEdit ? (
                                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-2 text-xs" asChild>
                                    <Link href={`/${companyId}/employee-portal/material-requests/${request.id}/edit`}>
                                      <IconEdit className="h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                ) : null}

                                {canSubmit ? (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button type="button" size="sm" className="h-8 rounded-lg px-2 text-xs" disabled={isPending}>
                                        <IconSend className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="text-base font-semibold">Submit Request</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Submit this draft for department approval workflow?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-lg">Not yet</AlertDialogCancel>
                                        <AlertDialogAction className="rounded-lg" onClick={() => submitRequest(request.id)}>
                                          Submit
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                ) : null}

                                {canCancel ? (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-2 text-xs" disabled={isPending}>
                                        <IconX className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="text-base font-semibold">Cancel Request</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will mark the request as cancelled.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-lg">Keep request</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={() => cancelRequest(request.id)}
                                        >
                                          Cancel Request
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {isExpanded ? (
                            <div className="space-y-3 border-t border-border/60 bg-muted/30 px-4 py-3">
                              <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-2 lg:grid-cols-4">
                                <div>
                                  <p className="font-medium text-foreground">Department</p>
                                  <p>{request.departmentName}</p>
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">Submitted At</p>
                                  <p>{request.submittedAtLabel ?? "-"}</p>
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">Current Step</p>
                                  <p>{request.currentStep ? `${request.currentStep} / ${request.requiredSteps}` : "-"}</p>
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">Store Use</p>
                                  <p>{request.isStoreUse ? "Yes" : "No"}</p>
                                </div>
                              </div>

                              {(request.purpose || request.remarks || request.finalDecisionRemarks || request.cancellationReason) ? (
                                <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-2">
                                  {request.purpose ? (
                                    <div>
                                      <p className="font-medium text-foreground">Purpose</p>
                                      <p>{request.purpose}</p>
                                    </div>
                                  ) : null}
                                  {request.remarks ? (
                                    <div>
                                      <p className="font-medium text-foreground">Remarks</p>
                                      <p>{request.remarks}</p>
                                    </div>
                                  ) : null}
                                  {request.finalDecisionRemarks ? (
                                    <div>
                                      <p className="font-medium text-foreground">Decision Remarks</p>
                                      <p>{request.finalDecisionRemarks}</p>
                                    </div>
                                  ) : null}
                                  {request.cancellationReason ? (
                                    <div>
                                      <p className="font-medium text-foreground">Cancellation Reason</p>
                                      <p>{request.cancellationReason}</p>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                              <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
                                <div className="grid grid-cols-12 items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-2">
                                  <p className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Line</p>
                                  <p className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Code</p>
                                  <p className="col-span-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                                  <p className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">UOM</p>
                                  <p className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Qty</p>
                                  <p className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Unit / Total</p>
                                  <p className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Remarks</p>
                                </div>
                                {request.items.map((item) => (
                                  <div key={item.id} className="grid grid-cols-12 items-start gap-2 border-b border-border/60 px-2 py-2 text-xs last:border-b-0">
                                    <div className="col-span-1 text-foreground">{item.lineNumber}</div>
                                    <div className="col-span-2 text-muted-foreground">{item.itemCode ?? "-"}</div>
                                    <div className="col-span-3 text-foreground">{item.description}</div>
                                    <div className="col-span-1 text-foreground">{item.uom}</div>
                                    <div className="col-span-1 text-foreground">{item.quantity.toFixed(3)}</div>
                                    <div className="col-span-2 text-foreground">
                                      <div>PHP {currency.format(item.unitPrice ?? 0)}</div>
                                      <div className="text-muted-foreground">PHP {currency.format(item.lineTotal ?? 0)}</div>
                                    </div>
                                    <div className="col-span-2 text-muted-foreground">{item.remarks ?? "-"}</div>
                                  </div>
                                ))}
                              </div>

                              {request.approvalSteps.length > 0 ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-foreground">Approval Trail</p>
                                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {request.approvalSteps.map((step) => (
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
                            </div>
                          ) : null}
                        </div>
                      )
                    })}

                  <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        Page {safeCurrentPage} of {totalPages} • {filteredRequests.length} records
                      </p>
                      <Select
                        value={pageSize}
                        onValueChange={(value) => {
                          setPageSize(value)
                          setCurrentPage(1)
                          setExpandedRequestId(null)
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
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={safeCurrentPage <= 1}
                        onClick={() => {
                          setCurrentPage(safeCurrentPage - 1)
                          setExpandedRequestId(null)
                        }}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={safeCurrentPage >= totalPages}
                        onClick={() => {
                          setCurrentPage(safeCurrentPage + 1)
                          setExpandedRequestId(null)
                        }}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
