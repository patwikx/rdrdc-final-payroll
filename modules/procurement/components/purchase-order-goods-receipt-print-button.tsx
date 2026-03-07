"use client"

import { IconPrinter } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { toPhDateInputValue } from "@/lib/ph-time"

type PurchaseOrderGoodsReceiptPrintLine = {
  lineNumber: number
  itemCode: string | null
  description: string
  uom: string
  quantityOrdered: number
  previouslyReceivedQuantity: number
  receivedQuantity: number
  remainingQuantity: number
  unitPrice: number
  lineTotal: number
  remarks: string | null
}

export type PurchaseOrderGoodsReceiptPrintPayload = {
  companyName: string
  companyAddress: string | null
  companyTinNumber: string | null
  grpoNumber: string
  poNumber: string
  sourceRequestNumber: string
  supplierName: string
  requesterName: string
  requesterBranchName: string | null
  departmentName: string
  paymentTerms: string
  purchaseOrderDateLabel: string
  receivedAtLabel: string
  receivedByName: string
  remarks: string | null
  subtotal: number
  vatAmount: number
  discount: number
  grandTotal: number
  lines: PurchaseOrderGoodsReceiptPrintLine[]
}

type PurchaseOrderGoodsReceiptPrintButtonProps = {
  payload: PurchaseOrderGoodsReceiptPrintPayload
  className?: string
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const qtyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

const phTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "Asia/Manila",
})

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const formatMoney = (value: number): string => currency.format(value)
const formatQty = (value: number): string => qtyFormatter.format(value)

