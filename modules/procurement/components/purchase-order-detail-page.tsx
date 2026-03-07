"use client"

import Link from "next/link"
import { IconArrowLeft, IconFileInvoice } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export function PurchaseOrderDetailPage({
  companyId,
  companyName,
  companyAddress,
  companyTinNumber,
  detail,
}: PurchaseOrderDetailPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

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

            {detail.status === "OPEN" || detail.status === "PARTIALLY_RECEIVED" || detail.status === "FULLY_RECEIVED" ? (
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
                      This will mark PO {detail.poNumber} as closed. Use this only when the order is already completed.
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

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "PO Number", value: detail.poNumber, icon: IconFileInvoice },
            { label: "Supplier", value: detail.supplierName, icon: IconFileInvoice },
            { label: "Line Items", value: String(detail.lines.length), icon: IconFileInvoice },
            { label: "Grand Total", value: `PHP ${currency.format(detail.grandTotal)}`, icon: IconFileInvoice },
          ].map((item) => (
            <div key={item.label} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xl font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">PO Number</Label>
            <Input value={detail.poNumber} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Source Request</Label>
            <Input value={detail.sourceRequestNumber} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Status</Label>
            <Input value={toStatusLabel(detail.status)} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">PO Date</Label>
            <Input value={detail.purchaseOrderDateLabel} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Expected Delivery</Label>
            <Input value={detail.expectedDeliveryDateLabel ?? "-"} readOnly />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Supplier</Label>
            <Input value={detail.supplierName} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Payment Terms</Label>
            <Input value={detail.paymentTerms} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Prepared By</Label>
            <Input value={detail.createdByName} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Opened At</Label>
            <Input value={detail.openedAt ?? "-"} readOnly />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Branch</Label>
            <Input value={detail.requesterBranchName ?? "-"} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Closed At</Label>
            <Input value={detail.closedAt ?? "-"} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Cancelled At</Label>
            <Input value={detail.cancelledAt ?? "-"} readOnly />
          </div>
        </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <IconFileInvoice className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">PO Line Items</h2>
            </div>
          </div>

          <div className="overflow-hidden">
            <div className="overflow-x-auto">
              <div className="grid min-w-[980px] grid-cols-[2.25rem_7.5rem_minmax(0,1.2fr)_4.75rem_5.25rem_5.25rem_5.25rem_6.5rem_6.5rem_minmax(0,1fr)] items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <p>#</p>
                <p>Item Code</p>
                <p>Description</p>
                <p>UOM</p>
                <p className="text-right">Ordered</p>
                <p className="text-right">Received</p>
                <p className="text-right">Balance</p>
                <p className="text-right">Unit Price</p>
                <p className="text-right">Line Total</p>
                <p>Remarks</p>
              </div>

              <div className="max-h-[22rem] overflow-y-auto">
                {detail.lines.map((line, index) => (
                  <div
                    key={line.id}
                    className="grid min-w-[980px] grid-cols-[2.25rem_7.5rem_minmax(0,1.2fr)_4.75rem_5.25rem_5.25rem_5.25rem_6.5rem_6.5rem_minmax(0,1fr)] items-center gap-2 border-b border-border/60 px-2 py-2 text-xs last:border-b-0"
                  >
                    <p className="text-muted-foreground">{index + 1}</p>
                    <p className="truncate text-foreground">{line.itemCode?.trim() || "-"}</p>
                    <p className="truncate text-foreground" title={line.description}>
                      {line.description}
                    </p>
                    <p className="truncate text-foreground">{line.uom}</p>
                    <p className="text-right tabular-nums text-foreground">{quantityFormatter.format(line.quantityOrdered)}</p>
                    <p className="text-right tabular-nums text-foreground">{quantityFormatter.format(line.quantityReceived)}</p>
                    <p className="text-right tabular-nums text-foreground">{quantityFormatter.format(line.quantityRemaining)}</p>
                    <p className="text-right tabular-nums text-foreground">{currency.format(line.unitPrice)}</p>
                    <p className="text-right tabular-nums text-foreground">{currency.format(line.lineTotal)}</p>
                    <p className="truncate text-foreground" title={line.remarks ?? undefined}>
                      {line.remarks?.trim() || "-"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-4">
          <Label className="text-xs text-foreground">Remarks</Label>
          <Textarea value={detail.remarks ?? ""} readOnly className="min-h-[96px] resize-none rounded-lg" />
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-card p-4 md:grid-cols-4 lg:grid-cols-5">
          <div>
            <p className="text-xs text-muted-foreground">Subtotal</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.subtotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">VAT (12%)</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.vatAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Discount</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.discount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Freight</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.freight)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.grandTotal)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
