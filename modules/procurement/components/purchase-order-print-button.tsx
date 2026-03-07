"use client"

import { IconPrinter } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { toPhDateInputValue } from "@/lib/ph-time"

type PurchaseOrderPrintLine = {
  lineNumber: number
  itemCode: string | null
  description: string
  uom: string
  quantityOrdered: number
  unitPrice: number
  lineTotal: number
  remarks: string | null
}

export type PurchaseOrderPrintPayload = {
  companyName: string
  companyAddress: string | null
  companyTinNumber: string | null
  poNumber: string
  sourceRequestNumber: string
  requesterBranchName: string | null
  supplierName: string
  paymentTerms: string
  applyVat: boolean
  vatAmount: number
  discount: number
  statusLabel: string
  purchaseOrderDateLabel: string
  expectedDeliveryDateLabel: string | null
  createdByName: string
  issuedAtLabel: string | null
  closedAtLabel: string | null
  cancelledAtLabel: string | null
  remarks: string | null
  subtotal: number
  freight: number
  grandTotal: number
  lines: PurchaseOrderPrintLine[]
}

type PurchaseOrderPrintButtonProps = {
  payload: PurchaseOrderPrintPayload
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

const buildPurchaseOrderPrintHtml = (payload: PurchaseOrderPrintPayload): string => {
  const now = new Date()
  const printedDate = toPhDateInputValue(now)
  const printedTime = phTimeFormatter.format(now)

  const rows = payload.lines
    .map((line) => {
      return `
        <tr>
          <td>${line.lineNumber}</td>
          <td>${escapeHtml(line.itemCode ?? "-")}</td>
          <td class="left">${escapeHtml(line.description)}</td>
          <td>${escapeHtml(line.uom)}</td>
          <td class="right">${formatQty(line.quantityOrdered)}</td>
          <td class="right">${formatMoney(line.unitPrice)}</td>
          <td class="right">${formatMoney(line.lineTotal)}</td>
          <td class="left">${escapeHtml(line.remarks ?? "-")}</td>
        </tr>
      `
    })
    .join("")

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Purchase Order ${escapeHtml(payload.poNumber)}</title>
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
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          .header h1 {
            margin: 0;
            font-size: 16px;
            letter-spacing: 0.4px;
          }
          .header p {
            margin: 2px 0 0;
            font-size: 11px;
          }
          .header .document-title {
            font-weight: 700;
          }
          .meta {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
          }
          .meta td {
            border: 1px solid #000;
            padding: 5px 6px;
            vertical-align: top;
            width: 25%;
          }
          .label {
            display: block;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 2px;
          }
          .value {
            font-size: 11px;
            font-weight: 700;
            word-break: break-word;
          }
          table.grid {
            width: 100%;
            border-collapse: collapse;
          }
          .grid th,
          .grid td {
            border: 1px solid #000;
            padding: 5px 6px;
            text-align: center;
            vertical-align: top;
          }
          .grid th {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            background: #f6f6f6;
          }
          .left { text-align: left !important; }
          .right { text-align: right !important; }
          .totals {
            width: 300px;
            border-collapse: collapse;
          }
          .totals td {
            border: 1px solid #000;
            padding: 5px 6px;
          }
          .totals td:first-child {
            width: 50%;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.3px;
          }
          .totals td:last-child {
            text-align: right;
            font-weight: 700;
          }
          .section-title {
            margin: 12px 0 6px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 300px;
            gap: 8px;
            align-items: stretch;
            margin-top: 10px;
            width: 100%;
          }
          .notes {
            border: 1px solid #000;
            padding: 6px;
            min-height: 100%;
            min-width: 0;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
            margin-top: 6px;
            width: 100%;
          }
          .signature-box {
            border: 1px solid #000;
            min-height: 86px;
            min-width: 0;
            padding: 6px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .signature-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 4px;
          }
          .signature-meta {
            font-size: 10px;
            line-height: 1.35;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          .signature-line {
            margin-top: 18px;
            border-top: 1px solid #000;
            padding-top: 4px;
            font-size: 9px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            min-height: 18px;
          }
          .footer {
            margin-top: 10px;
            font-size: 9px;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml(payload.companyName)}</h1>
          <p>${escapeHtml(payload.companyAddress ?? "-")}</p>
          <p>TIN: ${escapeHtml(payload.companyTinNumber ?? "-")}</p>
          <p class="document-title">PURCHASE ORDER</p>
        </div>

        <table class="meta">
          <tr>
            <td><span class="label">Supplier</span><span class="value">${escapeHtml(payload.supplierName)}</span></td>
            <td><span class="label">Payment Terms</span><span class="value">${escapeHtml(payload.paymentTerms)}</span></td>
            <td><span class="label">PO Date</span><span class="value">${escapeHtml(payload.purchaseOrderDateLabel)}</span></td>
            <td><span class="label">PO Number</span><span class="value">${escapeHtml(payload.poNumber)}</span></td>
          </tr>
          <tr>
            <td><span class="label">Source Request</span><span class="value">${escapeHtml(payload.sourceRequestNumber)}</span></td>
            <td><span class="label">Branch</span><span class="value">${escapeHtml(payload.requesterBranchName ?? "-")}</span></td>
            <td><span class="label">Status</span><span class="value">${escapeHtml(payload.statusLabel)}</span></td>
            <td><span class="label">Prepared By</span><span class="value">${escapeHtml(payload.createdByName)}</span></td>
          </tr>
        </table>

        <div class="section-title">Purchase Order Items</div>
        <table class="grid">
          <thead>
            <tr>
              <th style="width:6%">Line</th>
              <th style="width:11%">Code</th>
              <th style="width:27%">Description</th>
              <th style="width:8%">UOM</th>
              <th style="width:8%">Qty</th>
              <th style="width:12%">Unit Price</th>
              <th style="width:12%">Line Total</th>
              <th style="width:16%">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="summary-grid">
          <div>
            <div class="notes">
              <div><strong>Remarks:</strong> ${escapeHtml(payload.remarks ?? "-")}</div>
            </div>
          </div>
          <table class="totals">
            <tr><td>Sub Total</td><td>PHP ${formatMoney(payload.subtotal)}</td></tr>
            <tr><td>VAT (12%)</td><td>PHP ${formatMoney(payload.vatAmount)}</td></tr>
            <tr><td>Discount</td><td>PHP ${formatMoney(payload.discount)}</td></tr>
            <tr><td>Freight</td><td>PHP ${formatMoney(payload.freight)}</td></tr>
            <tr><td>Grand Total</td><td>PHP ${formatMoney(payload.grandTotal)}</td></tr>
          </table>
        </div>

        <div class="signature-grid">
          <div class="signature-box">
            <div class="signature-label">Purchaser</div>
            <div class="signature-meta">&nbsp;</div>
            <div class="signature-line">Signature Over Printed Name</div>
          </div>
          <div class="signature-box">
            <div class="signature-label">Recommending Approval</div>
            <div class="signature-meta">&nbsp;</div>
            <div class="signature-line">Signature Over Printed Name</div>
          </div>
          <div class="signature-box">
            <div class="signature-label">Final Approval</div>
            <div class="signature-meta">&nbsp;</div>
            <div class="signature-line">Signature Over Printed Name</div>
          </div>
        </div>

        <div class="footer">Printed on ${escapeHtml(printedDate)} ${escapeHtml(printedTime)} (Asia/Manila)</div>
      </body>
    </html>
  `
}

export const openPurchaseOrderPrintWindow = (payload: PurchaseOrderPrintPayload): void => {
  const printWindow = window.open("about:blank", "_blank")
  if (!printWindow) {
    return
  }

  printWindow.document.open()
  printWindow.document.write(buildPurchaseOrderPrintHtml(payload))
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}

export function PurchaseOrderPrintButton({ payload, className }: PurchaseOrderPrintButtonProps) {
  return (
    <Button
      type="button"
      className={className ?? "rounded-lg bg-blue-600 text-white hover:bg-blue-700"}
      onClick={() => openPurchaseOrderPrintWindow(payload)}
    >
      <IconPrinter className="mr-1 h-4 w-4" />
      Print
    </Button>
  )
}