const buildPurchaseOrderGoodsReceiptPrintHtml = (payload: PurchaseOrderGoodsReceiptPrintPayload): string => {
  const now = new Date()
  const printedDate = toPhDateInputValue(now)
  const printedTime = phTimeFormatter.format(now)

  const rows = payload.lines
    .map(
      (line) => `
        <tr>
          <td>${line.lineNumber}</td>
          <td>${escapeHtml(line.itemCode ?? "-")}</td>
          <td class="left">${escapeHtml(line.description)}</td>
          <td>${escapeHtml(line.uom)}</td>
          <td class="right">${formatQty(line.quantityOrdered)}</td>
          <td class="right">${formatQty(line.previouslyReceivedQuantity)}</td>
          <td class="right">${formatQty(line.receivedQuantity)}</td>
          <td class="right">${formatQty(line.remainingQuantity)}</td>
          <td class="right">${formatMoney(line.unitPrice)}</td>
          <td class="right">${formatMoney(line.lineTotal)}</td>
          <td class="left">${escapeHtml(line.remarks ?? "-")}</td>
        </tr>
      `
    )
    .join("")

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Goods Receipt PO ${escapeHtml(payload.grpoNumber)}</title>
        <style>
          :root { color-scheme: light; }
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #fff;
            color: #000;
            font-family: Arial, sans-serif;
            font-size: 11px;
            line-height: 1.35;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .header h1 { margin: 0; font-size: 16px; letter-spacing: 0.4px; }
          .header p { margin: 2px 0 0; font-size: 11px; }
          .document-title { font-weight: 700; }
          .meta { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .meta td { border: 1px solid #000; padding: 5px 6px; vertical-align: top; width: 25%; }
          .label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
          .value { font-size: 11px; font-weight: 700; word-break: break-word; }
          table.grid { width: 100%; border-collapse: collapse; }
          .grid th, .grid td { border: 1px solid #000; padding: 5px 6px; text-align: center; vertical-align: top; }
          .grid th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; background: #f6f6f6; }
          .left { text-align: left !important; }
          .right { text-align: right !important; }
          .summary-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 300px;
            gap: 8px;
            align-items: stretch;
            margin-top: 10px;
          }
          .notes { border: 1px solid #000; padding: 6px; min-height: 100%; word-break: break-word; overflow-wrap: anywhere; }
          .totals { width: 300px; border-collapse: collapse; }
          .totals td { border: 1px solid #000; padding: 5px 6px; }
          .totals td:first-child { width: 50%; text-transform: uppercase; font-size: 9px; letter-spacing: 0.3px; }
          .totals td:last-child { text-align: right; font-weight: 700; }
          .footer { margin-top: 10px; font-size: 9px; text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml(payload.companyName)}</h1>
          <p>${escapeHtml(payload.companyAddress ?? "-")}</p>
          <p>TIN: ${escapeHtml(payload.companyTinNumber ?? "-")}</p>
          <p class="document-title">GOODS RECEIPT PO</p>
        </div>

        <table class="meta">
          <tr>
            <td><span class="label">GRPO Number</span><span class="value">${escapeHtml(payload.grpoNumber)}</span></td>
            <td><span class="label">PO Number</span><span class="value">${escapeHtml(payload.poNumber)}</span></td>
            <td><span class="label">Source Request</span><span class="value">${escapeHtml(payload.sourceRequestNumber)}</span></td>
            <td><span class="label">Received Date</span><span class="value">${escapeHtml(payload.receivedAtLabel)}</span></td>
          </tr>
          <tr>
            <td><span class="label">Supplier</span><span class="value">${escapeHtml(payload.supplierName)}</span></td>
            <td><span class="label">Requester</span><span class="value">${escapeHtml(payload.requesterName)}</span></td>
            <td><span class="label">Branch / Department</span><span class="value">${escapeHtml(payload.requesterBranchName ?? "-")} / ${escapeHtml(payload.departmentName)}</span></td>
            <td><span class="label">Received By</span><span class="value">${escapeHtml(payload.receivedByName)}</span></td>
          </tr>
          <tr>
            <td><span class="label">Payment Terms</span><span class="value">${escapeHtml(payload.paymentTerms)}</span></td>
            <td><span class="label">PO Date</span><span class="value">${escapeHtml(payload.purchaseOrderDateLabel)}</span></td>
            <td colspan="2"><span class="label">Remarks</span><span class="value">${escapeHtml(payload.remarks ?? "-")}</span></td>
          </tr>
        </table>

        <table class="grid">
          <thead>
            <tr>
              <th style="width:5%">Line</th>
              <th style="width:9%">Code</th>
              <th style="width:23%">Description</th>
              <th style="width:6%">UOM</th>
              <th style="width:8%">Ordered</th>
              <th style="width:8%">Prev</th>
              <th style="width:8%">Received</th>
              <th style="width:8%">Balance</th>
              <th style="width:10%">Unit Price</th>
              <th style="width:10%">Line Total</th>
              <th style="width:15%">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="summary-grid">
          <div class="notes"><strong>Receipt Notes:</strong> ${escapeHtml(payload.remarks ?? "-")}</div>
          <table class="totals">
            <tr><td>Sub Total</td><td>PHP ${formatMoney(payload.subtotal)}</td></tr>
            <tr><td>Discount</td><td>PHP ${formatMoney(payload.discount)}</td></tr>
            <tr><td>VAT (12%)</td><td>PHP ${formatMoney(payload.vatAmount)}</td></tr>
            <tr><td>Grand Total</td><td>PHP ${formatMoney(payload.grandTotal)}</td></tr>
          </table>
        </div>

        <div class="footer">Printed on ${escapeHtml(printedDate)} ${escapeHtml(printedTime)} (Asia/Manila)</div>
      </body>
    </html>
  `
}

export const openPurchaseOrderGoodsReceiptPrintWindow = (payload: PurchaseOrderGoodsReceiptPrintPayload): void => {
  const printWindow = window.open("about:blank", "_blank")
  if (!printWindow) {
    return
  }

  printWindow.document.open()
  printWindow.document.write(buildPurchaseOrderGoodsReceiptPrintHtml(payload))
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}

export function PurchaseOrderGoodsReceiptPrintButton({
  payload,
  className,
}: PurchaseOrderGoodsReceiptPrintButtonProps) {
  return (
    <Button
      type="button"
      className={className ?? "rounded-lg bg-blue-600 text-white hover:bg-blue-700"}
      onClick={() => openPurchaseOrderGoodsReceiptPrintWindow(payload)}
    >
      <IconPrinter className="mr-1 h-4 w-4" />
      Print
    </Button>
  )
}
