"use client"

import Link from "next/link"
import { IconArrowLeft, IconReceipt2 } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

      <div className="space-y-7 px-4 py-5 sm:px-6 sm:py-6">
        <section className="border-y border-border/60 bg-muted/10">
          <div className="grid grid-cols-2 gap-0 md:grid-cols-4">
            {[
              { label: "GRPO Number", value: detail.grpoNumber },
              { label: "Source PO", value: detail.poNumber },
              { label: "Received By", value: detail.receivedByName },
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
              { label: "GRPO Number", value: detail.grpoNumber },
              { label: "PO Number", value: detail.poNumber },
              { label: "Source Request", value: detail.sourceRequestNumber },
              { label: "PO Date", value: detail.purchaseOrderDateLabel },
              { label: "Received Date", value: detail.receivedAtLabel },
              { label: "Supplier", value: detail.supplierName },
              { label: "Requester", value: detail.requesterName },
              { label: "Branch", value: detail.requesterBranchName ?? "-" },
              { label: "Department", value: detail.departmentName },
              { label: "Payment Terms", value: detail.paymentTerms },
              { label: "Received By", value: detail.receivedByName },
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
            <IconReceipt2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Received PO Line Items</h2>
          </div>
          <div className="overflow-x-auto border border-border/60">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow className="bg-muted/25 hover:bg-muted/25">
                  <TableHead>#</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Prev</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.lines.map((line, index) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>{line.itemCode || "-"}</TableCell>
                    <TableCell className="max-w-[340px] truncate" title={line.description}>
                      {line.description}
                    </TableCell>
                    <TableCell>{line.uom}</TableCell>
                    <TableCell className="text-right tabular-nums">{quantity.format(line.quantityOrdered)}</TableCell>
                    <TableCell className="text-right tabular-nums">{quantity.format(line.previouslyReceivedQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{quantity.format(line.receivedQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{quantity.format(line.remainingQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency.format(line.unitPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency.format(line.lineTotal)}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={line.remarks ?? undefined}>
                      {line.remarks?.trim() || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 border-t border-border/60 pt-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
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
              <p className="text-xs text-muted-foreground">Discount</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(detail.discount)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-1">
              <p className="text-xs text-muted-foreground">VAT (12%)</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(detail.vatAmount)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-sm font-semibold text-foreground">Grand Total</p>
              <p className="text-base font-bold text-foreground tabular-nums">PHP {currency.format(detail.grandTotal)}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
