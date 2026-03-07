"use client"

import Link from "next/link"
import { IconArrowLeft, IconFileInvoice } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  cancelPurchaseOrderAction,
  closePurchaseOrderAction,
  closePurchaseOrderLineAction,
  openPurchaseOrderAction,
} from "@/modules/procurement/actions/purchase-order-actions"
import { PurchaseOrderPrintButton } from "@/modules/procurement/components/purchase-order-print-button"
import type { PurchaseOrderDetail } from "@/modules/procurement/types/purchase-order-types"

type PurchaseOrderDetailPageProps = {
  companyId: string
  companyName: string
  companyAddress: string | null
  companyTinNumber: string | null
  detail: PurchaseOrderDetail
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const quantityFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "CANCELLED") return "outline"
  if (status === "CLOSED") return "default"
  if (status === "FULLY_RECEIVED") return "default"
  if (status === "PARTIALLY_RECEIVED") return "secondary"
  if (status === "OPEN") return "secondary"
  return "outline"
}

const toStatusLabel = (status: string): string => status.replaceAll("_", " ")

const lineStatusLabel = (line: PurchaseOrderDetail["lines"][number]): string => {
  if (line.isShortClosed) return "CLOSED SHORT"
  if (line.quantityRemaining <= 0.0001) return "FULLY RECEIVED"
  if (line.quantityReceived > 0.0001) return "PARTIAL"
  return "OPEN"
}

