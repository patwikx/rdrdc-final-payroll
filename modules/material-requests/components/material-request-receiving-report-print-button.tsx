"use client"

import { IconPrinter } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { toPhDateInputValue } from "@/lib/ph-time"

type MaterialRequestReceivingReportPrintItem = {
  lineNumber: number
  itemCode: string | null
  description: string
  uom: string
  requestedQuantity: number
  receivedQuantity: number
  unitPrice: number | null
  lineTotal: number | null
  remarks: string | null
}

export type MaterialRequestReceivingReportPrintPayload = {
  companyName: string
  reportNumber: string
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
  departmentName: string
  datePreparedLabel: string
  dateRequiredLabel: string
  processingCompletedAtLabel: string | null
  requesterAcknowledgedAtLabel: string | null
  receivedAtLabel: string
  receivedByName: string
  postingStatus: string
  postingReference: string | null
  postedAtLabel: string | null
  postedByName: string | null
  remarks: string | null
  subTotal: number
  freight: number
  discount: number
  grandTotal: number
  items: MaterialRequestReceivingReportPrintItem[]
}

type MaterialRequestReceivingReportPrintButtonProps = {
  payload: MaterialRequestReceivingReportPrintPayload
  className?: string
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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
const formatQty = (value: number): string => value.toFixed(3)

const buildMaterialRequestReceivingReportPrintHtml = (payload: MaterialRequestReceivingReportPrintPayload): string => {
  const now = new Date()
  const printedDate = toPhDateInputValue(now)
  const printedTime = phTimeFormatter.format(now)

  const rows = payload.items
    .map((item) => {
      return `
        <tr>
          <td>${item.lineNumber}</td>
          <td>${escapeHtml(item.itemCode ?? "-")}</td>
          <td class="left">${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.uom)}</td>
          <td class="right">${formatQty(item.requestedQuantity)}</td>
          <td class="right">${formatQty(item.receivedQuantity)}</td>
          <td class="right">${formatMoney(item.unitPrice ?? 0)}</td>
          <td class="right">${formatMoney(item.lineTotal ?? 0)}</td>
          <td class="left">${escapeHtml(item.remarks ?? "-")}</td>
        </tr>
      `
    })
    .join("")

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receiving Report ${escapeHtml(payload.reportNumber)}</title>
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
            margin-left: auto;
            margin-top: 10px;
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
          .notes {
            border: 1px solid #000;
            padding: 6px;
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
          <p>MATERIAL REQUEST RECEIVING REPORT</p>
          <p>Report #: ${escapeHtml(payload.reportNumber)} | Request #: ${escapeHtml(payload.requestNumber)}</p>
        </div>

        <table class="meta">
          <tr>
            <td><span class="label">Requester</span><span class="value">${escapeHtml(payload.requesterName)}</span></td>
            <td><span class="label">Employee No.</span><span class="value">${escapeHtml(payload.requesterEmployeeNumber)}</span></td>
            <td><span class="label">Department</span><span class="value">${escapeHtml(payload.departmentName)}</span></td>
            <td><span class="label">Received At</span><span class="value">${escapeHtml(payload.receivedAtLabel)}</span></td>
          </tr>
          <tr>
            <td><span class="label">Prepared / Required</span><span class="value">${escapeHtml(payload.datePreparedLabel)} / ${escapeHtml(payload.dateRequiredLabel)}</span></td>
            <td><span class="label">Processed Complete</span><span class="value">${escapeHtml(payload.processingCompletedAtLabel ?? "-")}</span></td>
            <td><span class="label">Acknowledged At</span><span class="value">${escapeHtml(payload.requesterAcknowledgedAtLabel ?? "-")}</span></td>
            <td><span class="label">Received By</span><span class="value">${escapeHtml(payload.receivedByName)}</span></td>
          </tr>
          <tr>
            <td><span class="label">Posting Status</span><span class="value">${escapeHtml(payload.postingStatus.replaceAll("_", " "))}</span></td>
            <td><span class="label">Posting Ref</span><span class="value">${escapeHtml(payload.postingReference ?? "-")}</span></td>
            <td><span class="label">Posted At</span><span class="value">${escapeHtml(payload.postedAtLabel ?? "-")}</span></td>
            <td><span class="label">Posted By</span><span class="value">${escapeHtml(payload.postedByName ?? "-")}</span></td>
          </tr>
        </table>

        <div class="section-title">Received Items</div>
        <table class="grid">
          <thead>
            <tr>
              <th style="width:6%">Line</th>
              <th style="width:10%">Code</th>
              <th style="width:24%">Description</th>
              <th style="width:8%">UOM</th>
              <th style="width:8%">Requested</th>
              <th style="width:8%">Received</th>
              <th style="width:11%">Unit Price</th>
              <th style="width:11%">Line Total</th>
              <th style="width:14%">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <table class="totals">
          <tr><td>Sub Total</td><td>PHP ${formatMoney(payload.subTotal)}</td></tr>
          <tr><td>Freight</td><td>PHP ${formatMoney(payload.freight)}</td></tr>
          <tr><td>Discount</td><td>PHP ${formatMoney(payload.discount)}</td></tr>
          <tr><td>Grand Total</td><td>PHP ${formatMoney(payload.grandTotal)}</td></tr>
        </table>

        ${
          payload.remarks
            ? `
              <div class="section-title">Receiving Notes</div>
              <div class="notes">${escapeHtml(payload.remarks)}</div>
            `
            : ""
        }

        <div class="footer">Printed on ${escapeHtml(printedDate)} ${escapeHtml(printedTime)} (Asia/Manila)</div>
      </body>
    </html>
  `
}

export const openMaterialRequestReceivingReportPrintWindow = (
  payload: MaterialRequestReceivingReportPrintPayload
): void => {
  const printWindow = window.open("about:blank", "_blank")
  if (!printWindow) {
    return
  }

  const html = buildMaterialRequestReceivingReportPrintHtml(payload)
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()

  printWindow.focus()
  printWindow.print()
}

export function MaterialRequestReceivingReportPrintButton({
  payload,
  className,
}: MaterialRequestReceivingReportPrintButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={() => openMaterialRequestReceivingReportPrintWindow(payload)}
    >
      <IconPrinter className="mr-1 h-4 w-4" />
      Print Receiving Report
    </Button>
  )
}
