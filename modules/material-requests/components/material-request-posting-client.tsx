"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import {
  IconChecklist,
  IconFileCheck,
  IconFilterOff,
  IconPackageExport,
  IconSearch,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  getMaterialRequestPostingDetailsAction,
  getMaterialRequestPostingPageAction,
  postMaterialRequestAction,
} from "@/modules/material-requests/actions/material-request-posting-actions"
import type {
  EmployeePortalMaterialRequestPostingDetail,
  EmployeePortalMaterialRequestPostingRow,
  EmployeePortalMaterialRequestPostingStatusFilter,
} from "@/modules/material-requests/types/employee-portal-material-request-types"

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type MaterialRequestPostingClientProps = {
  companyId: string
  initialRows: EmployeePortalMaterialRequestPostingRow[]
  initialTotal: number
  initialPage: number
  initialPageSize: number
}

type PostingAction =
  | { type: "NONE" }
  | {
      type: "DETAIL"
      requestId: string
      requestNumber: string
      postingStatus: "PENDING_POSTING" | "POSTED"
      currentPostingReference: string | null
    }

const toPostingStatusLabel = (status: "PENDING_POSTING" | "POSTED"): string =>
  status.replace(/_/g, " ")

const postingStatusVariant = (
  status: "PENDING_POSTING" | "POSTED"
): "default" | "secondary" | "outline" => {
  if (status === "POSTED") {
    return "default"
  }

  return "secondary"
}