export function PurchaseOrderDetailPage({
  companyId,
  companyName,
  companyAddress,
  companyTinNumber,
  detail,
}: PurchaseOrderDetailPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [shortCloseLineTarget, setShortCloseLineTarget] = useState<PurchaseOrderDetail["lines"][number] | null>(null)
  const [shortCloseReason, setShortCloseReason] = useState("")

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

  const hasReceivableBalance = detail.lines.some((line) => !line.isShortClosed && line.quantityRemaining > 0.0001)
  const hasUnservedAmount = detail.unservedAmount > 0.009

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Procurement Workspace</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground sm:text-2xl">
                <IconFileInvoice className="h-5 w-5 text-primary" />
                Purchase Order Detail
              </h1>
              <Badge variant={statusVariant(detail.status)} className="rounded-full border px-2 py-1 text-xs shadow-none">
                {toStatusLabel(detail.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              PO {detail.poNumber} • Source Request {detail.sourceRequestNumber}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <PurchaseOrderPrintButton
                    payload={{
                      companyName,
                      companyAddress,
                      companyTinNumber,
                      poNumber: detail.poNumber,
                      sourceRequestNumber: detail.sourceRequestNumber,
                      requesterBranchName: detail.requesterBranchName,
                      supplierName: detail.supplierName,
                      paymentTerms: detail.paymentTerms,
                      applyVat: detail.applyVat,
                      vatAmount: detail.vatAmount,
                      discount: detail.discount,
                      statusLabel: toStatusLabel(detail.status),
                      purchaseOrderDateLabel: detail.purchaseOrderDateLabel,
                      expectedDeliveryDateLabel: detail.expectedDeliveryDateLabel,
                      createdByName: detail.createdByName,
                      issuedAtLabel: detail.openedAt,
                      closedAtLabel: detail.closedAt,
                      cancelledAtLabel: detail.cancelledAt,
                      remarks: detail.remarks,
                      subtotal: detail.subtotal,
                      freight: detail.freight,
                      grandTotal: detail.grandTotal,
                      lines: detail.lines.map((line) => ({
                        lineNumber: line.lineNumber,
                        itemCode: line.itemCode,
                        description: line.description,
                        uom: line.uom,
                        quantityOrdered: line.quantityOrdered,
                        unitPrice: line.unitPrice,
                        lineTotal: line.lineTotal,
                        remarks: line.remarks,
                      })),
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                Print purchase order details
              </TooltipContent>
            </Tooltip>

            {(detail.status === "OPEN" || detail.status === "PARTIALLY_RECEIVED") &&
            detail.lines.some((line) => line.quantityRemaining > 0.0001) ? (
              <Button type="button" variant="outline" className="rounded-lg" asChild>
                <Link href={`/${companyId}/employee-portal/goods-receipt-pos/create?purchaseOrderId=${detail.id}`}>
                  Create Goods Receipt PO
                </Link>
              </Button>
            ) : null}

            {detail.status === "DRAFT" ? (
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        className="rounded-lg bg-green-600 text-white hover:bg-green-700"
                        disabled={isPending}
                      >
                        Open
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    Open this draft purchase order
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base font-semibold">Open Purchase Order</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will move PO {detail.poNumber} from draft to open and make it ready for receiving.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg">Back</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-lg bg-green-600 text-white hover:bg-green-700"
                      onClick={() =>
                        runAction(() => openPurchaseOrderAction({ companyId, purchaseOrderId: detail.id }))
                      }
                    >
                      Confirm Open
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}

            {detail.status === "FULLY_RECEIVED" ? (
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        className="rounded-lg bg-violet-600 text-white hover:bg-violet-700"
                        disabled={isPending}
                      >
                        Close
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    Mark this purchase order as closed
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base font-semibold">Close Purchase Order</AlertDialogTitle>
                    <AlertDialogDescription>
                      PO {detail.poNumber} is fully received. Closing it will finalize this purchase order.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg">Back</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-lg bg-violet-600 text-white hover:bg-violet-700"
                      onClick={() =>
                        runAction(() => closePurchaseOrderAction({ companyId, purchaseOrderId: detail.id }))
                      }
                    >
                      Confirm Close
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}

            {(detail.status === "DRAFT" || detail.status === "OPEN") ? (
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" className="rounded-lg" disabled={isPending}>
                        Cancel
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    Cancel this purchase order
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base font-semibold">Cancel Purchase Order</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel PO {detail.poNumber}. Cancel only if the order should no longer proceed.
                    </AlertDialogDescription>
                    <p className="text-xs text-muted-foreground">
                      Cancellation is blocked once any Goods Receipt PO has already been posted for this PO.
                    </p>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg">Back</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-lg"
                      onClick={() =>
                        runAction(() => cancelPurchaseOrderAction({ companyId, purchaseOrderId: detail.id }))
                      }
                    >
                      Confirm Cancel
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="outline" className="rounded-lg" asChild>
                  <Link href={`/${companyId}/employee-portal/purchase-orders`}>
                    <IconArrowLeft className="mr-1 h-4 w-4" />
                    Back to PO List
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                Return to purchase orders
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="space-y-7 px-4 py-5 sm:px-6 sm:py-6">
        <section className="border-y border-border/60 bg-muted/10">
          <div className="grid grid-cols-2 gap-0 md:grid-cols-4">
            {[
              { label: "PO Number", value: detail.poNumber },
              { label: "Supplier", value: detail.supplierName },
              { label: "Line Items", value: String(detail.lines.length) },
              { label: "Grand Total", value: `PHP ${currency.format(detail.grandTotal)}` },
            ].map((item, index) => (
              <div key={item.label} className={`px-3 py-3 ${index > 0 ? "border-l border-border/60" : ""}`}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Document Details</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "PO Number", value: detail.poNumber },
              { label: "Source Request", value: detail.sourceRequestNumber },
              { label: "Status", value: toStatusLabel(detail.status) },
              { label: "PO Date", value: detail.purchaseOrderDateLabel },
              { label: "Expected Delivery", value: detail.expectedDeliveryDateLabel ?? "-" },
              { label: "Supplier", value: detail.supplierName },
              { label: "Payment Terms", value: detail.paymentTerms },
              { label: "Prepared By", value: detail.createdByName },
              { label: "Branch", value: detail.requesterBranchName ?? "-" },
              { label: "Opened At", value: detail.openedAt ?? "-" },
              { label: "Closed At", value: detail.closedAt ?? "-" },
              { label: "Cancelled At", value: detail.cancelledAt ?? "-" },
            ].map((item) => (
              <div key={item.label} className="space-y-1 border-b border-border/40 pb-2">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                <dd className="text-sm font-medium text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-3 border-t border-border/60 pt-5">
          <div className="flex items-center gap-2">
            <IconFileInvoice className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">PO Line Items</h2>
          </div>
          <div className="overflow-x-auto border border-border/60">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="bg-muted/25 hover:bg-muted/25">
                  <TableHead>#</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                  <TableHead>Line Status</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.lines.map((line, index) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>{line.itemCode?.trim() || "-"}</TableCell>
                    <TableCell className="max-w-[320px] truncate" title={line.description}>
                      {line.description}
                    </TableCell>
                    <TableCell>{line.uom}</TableCell>
                    <TableCell className="text-right tabular-nums">{quantityFormatter.format(line.quantityOrdered)}</TableCell>
                    <TableCell className="text-right tabular-nums">{quantityFormatter.format(line.quantityReceived)}</TableCell>
                    <TableCell className="text-right tabular-nums">{quantityFormatter.format(line.quantityRemaining)}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency.format(line.unitPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency.format(line.lineTotal)}</TableCell>
                    <TableCell>
                      <Badge variant={line.isShortClosed ? "outline" : "secondary"} className="rounded-full border px-2 py-0.5 text-[10px]">
                        {lineStatusLabel(line)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={line.remarks ?? undefined}>
                      {line.isShortClosed ? line.shortClosedReason?.trim() || "Short-closed" : line.remarks?.trim() || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!line.isShortClosed &&
                      line.quantityRemaining > 0.0001 &&
                      (detail.status === "OPEN" || detail.status === "PARTIALLY_RECEIVED") ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg"
                          disabled={isPending}
                          onClick={() => {
                            setShortCloseLineTarget(line)
                            setShortCloseReason("")
                          }}
                        >
                          Close Remaining
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 border-t border-border/60 pt-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Remarks</p>
            <p className="min-h-[92px] whitespace-pre-wrap border border-border/60 px-3 py-2 text-sm text-foreground">
              {detail.remarks?.trim() || "-"}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-1">
              <p className="text-xs text-muted-foreground">Subtotal</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(detail.subtotal)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-1">
              <p className="text-xs text-muted-foreground">VAT (12%)</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(detail.vatAmount)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-1">
              <p className="text-xs text-muted-foreground">Discount</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(detail.discount)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-1">
              <p className="text-xs text-muted-foreground">Freight</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(detail.freight)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-sm font-semibold text-foreground">Grand Total</p>
              <p className="text-base font-bold text-foreground tabular-nums">PHP {currency.format(detail.grandTotal)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-2">
              <p className="text-xs text-muted-foreground">Realized Amount (GRPO)</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(detail.realizedAmount)}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Unserved Amount</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(detail.unservedAmount)}</p>
            </div>
            {detail.status === "CLOSED" && hasUnservedAmount ? (
              <p className="text-[11px] text-muted-foreground">
                This purchase order was closed with unserved value based on remaining undelivered quantities.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <AlertDialog
        open={shortCloseLineTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShortCloseLineTarget(null)
            setShortCloseReason("")
          }
        }}
      >
        <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Close Remaining Line Quantity</AlertDialogTitle>
            <AlertDialogDescription>
              {shortCloseLineTarget ? (
                <>
                  Line {shortCloseLineTarget.lineNumber} still has{" "}
                  {quantityFormatter.format(shortCloseLineTarget.quantityRemaining)} remaining. Use this when supplier
                  can no longer serve this balance.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Reason <span className="text-red-500">*</span></p>
            <Textarea
              value={shortCloseReason}
              onChange={(event) => setShortCloseReason(event.target.value)}
              placeholder="Enter reason for short close..."
              className="min-h-[96px] resize-none rounded-lg"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Back</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg"
              disabled={shortCloseReason.trim().length === 0 || isPending}
              onClick={() => {
                if (!shortCloseLineTarget) {
                  return
                }

                const purchaseOrderLineId = shortCloseLineTarget.id
                const reason = shortCloseReason.trim()
                setShortCloseLineTarget(null)
                setShortCloseReason("")
                runAction(() => closePurchaseOrderLineAction({ companyId, purchaseOrderLineId, reason }))
              }}
            >
              Confirm Line Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
