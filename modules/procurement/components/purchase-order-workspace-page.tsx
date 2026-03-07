"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconCircleCheck,
  IconDots,
  IconEye,
  IconFileInvoice,
  IconFilterOff,
  IconFolders,
  IconReceipt2,
  IconSearch,
  IconTruckDelivery,
  IconUser,
  IconX,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  cancelPurchaseOrderAction,
  closePurchaseOrderAction,
  openPurchaseOrderAction,
} from "@/modules/procurement/actions/purchase-order-actions"
import type {
  PurchaseOrderSourceRequestOption,
  PurchaseOrderWorkspaceRow,
} from "@/modules/procurement/types/purchase-order-types"

type PurchaseOrderWorkspacePageProps = {
  companyId: string
  rows: PurchaseOrderWorkspaceRow[]
  availableSourceRequests: PurchaseOrderSourceRequestOption[]
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toStatusLabel = (status: string): string => status.replaceAll("_", " ")

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "CANCELLED") return "outline"
  if (status === "CLOSED") return "default"
  if (status === "FULLY_RECEIVED") return "default"
  if (status === "PARTIALLY_RECEIVED") return "secondary"
  if (status === "OPEN") return "secondary"
  return "outline"
}

const DESKTOP_PO_GRID_COLUMNS =
  "grid min-w-[1020px] grid-cols-[6.75rem_minmax(0,1.2fr)_minmax(0,1.05fr)_6.25rem_3.75rem_8rem_8.25rem_2.75rem] items-center gap-1.5"

