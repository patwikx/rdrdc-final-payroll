"use client"

import Link from "next/link"
import { IconArrowLeft, IconReceipt2 } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PurchaseOrderGoodsReceiptPrintButton } from "@/modules/procurement/components/purchase-order-goods-receipt-print-button"
import type { PurchaseOrderGoodsReceiptDetail } from "@/modules/procurement/types/purchase-order-types"

type PurchaseOrderGoodsReceiptDetailPageProps = {
  companyId: string
  companyName: string
  companyAddress: string | null
  companyTinNumber: string | null
  detail: PurchaseOrderGoodsReceiptDetail
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const quantity = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

export function PurchaseOrderGoodsReceiptDetailPage({
  companyId,
  companyName,
  companyAddress,
  companyTinNumber,
  detail,
}: PurchaseOrderGoodsReceiptDetailPageProps) {
  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Procurement Workspace</p>
            <div className="flex items-center gap-3">
              <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground sm:text-2xl">
                <IconReceipt2 className="h-5 w-5 text-primary" />
                Goods Receipt PO Detail
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {detail.grpoNumber} • Source PO {detail.poNumber}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PurchaseOrderGoodsReceiptPrintButton
              payload={{
                companyName,
                companyAddress,
                companyTinNumber,
                grpoNumber: detail.grpoNumber,
                poNumber: detail.poNumber,
                sourceRequestNumber: detail.sourceRequestNumber,
                supplierName: detail.supplierName,
                requesterName: detail.requesterName,
                requesterBranchName: detail.requesterBranchName,
                departmentName: detail.departmentName,
                paymentTerms: detail.paymentTerms,
                purchaseOrderDateLabel: detail.purchaseOrderDateLabel,
                receivedAtLabel: detail.receivedAtLabel,
                receivedByName: detail.receivedByName,
                remarks: detail.remarks,
                subtotal: detail.subtotal,
                vatAmount: detail.vatAmount,
                discount: detail.discount,
                grandTotal: detail.grandTotal,
                lines: detail.lines.map((line) => ({
                  lineNumber: line.lineNumber,
                  itemCode: line.itemCode,
                  description: line.description,
                  uom: line.uom,
                  quantityOrdered: line.quantityOrdered,
                  previouslyReceivedQuantity: line.previouslyReceivedQuantity,
                  receivedQuantity: line.receivedQuantity,
                  remainingQuantity: line.remainingQuantity,
                  unitPrice: line.unitPrice,
                  lineTotal: line.lineTotal,
                  remarks: line.remarks,
                })),
              }}
            />
            <Button type="button" variant="outline" className="rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/purchase-orders/${detail.purchaseOrderId}`}>Source PO</Link>
            </Button>
            <Button type="button" variant="outline" className="rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/goods-receipt-pos`}>
                <IconArrowLeft className="mr-1 h-4 w-4" />
                Back to GRPO List
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "GRPO Number", value: detail.grpoNumber, icon: IconReceipt2 },
            { label: "Source PO", value: detail.poNumber, icon: IconReceipt2 },
            { label: "Received By", value: detail.receivedByName, icon: IconReceipt2 },
            { label: "Grand Total", value: `PHP ${currency.format(detail.grandTotal)}`, icon: IconReceipt2 },
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
            <Label className="text-xs text-foreground">GRPO Number</Label>
            <Input value={detail.grpoNumber} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">PO Number</Label>
            <Input value={detail.poNumber} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Source Request</Label>
            <Input value={detail.sourceRequestNumber} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">PO Date</Label>
            <Input value={detail.purchaseOrderDateLabel} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Received Date</Label>
            <Input value={detail.receivedAtLabel} readOnly />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Supplier</Label>
            <Input value={detail.supplierName} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Requester</Label>
            <Input value={detail.requesterName} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Branch</Label>
            <Input value={detail.requesterBranchName ?? "-"} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Department</Label>
            <Input value={detail.departmentName} readOnly />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Payment Terms</Label>
            <Input value={detail.paymentTerms} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Received By</Label>
            <Input value={detail.receivedByName} readOnly />
          </div>
        </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <IconReceipt2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Received PO Line Items</h2>
            </div>
          </div>

          <div className="overflow-hidden">
            <div className="overflow-x-auto">
              <div className="grid min-w-[1100px] grid-cols-[2.5rem_7rem_minmax(0,1.3fr)_4.5rem_5rem_5rem_5rem_5rem_6rem_6rem_minmax(0,1fr)] items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <p>#</p>
                <p>Item Code</p>
                <p>Description</p>
                <p>UOM</p>
                <p className="text-right">Ordered</p>
                <p className="text-right">Prev</p>
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
                    className="grid min-w-[1100px] grid-cols-[2.5rem_7rem_minmax(0,1.3fr)_4.5rem_5rem_5rem_5rem_5rem_6rem_6rem_minmax(0,1fr)] items-center gap-2 border-b border-border/60 px-2 py-2 text-xs last:border-b-0"
                  >
                    <p className="text-muted-foreground">{index + 1}</p>
                    <p className="truncate text-foreground">{line.itemCode || "-"}</p>
                    <p className="truncate text-foreground" title={line.description}>
                      {line.description}
                    </p>
                    <p className="truncate text-foreground">{line.uom}</p>
                    <p className="text-right tabular-nums text-foreground">{quantity.format(line.quantityOrdered)}</p>
                    <p className="text-right tabular-nums text-foreground">{quantity.format(line.previouslyReceivedQuantity)}</p>
                    <p className="text-right tabular-nums text-foreground">{quantity.format(line.receivedQuantity)}</p>
                    <p className="text-right tabular-nums text-foreground">{quantity.format(line.remainingQuantity)}</p>
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

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-card p-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Subtotal</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.subtotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Discount</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.discount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">VAT (12%)</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.vatAmount)}</p>
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