export function MaterialRequestPostingClient({
  companyId,
  initialRows,
  initialTotal,
  initialPage,
  initialPageSize,
}: MaterialRequestPostingClientProps) {
  const loadTokenRef = useRef(0)

  const [rows, setRows] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(String(initialPageSize))
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<EmployeePortalMaterialRequestPostingStatusFilter>("ALL")

  const [action, setAction] = useState<PostingAction>({ type: "NONE" })
  const [detail, setDetail] = useState<EmployeePortalMaterialRequestPostingDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [postingReference, setPostingReference] = useState("")
  const [postingRemarks, setPostingRemarks] = useState("")

  const [isListPending, startListTransition] = useTransition()
  const [isDetailPending, startDetailTransition] = useTransition()
  const [isActionPending, startActionTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / Number(pageSize)))

  const summary = useMemo(() => {
    return rows.reduce(
      (accumulator, row) => {
        accumulator.totalAmount += row.grandTotal

        if (row.postingStatus === "PENDING_POSTING") {
          accumulator.pending += 1
        } else {
          accumulator.posted += 1
        }

        return accumulator
      },
      {
        pending: 0,
        posted: 0,
        totalAmount: 0,
      }
    )
  }, [rows])

  const loadPage = (params: {
    page: number
    pageSize: number
    search: string
    status: EmployeePortalMaterialRequestPostingStatusFilter
  }) => {
    const nextToken = loadTokenRef.current + 1
    loadTokenRef.current = nextToken

    startListTransition(async () => {
      const response = await getMaterialRequestPostingPageAction({
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

  const openDetail = (row: EmployeePortalMaterialRequestPostingRow) => {
    setAction({
      type: "DETAIL",
      requestId: row.id,
      requestNumber: row.requestNumber,
      postingStatus: row.postingStatus,
      currentPostingReference: row.postingReference,
    })
    setDetail(null)
    setDetailError(null)
    setPostingReference(row.postingReference ?? "")
    setPostingRemarks("")

    startDetailTransition(async () => {
      const response = await getMaterialRequestPostingDetailsAction({
        companyId,
        requestId: row.id,
      })

      if (!response.ok) {
        setDetailError(response.error)
        return
      }

      setDetail(response.data)
      setPostingRemarks(response.data.postingRemarks ?? "")
    })
  }

  const closeDetail = () => {
    if (isActionPending) {
      return
    }

    setAction({ type: "NONE" })
    setDetail(null)
    setDetailError(null)
    setPostingReference("")
    setPostingRemarks("")
  }

  const submitPost = () => {
    if (action.type !== "DETAIL") {
      return
    }

    startActionTransition(async () => {
      const response = await postMaterialRequestAction({
        companyId,
        requestId: action.requestId,
        postingReference,
        remarks: postingRemarks,
      })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      closeDetail()
      loadPage({
        page,
        pageSize: Number(pageSize),
        search,
        status,
      })
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">Accounting Workspace</p>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Material Request Posting</h1>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Pending Posting</p>
              <IconChecklist className="h-4 w-4 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground">{summary.pending}</span>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Posted</p>
              <IconFileCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground">{summary.posted}</span>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Page Amount</p>
              <IconPackageExport className="h-4 w-4 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground">PHP {currency.format(summary.totalAmount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-[360px] sm:flex-none">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search request number, requester, department, posting ref"
                className="rounded-lg pl-8"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return
                  }

                  event.preventDefault()
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
                const nextStatus = value as EmployeePortalMaterialRequestPostingStatusFilter
                setStatus(nextStatus)
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
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING_POSTING">Pending Posting</SelectItem>
                <SelectItem value="POSTED">Posted</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("")
                setStatus("ALL")
                setPageSize("10")
                loadPage({
                  page: 1,
                  pageSize: 10,
                  search: "",
                  status: "ALL",
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
              No completed material requests match the current filters.
            </div>
          ) : (
            <div className="overflow-hidden border border-border/60 bg-card">
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2">
                  <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request #</p>
                  <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Requester</p>
                  <p className="col-span-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Department</p>
                  <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Completed</p>
                  <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                  <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="col-span-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                </div>

                {rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 items-center gap-3 border-b border-border/60 px-3 py-2 text-xs last:border-b-0 hover:bg-muted/20">
                    <div className="col-span-1 text-foreground">{row.requestNumber}</div>
                    <div className="col-span-2">
                      <p className="text-xs text-foreground">{row.requesterName}</p>
                    </div>
                    <div className="col-span-3 text-foreground">{row.departmentName}</div>
                    <div className="col-span-2 text-foreground">{row.processingCompletedAtLabel ?? "-"}</div>
                    <div className="col-span-1 font-medium text-foreground">PHP {currency.format(row.grandTotal)}</div>
                    <div className="col-span-1">
                      <Badge variant={postingStatusVariant(row.postingStatus)} className="w-full justify-center rounded-full border px-2 py-1 text-[10px] shadow-none">
                        {toPostingStatusLabel(row.postingStatus)}
                      </Badge>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {row.postingStatus === "PENDING_POSTING" ? (
                        <Button type="button" size="sm" onClick={() => openDetail(row)}>
                          Post
                        </Button>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => openDetail(row)}>
                          View Details
                        </Button>
                      )}
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

      <Dialog open={action.type === "DETAIL"} onOpenChange={(open) => (open ? null : closeDetail())}>
        <DialogContent className="max-h-[90vh] w-[96vw] max-w-[96vw] overflow-y-auto rounded-2xl border-border/60 shadow-none sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Post Material Request</DialogTitle>
            <DialogDescription>Review the request and post it to accounting acknowledgement.</DialogDescription>
          </DialogHeader>

          {isDetailPending && !detail ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading request details...</div>
          ) : detailError ? (
            <div className="py-3 text-sm text-destructive">{detailError}</div>
          ) : detail ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-muted/20">
                  <div className="border-b border-border/60 px-3 py-2">
                    <p className="text-sm font-semibold text-foreground">Request Information</p>
                  </div>
                  <div className="space-y-2 px-3 py-3 text-xs">
                    <p><span className="text-muted-foreground">Document No:</span> {detail.requestNumber}</p>
                    <p><span className="text-muted-foreground">Requester:</span> {detail.requesterName}</p>
                    <p><span className="text-muted-foreground">Department:</span> {detail.departmentName}</p>
                    <p><span className="text-muted-foreground">Prepared / Required:</span> {detail.datePreparedLabel} to {detail.dateRequiredLabel}</p>
                    <p><span className="text-muted-foreground">Completed At:</span> {detail.processingCompletedAtLabel ?? "-"}</p>
                    <p><span className="text-muted-foreground">Grand Total:</span> PHP {currency.format(detail.grandTotal)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Served Items</p>
                  <div className="overflow-hidden rounded-lg border border-border/60">
                    <div className="grid grid-cols-12 items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <p className="col-span-1">#</p>
                      <p className="col-span-5">Description</p>
                      <p className="col-span-2 text-right">Req.</p>
                      <p className="col-span-2 text-right">Served</p>
                      <p className="col-span-2 text-right">Rem.</p>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {detail.items.map((item) => (
                        <div key={item.id} className="grid grid-cols-12 items-center gap-2 border-b border-border/60 px-2 py-2 text-xs last:border-b-0">
                          <p className="col-span-1 text-muted-foreground">{item.lineNumber}</p>
                          <div className="col-span-5">
                            <p className="text-foreground">{item.description}</p>
                            <p className="text-[11px] text-muted-foreground">{item.uom}</p>
                          </div>
                          <p className="col-span-2 text-right font-medium text-foreground">{item.quantity.toFixed(3)}</p>
                          <p className="col-span-2 text-right font-medium text-muted-foreground">{item.servedQuantity.toFixed(3)}</p>
                          <p className="col-span-2 text-right font-medium text-amber-600 dark:text-amber-400">
                            {item.remainingQuantity.toFixed(3)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Posting Reference (Optional)</Label>
                  <Input
                    value={postingReference}
                    onChange={(event) => setPostingReference(event.target.value)}
                    placeholder="Journal / voucher / ERP posting reference"
                    maxLength={120}
                    disabled={isActionPending || detail.postingStatus === "POSTED"}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Posting Remarks (Optional)</Label>
                  <Textarea
                    value={postingRemarks}
                    onChange={(event) => setPostingRemarks(event.target.value)}
                    placeholder="Add posting remarks"
                    rows={6}
                    maxLength={1000}
                    disabled={isActionPending || detail.postingStatus === "POSTED"}
                  />
                </div>

                {detail.postingStatus === "POSTED" ? (
                  <div className="rounded-lg border border-emerald-300/70 bg-emerald-50 px-3 py-3 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <p className="text-sm font-semibold">Already Posted</p>
                    <p className="mt-1 text-xs">Posted At: {detail.postedAtLabel ?? "-"}</p>
                    <p className="text-xs">Posted By: {detail.postedByName ?? "-"}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-3 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="text-sm font-semibold">Posting Confirmation</p>
                    <p className="mt-1 text-sm">
                      Posting this request acknowledges it in accounting and marks it as posted.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDetail} disabled={isActionPending}>
              Close
            </Button>
            {detail?.postingStatus !== "POSTED" ? (
              <Button type="button" onClick={submitPost} disabled={isActionPending}>
                {isActionPending ? "Posting..." : "Post Request"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