export function PurchaseOrderWorkspacePage({
  companyId,
  rows,
  availableSourceRequests,
}: PurchaseOrderWorkspacePageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")
  const [supplier, setSupplier] = useState("ALL")
  const [sourceRequest, setSourceRequest] = useState("ALL")
  const [receivingFilter, setReceivingFilter] = useState("ALL")
  const [approvedSearch, setApprovedSearch] = useState("")
  const [approvedDepartment, setApprovedDepartment] = useState("ALL")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState("10")
  const [closeTarget, setCloseTarget] = useState<PurchaseOrderWorkspaceRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrderWorkspaceRow | null>(null)
  const pageSizeValue = Number(pageSize)

  const supplierOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.supplierName.trim()).filter((name) => name.length > 0))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [rows]
  )
  const sourceRequestOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.sourceRequestNumber.trim()).filter((value) => value.length > 0))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [rows]
  )
  const approvedDepartmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          availableSourceRequests
            .map((request) => request.departmentName.trim())
            .filter((departmentName) => departmentName.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [availableSourceRequests]
  )
  const approvedRequestRows = useMemo(() => {
    const query = approvedSearch.trim().toLowerCase()
    return availableSourceRequests.filter((request) => {
      if (approvedDepartment !== "ALL" && request.departmentName !== approvedDepartment) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = [
        request.requestNumber,
        request.requesterName,
        request.departmentName,
        request.requesterBranchName ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [approvedDepartment, approvedSearch, availableSourceRequests])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()

    return rows.filter((row) => {
      if (status !== "ALL" && row.status !== status) {
        return false
      }

      if (supplier !== "ALL" && row.supplierName !== supplier) {
        return false
      }

      if (sourceRequest !== "ALL" && row.sourceRequestNumber !== sourceRequest) {
        return false
      }

      if (receivingFilter === "RECEIVABLE" && !row.hasReceivableLines) {
        return false
      }

      if (receivingFilter === "NOT_RECEIVABLE" && row.hasReceivableLines) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = [
        row.poNumber,
        row.supplierName,
        row.sourceRequestNumber,
        row.createdByName,
        row.status,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [receivingFilter, rows, search, sourceRequest, status, supplier])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSizeValue))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSizeValue
    return filteredRows.slice(start, start + pageSizeValue)
  }, [filteredRows, page, pageSizeValue])

  const summary = useMemo(() => {
    return paginatedRows.reduce(
      (accumulator, row) => {
        accumulator.totalAmount += row.totalAmount

        if (row.status === "OPEN") {
          accumulator.open += 1
        }

        if (row.status === "PARTIALLY_RECEIVED") {
          accumulator.partiallyReceived += 1
        }

        if (row.status === "FULLY_RECEIVED") {
          accumulator.fullyReceived += 1
        }

        return accumulator
      },
      {
        open: 0,
        partiallyReceived: 0,
        fullyReceived: 0,
        totalAmount: 0,
      }
    )
  }, [paginatedRows])

  const runAction = (action: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error ?? "Action failed.")
        return
      }

      toast.success(result.message ?? "Updated.")
      router.refresh()
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Purchasing Workspace</p>
            <div className="mt-2 flex items-center gap-4">
              <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground sm:text-2xl">
                <IconFileInvoice className="h-5 w-5 text-primary" />
                Purchase Orders
              </h1>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                PR {"->"} PO
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
            {availableSourceRequests.length} approved purchase request(s) with available items are ready for PO creation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="rounded-lg">
              <Link href={`/${companyId}/employee-portal/goods-receipt-pos`}>
                <IconReceipt2 className="mr-1 h-4 w-4" />
                Goods Receipt PO
              </Link>
            </Button>
            <Button asChild className="rounded-lg">
              <Link href={`/${companyId}/employee-portal/purchase-orders/create`}>Create Purchase Order</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Open", value: String(summary.open), icon: IconTruckDelivery },
            { label: "Partially Received", value: String(summary.partiallyReceived), icon: IconReceipt2 },
            { label: "Fully Received", value: String(summary.fullyReceived), icon: IconFileInvoice },
            { label: "Page Amount", value: `PHP ${currency.format(summary.totalAmount)}`, icon: IconFileInvoice },
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="flex flex-col border border-border/60 bg-card p-3 xl:max-h-[calc(100vh-320px)]">
            <div className="border-b border-border/60 pb-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <IconFolders className="h-4 w-4 text-primary" />
                Approved PR Queue
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {approvedRequestRows.length} request(s) ready for PO processing
              </p>
            </div>

            <div className="mt-3 space-y-2">
              <div className="relative min-w-0">
                <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={approvedSearch}
                  onChange={(event) => setApprovedSearch(event.target.value)}
                  placeholder="Search PR #, requester, department"
                  className="rounded-lg pl-8"
                />
              </div>
              <Select value={approvedDepartment} onValueChange={setApprovedDepartment}>
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All departments</SelectItem>
                  {approvedDepartmentOptions.map((departmentName) => (
                    <SelectItem key={departmentName} value={departmentName}>
                      {departmentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {approvedRequestRows.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                No approved source requests match the filters.
              </div>
            ) : (
              <ScrollArea className="mt-3 min-h-0 flex-1 pr-1">
                <div className="space-y-2">
                {approvedRequestRows.map((request) => (
                  <div key={request.id} className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{request.requestNumber}</p>
                        <p className="text-[11px] text-muted-foreground">{request.departmentName}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full border px-2 py-0.5 text-[10px]">
                        {request.lineCount} lines
                      </Badge>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <IconUser className="h-3.5 w-3.5" />
                      {request.requesterName}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Need by {request.requiredDateLabel}</span>
                      <span>PHP {currency.format(request.totalAmount)}</span>
                    </div>
                    <Button asChild size="sm" className="mt-2 h-8 w-full rounded-lg">
                      <Link href={`/${companyId}/employee-portal/purchase-orders/create?sourceRequestId=${request.id}`}>
                        Create PO from PR
                      </Link>
                    </Button>
                  </div>
                ))}
                </div>
              </ScrollArea>
            )}
          </aside>

          <div className="space-y-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <div className="relative min-w-[280px] flex-1">
                <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search PO #, supplier, request #"
                  className="rounded-lg pl-8"
                />
              </div>

              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[170px] shrink-0 rounded-lg">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                  <SelectItem value="FULLY_RECEIVED">Fully Received</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={supplier}
                onValueChange={(value) => {
                  setSupplier(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[180px] shrink-0 rounded-lg">
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All suppliers</SelectItem>
                  {supplierOptions.map((supplierName) => (
                    <SelectItem key={supplierName} value={supplierName}>
                      {supplierName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Select
                  value={sourceRequest}
                  onValueChange={(value) => {
                    setSourceRequest(value)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[165px] shrink-0 rounded-lg">
                    <SelectValue placeholder="Source PR" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All source PRs</SelectItem>
                    {sourceRequestOptions.map((requestNumber) => (
                      <SelectItem key={requestNumber} value={requestNumber}>
                        {requestNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={receivingFilter}
                  onValueChange={(value) => {
                    setReceivingFilter(value)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[155px] shrink-0 rounded-lg">
                    <SelectValue placeholder="Receiving" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All receiving</SelectItem>
                    <SelectItem value="RECEIVABLE">Has receivable</SelectItem>
                    <SelectItem value="NOT_RECEIVABLE">No receivable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setStatus("ALL")
                  setSupplier("ALL")
                  setSourceRequest("ALL")
                  setReceivingFilter("ALL")
                  setApprovedSearch("")
                  setApprovedDepartment("ALL")
                  setPage(1)
                  setPageSize("10")
                }}
                disabled={isPending}
                className="shrink-0"
              >
                <IconFilterOff className="mr-2 size-4" />
                Reset Filters
              </Button>
            </div>

            {filteredRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
                No purchase orders match the current filters.
              </div>
            ) : (
              <div className="overflow-hidden border border-border/60 bg-card">
              <div className="space-y-2 p-3 lg:hidden">
                {paginatedRows.map((row) => (
                  <div key={`po-mobile-${row.id}`} className="rounded-xl border border-border/60 bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">PO #</p>
                        <p className="truncate text-sm font-medium text-foreground">{row.poNumber}</p>
                      </div>
                      <Badge variant={statusVariant(row.status)} className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]">
                        {toStatusLabel(row.status)}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Supplier</p>
                        <p className="truncate text-foreground">{row.supplierName}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Source Request</p>
                        <p className="text-foreground">{row.sourceRequestNumber}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">PO Date</p>
                        <p className="text-foreground">{row.purchaseOrderDateLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Items</p>
                        <Badge variant="outline" className="mt-1 rounded-full border px-2 py-0 text-[10px]">
                          {row.lineCount}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] text-muted-foreground">Amount</p>
                        <p className="font-medium text-foreground">PHP {currency.format(row.totalAmount)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="rounded-lg" asChild>
                        <Link href={`/${companyId}/employee-portal/purchase-orders/${row.id}`}>View</Link>
                      </Button>
                      {row.status === "DRAFT" ? (
                        <Button
                          type="button"
                          className="rounded-lg"
                          onClick={() => runAction(() => openPurchaseOrderAction({ companyId, purchaseOrderId: row.id }))}
                          disabled={isPending}
                        >
                          Open
                        </Button>
                      ) : null}
                      {(row.status === "OPEN" || row.status === "PARTIALLY_RECEIVED") && row.hasReceivableLines ? (
                        <Button type="button" variant="outline" className="rounded-lg" asChild>
                          <Link href={`/${companyId}/employee-portal/goods-receipt-pos/create?purchaseOrderId=${row.id}`}>Receive</Link>
                        </Button>
                      ) : null}
                      {row.status === "FULLY_RECEIVED" ? (
                        <Button
                          type="button"
                          className="rounded-lg"
                          onClick={() => {
                            setCancelTarget(null)
                            setCloseTarget(row)
                          }}
                          disabled={isPending}
                        >
                          Close
                        </Button>
                      ) : null}
                      {row.status === "DRAFT" || row.status === "OPEN" ? (
                        <Button
                          type="button"
                          variant="destructive"
                          className="rounded-lg"
                          onClick={() => {
                            setCloseTarget(null)
                            setCancelTarget(row)
                          }}
                          disabled={isPending}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block">
                <div className="overflow-x-auto">
                  <div>
                    <div className={`${DESKTOP_PO_GRID_COLUMNS} border-b border-border/60 bg-muted/30 px-3 py-2`}>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">PO #</p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Supplier</p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Source Request</p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">PO Date</p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Items</p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                      <p className="text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                    </div>

                    {paginatedRows.map((row) => (
                      <div
                        key={row.id}
                        className={`${DESKTOP_PO_GRID_COLUMNS} border-b border-border/60 px-3 py-2 text-xs last:border-b-0 hover:bg-muted/20`}
                      >
                        <div className="truncate font-medium text-foreground" title={row.poNumber}>{row.poNumber}</div>
                        <div className="truncate text-foreground" title={row.supplierName}>{row.supplierName}</div>
                        <div className="truncate text-foreground" title={row.sourceRequestNumber}>{row.sourceRequestNumber}</div>
                        <div className="text-foreground">{row.purchaseOrderDateLabel}</div>
                        <div>
                          <Badge variant="outline" className="rounded-full border px-2 py-0 text-[10px]">
                            {row.lineCount}
                          </Badge>
                        </div>
                        <div className="font-medium text-foreground">PHP {currency.format(row.totalAmount)}</div>
                        <div>
                          <Badge variant={statusVariant(row.status)} className="w-full justify-center rounded-full border px-2 py-1 text-[10px] shadow-none">
                            {toStatusLabel(row.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" disabled={isPending}>
                                <IconDots className="size-4 rotate-90" />
                                <span className="sr-only">Open actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem asChild>
                                <Link href={`/${companyId}/employee-portal/purchase-orders/${row.id}`}>
                                  <IconEye className="size-4" />
                                  View
                                </Link>
                              </DropdownMenuItem>
                              {row.status === "DRAFT" ? (
                                <DropdownMenuItem
                                  disabled={isPending}
                                  onSelect={() =>
                                    runAction(() => openPurchaseOrderAction({ companyId, purchaseOrderId: row.id }))
                                  }
                                >
                                  <IconCircleCheck className="size-4" />
                                  Open
                                </DropdownMenuItem>
                              ) : null}
                              {(row.status === "OPEN" || row.status === "PARTIALLY_RECEIVED") && row.hasReceivableLines ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/${companyId}/employee-portal/goods-receipt-pos/create?purchaseOrderId=${row.id}`}>
                                    <IconReceipt2 className="size-4" />
                                    Receive
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              {row.status === "FULLY_RECEIVED" ? (
                                <DropdownMenuItem
                                  disabled={isPending}
                                  onSelect={(event) => {
                                    event.preventDefault()
                                    setCancelTarget(null)
                                    setCloseTarget(row)
                                  }}
                                >
                                  <IconCircleCheck className="size-4" />
                                  Close
                                </DropdownMenuItem>
                              ) : null}
                              {row.status === "DRAFT" || row.status === "OPEN" ? (
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={isPending}
                                  onSelect={(event) => {
                                    event.preventDefault()
                                    setCloseTarget(null)
                                    setCancelTarget(row)
                                  }}
                                >
                                  <IconX className="size-4" />
                                  Cancel
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-muted-foreground">
                    Page {page} of {totalPages} • {filteredRows.length} records
                  </p>
                  <Select
                    value={pageSize}
                    onValueChange={(value) => {
                      setPageSize(value)
                      setPage(1)
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
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={closeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCloseTarget(null)
          }
        }}
      >
        <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Close Fully Received PO</AlertDialogTitle>
            <AlertDialogDescription>
              {closeTarget ? <>PO {closeTarget.poNumber} is fully received. Closing it will finalize this purchase order.</> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Back</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-violet-600 text-white hover:bg-violet-700"
              onClick={() => {
                if (!closeTarget) {
                  return
                }

                const purchaseOrderId = closeTarget.id
                setCloseTarget(null)
                runAction(() => closePurchaseOrderAction({ companyId, purchaseOrderId }))
              }}
            >
              Confirm Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null)
          }
        }}
      >
        <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Cancel Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget ? (
                <>
                  This will cancel PO {cancelTarget.poNumber}. Cancel only if the order should no longer proceed.
                </>
              ) : null}
            </AlertDialogDescription>
            <p className="text-xs text-muted-foreground">
              Cancellation is blocked once any Goods Receipt PO has already been posted for this PO.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Back</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg"
              onClick={() => {
                if (!cancelTarget) {
                  return
                }

                const purchaseOrderId = cancelTarget.id
                setCancelTarget(null)
                runAction(() => cancelPurchaseOrderAction({ companyId, purchaseOrderId }))
              }}
            >
              Confirm Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
