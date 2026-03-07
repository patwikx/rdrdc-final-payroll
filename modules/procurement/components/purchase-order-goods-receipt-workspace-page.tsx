"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  IconFileInvoice,
  IconFilterOff,
  IconFolders,
  IconReceipt2,
  IconSearch,
  IconTruckDelivery,
  IconUser,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type {
  PurchaseOrderGoodsReceiptSourceOrderOption,
  PurchaseOrderGoodsReceiptWorkspaceRow,
} from "@/modules/procurement/types/purchase-order-types"

type PurchaseOrderGoodsReceiptWorkspacePageProps = {
  companyId: string
  rows: PurchaseOrderGoodsReceiptWorkspaceRow[]
  availableOrders: PurchaseOrderGoodsReceiptSourceOrderOption[]
  availableOrderCount: number
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

const DESKTOP_GRPO_GRID_COLUMNS =
  "grid min-w-[1060px] grid-cols-[7rem_6.75rem_minmax(0,1.1fr)_minmax(0,1fr)_6.25rem_4rem_7.5rem_8rem_3rem] items-center gap-1.5"

export function PurchaseOrderGoodsReceiptWorkspacePage({
  companyId,
  rows,
  availableOrders,
  availableOrderCount,
}: PurchaseOrderGoodsReceiptWorkspacePageProps) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")
  const [supplier, setSupplier] = useState("ALL")
  const [sourceRequest, setSourceRequest] = useState("ALL")
  const [openPoSearch, setOpenPoSearch] = useState("")
  const [openPoSupplier, setOpenPoSupplier] = useState("ALL")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState("10")
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
      Array.from(
        new Set(rows.map((row) => row.sourceRequestNumber.trim()).filter((requestNo) => requestNo.length > 0))
      ).sort((a, b) => a.localeCompare(b)),
    [rows]
  )

  const openSourceOrders = useMemo(
    () => availableOrders.filter((order) => order.purchaseOrderStatus === "OPEN"),
    [availableOrders]
  )
  const openPoSupplierOptions = useMemo(
    () =>
      Array.from(
        new Set(openSourceOrders.map((order) => order.supplierName.trim()).filter((name) => name.length > 0))
      ).sort((a, b) => a.localeCompare(b)),
    [openSourceOrders]
  )
  const filteredOpenSourceOrders = useMemo(() => {
    const query = openPoSearch.trim().toLowerCase()

    return openSourceOrders.filter((order) => {
      if (openPoSupplier !== "ALL" && order.supplierName !== openPoSupplier) {
        return false
      }

      if (!query) {
        return true
      }

      return [order.poNumber, order.sourceRequestNumber, order.supplierName, order.requesterName]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [openPoSearch, openPoSupplier, openSourceOrders])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()

    return rows.filter((row) => {
      if (status !== "ALL" && row.purchaseOrderStatus !== status) {
        return false
      }

      if (supplier !== "ALL" && row.supplierName !== supplier) {
        return false
      }

      if (sourceRequest !== "ALL" && row.sourceRequestNumber !== sourceRequest) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        row.grpoNumber,
        row.poNumber,
        row.purchaseOrderStatus,
        row.supplierName,
        row.sourceRequestNumber,
        row.receivedByName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [rows, search, sourceRequest, status, supplier])

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
        accumulator.totalAmount += row.grandTotal

        if (row.purchaseOrderStatus === "OPEN") {
          accumulator.open += 1
        }

        if (row.purchaseOrderStatus === "PARTIALLY_RECEIVED") {
          accumulator.partiallyReceived += 1
        }

        if (row.purchaseOrderStatus === "FULLY_RECEIVED") {
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

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Purchasing Workspace</p>
            <div className="mt-2 flex items-center gap-4">
              <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground sm:text-2xl">
                <IconReceipt2 className="h-5 w-5 text-primary" />
                Goods Receipt PO
              </h1>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                PO {"->"} GRPO
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {availableOrderCount} open or partially received purchase order(s) still have receivable quantities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="rounded-lg">
              <Link href={`/${companyId}/employee-portal/purchase-orders`}>
                <IconFileInvoice className="mr-1 h-4 w-4" />
                Purchase Orders
              </Link>
            </Button>
            <Button asChild className="rounded-lg">
              <Link href={`/${companyId}/employee-portal/goods-receipt-pos/create`}>Create Goods Receipt PO</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Open Source POs", value: String(summary.open), icon: IconTruckDelivery },
            { label: "Partial Source POs", value: String(summary.partiallyReceived), icon: IconReceipt2 },
            { label: "Full Source POs", value: String(summary.fullyReceived), icon: IconFileInvoice },
            { label: "Page Amount", value: `PHP ${currency.format(summary.totalAmount)}`, icon: IconReceipt2 },
          ].map((item) => (
            <div
              key={item.label}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20"
            >
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
                Open PO Queue
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filteredOpenSourceOrders.length} open purchase order(s) for GRPO
              </p>
            </div>

            <div className="mt-3 space-y-2">
              <div className="relative min-w-0">
                <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={openPoSearch}
                  onChange={(event) => setOpenPoSearch(event.target.value)}
                  placeholder="Search PO #, supplier, request #"
                  className="rounded-lg pl-8"
                />
              </div>
              <Select value={openPoSupplier} onValueChange={setOpenPoSupplier}>
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All suppliers</SelectItem>
                  {openPoSupplierOptions.map((supplierName) => (
                    <SelectItem key={supplierName} value={supplierName}>
                      {supplierName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredOpenSourceOrders.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                No open purchase orders match the queue filters.
              </div>
            ) : (
              <ScrollArea className="mt-3 min-h-0 flex-1 pr-1">
                <div className="space-y-2">
                  {filteredOpenSourceOrders.map((order) => (
                    <div key={order.id} className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{order.poNumber}</p>
                          <p className="text-[11px] text-muted-foreground">{order.sourceRequestNumber}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full border px-2 py-0.5 text-[10px]">
                          {order.lines.length} lines
                        </Badge>
                      </div>
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <IconUser className="h-3.5 w-3.5" />
                        {order.supplierName}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{order.purchaseOrderDateLabel}</span>
                        <span>PHP {currency.format(order.grandTotal)}</span>
                      </div>
                      <Button asChild size="sm" className="mt-2 h-8 w-full rounded-lg">
                        <Link href={`/${companyId}/employee-portal/goods-receipt-pos/create?purchaseOrderId=${order.id}`}>
                          Create GRPO from PO
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
                  placeholder="Search GRPO #, PO #, supplier, request #"
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
                <SelectTrigger className="w-[180px] shrink-0 rounded-lg">
                  <SelectValue placeholder="PO status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All PO statuses</SelectItem>
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

              <Select
                value={sourceRequest}
                onValueChange={(value) => {
                  setSourceRequest(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[180px] shrink-0 rounded-lg">
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

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setStatus("ALL")
                  setSupplier("ALL")
                  setSourceRequest("ALL")
                  setOpenPoSearch("")
                  setOpenPoSupplier("ALL")
                  setPage(1)
                  setPageSize("10")
                }}
                className="shrink-0"
              >
                <IconFilterOff className="mr-2 size-4" />
                Reset Filters
              </Button>
            </div>

            {filteredRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
                No Goods Receipt PO records match the current filters.
              </div>
            ) : (
              <div className="overflow-hidden border border-border/60 bg-card">
                <div className="space-y-2 p-3 lg:hidden">
                  {paginatedRows.map((row) => (
                    <div key={`grpo-mobile-${row.id}`} className="rounded-xl border border-border/60 bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground">GRPO #</p>
                          <p className="truncate text-sm font-medium text-foreground">{row.grpoNumber}</p>
                        </div>
                        <Badge
                          variant={statusVariant(row.purchaseOrderStatus)}
                          className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]"
                        >
                          {toStatusLabel(row.purchaseOrderStatus)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div>
                          <p className="text-[11px] text-muted-foreground">PO #</p>
                          <p className="text-foreground">{row.poNumber}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Supplier</p>
                          <p className="truncate text-foreground">{row.supplierName}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Source Request</p>
                          <p className="text-foreground">{row.sourceRequestNumber}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Received Date</p>
                          <p className="text-foreground">{row.receivedAtLabel}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Items</p>
                          <Badge variant="outline" className="mt-1 rounded-full border px-2 py-0 text-[10px]">
                            {row.itemCount}
                          </Badge>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] text-muted-foreground">Amount</p>
                          <p className="font-medium text-foreground">PHP {currency.format(row.grandTotal)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" size="sm" className="rounded-lg text-xs" asChild>
                          <Link href={`/${companyId}/employee-portal/goods-receipt-pos/${row.id}`}>View</Link>
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-xs" asChild>
                          <Link href={`/${companyId}/employee-portal/purchase-orders/${row.purchaseOrderId}`}>Source PO</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden lg:block">
                  <div className="overflow-x-auto">
                    <div>
                      <div className={`${DESKTOP_GRPO_GRID_COLUMNS} border-b border-border/60 bg-muted/30 px-3 py-2`}>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">GRPO #</p>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">PO #</p>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Supplier</p>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Source Request</p>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Received</p>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Items</p>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">PO Status</p>
                        <p className="text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                      </div>

                      {paginatedRows.map((row) => (
                        <div
                          key={row.id}
                          className={`${DESKTOP_GRPO_GRID_COLUMNS} border-b border-border/60 px-3 py-2 text-xs last:border-b-0 hover:bg-muted/20`}
                        >
                          <div className="truncate font-medium text-foreground" title={row.grpoNumber}>
                            {row.grpoNumber}
                          </div>
                          <div className="text-foreground">{row.poNumber}</div>
                          <div className="truncate text-foreground" title={row.supplierName}>
                            {row.supplierName}
                          </div>
                          <div className="truncate text-foreground" title={row.sourceRequestNumber}>
                            {row.sourceRequestNumber}
                          </div>
                          <div className="text-foreground">{row.receivedAtLabel}</div>
                          <div>
                            <Badge variant="outline" className="rounded-full border px-2 py-0 text-[10px]">
                              {row.itemCount}
                            </Badge>
                          </div>
                          <div className="font-medium text-foreground">PHP {currency.format(row.grandTotal)}</div>
                          <div>
                            <Badge
                              variant={statusVariant(row.purchaseOrderStatus)}
                              className="w-full justify-center rounded-full border px-2 py-1 text-[10px] shadow-none"
                            >
                              {toStatusLabel(row.purchaseOrderStatus)}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild size="sm" className="rounded-lg text-xs">
                              <Link href={`/${companyId}/employee-portal/goods-receipt-pos/${row.id}`}>View</Link>
                            </Button>
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
    </div>
  )
}
