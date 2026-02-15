"use client"

import { IconPrinter } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { toPhDateInputValue } from "@/lib/ph-time"

type MaterialRequestPrintItem = {
  lineNumber: number
  itemCode: string | null
  description: string
  uom: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
  remarks: string | null
}

type MaterialRequestPrintApprovalStep = {
  stepNumber: number
  stepName: string | null
  approverName: string
  status: string
  actedByName: string | null
  actedAtLabel: string | null
  remarks: string | null
}

export type MaterialRequestPrintPayload = {
  companyName: string
  requestNumber: string
  series: string
  requestType: string
  statusLabel?: string | null
  requesterName?: string | null
  requesterEmployeeNumber?: string | null
  departmentName: string
  datePreparedLabel: string
  dateRequiredLabel: string
  submittedAtLabel?: string | null
  approvedAtLabel?: string | null
  processingStartedAtLabel?: string | null
  processingCompletedAtLabel?: string | null
  processedByName?: string | null
  purpose?: string | null
  remarks?: string | null
  processingRemarks?: string | null
  finalDecisionRemarks?: string | null
  cancellationReason?: string | null
  subTotal: number
  freight: number
  discount: number
  grandTotal: number
  items: MaterialRequestPrintItem[]
  approvalSteps: MaterialRequestPrintApprovalStep[]
}

type MaterialRequestPrintButtonProps = {
  payload: MaterialRequestPrintPayload
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

const buildMaterialRequestPrintHtml = (payload: MaterialRequestPrintPayload): string => {
  const now = new Date()
  const printedDate = toPhDateInputValue(now)
  const printedTime = phTimeFormatter.format(now)

  const rows = payload.items
    .map((item) => {
      const code = escapeHtml(item.itemCode ?? "-")
      const description = escapeHtml(item.description)
      const uom = escapeHtml(item.uom)
      const remarks = escapeHtml(item.remarks ?? "-")

      return `
        <tr>
          <td>${item.lineNumber}</td>
          <td>${code}</td>
          <td class="left">${description}</td>
          <td>${uom}</td>
          <td class="right">${formatQty(item.quantity)}</td>
          <td class="right">${formatMoney(item.unitPrice ?? 0)}</td>
          <td class="right">${formatMoney(item.lineTotal ?? 0)}</td>
          <td class="left">${remarks}</td>
        </tr>
      `
    })
    .join("")

  const notes: string[] = []
  if (payload.purpose) notes.push(`<div><strong>Purpose:</strong> ${escapeHtml(payload.purpose)}</div>`)
  if (payload.remarks) notes.push(`<div><strong>Remarks:</strong> ${escapeHtml(payload.remarks)}</div>`)
  if (payload.processingRemarks) notes.push(`<div><strong>Processing Notes:</strong> ${escapeHtml(payload.processingRemarks)}</div>`)
  if (payload.finalDecisionRemarks) notes.push(`<div><strong>Decision Remarks:</strong> ${escapeHtml(payload.finalDecisionRemarks)}</div>`)
  if (payload.cancellationReason) notes.push(`<div><strong>Cancellation Reason:</strong> ${escapeHtml(payload.cancellationReason)}</div>`)

  const approvals = payload.approvalSteps
    .map((step) => {
      const remarks = escapeHtml(step.remarks ?? "-")
      const approverName = escapeHtml(step.approverName)
      const status = escapeHtml(step.status.replaceAll("_", " "))
      const stepLabel = escapeHtml(step.stepName?.trim() || `Step ${step.stepNumber}`)
      return `
        <div class="approval-card">
          <div class="approval-card-top">
            <span><strong>Stage:</strong> ${stepLabel}</span>
            <span><strong>Status:</strong> ${status}</span>
          </div>
          <div><strong>Assigned To:</strong> ${approverName}</div>
          <div><strong>Remarks:</strong> ${remarks}</div>
        </div>
      `
    })
    .join("")

  const statusLabel = escapeHtml(payload.statusLabel ?? "-")
  const requesterName = escapeHtml(payload.requesterName ?? "-")

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Material Request ${escapeHtml(payload.requestNumber)}</title>
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
          .notes > div + div {
            margin-top: 3px;
          }
          .footer {
            margin-top: 10px;
            font-size: 9px;
            text-align: right;
          }
          .approval-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
            font-size: 9px;
            line-height: 1.2;
            align-content: start;
          }
          .approval-card {
            border: 1px solid #000;
            padding: 4px 5px;
            break-inside: avoid;
          }
          .approval-card-top {
            display: flex;
            justify-content: space-between;
            gap: 6px;
          }
          .approval-card > div + div {
            margin-top: 1px;
          }
          @media print {
            .approval-grid {
              grid-template-columns: 1fr 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml(payload.companyName)}</h1>
          <p>MATERIAL REQUEST REQUISITION</p>
          <p>Request #: ${escapeHtml(payload.requestNumber)}</p>
        </div>

        <table class="meta">
          <tr>
            <td><span class="label">Requester</span><span class="value">${requesterName}</span></td>
            <td><span class="label">Department</span><span class="value">${escapeHtml(payload.departmentName)}</span></td>
            <td><span class="label">Date Prepared</span><span class="value">${escapeHtml(payload.datePreparedLabel)}</span></td>
            <td><span class="label">Date Required</span><span class="value">${escapeHtml(payload.dateRequiredLabel)}</span></td>
          </tr>
          <tr>
            <td><span class="label">Submitted At</span><span class="value">${escapeHtml(payload.submittedAtLabel ?? "-")}</span></td>
            <td><span class="label">Approved At</span><span class="value">${escapeHtml(payload.approvedAtLabel ?? "-")}</span></td>
            <td><span class="label">Request Status</span><span class="value">${statusLabel}</span></td>
            <td><span class="label">Processed By</span><span class="value">${escapeHtml(payload.processedByName ?? "-")}</span></td>
          </tr>
        </table>

        <div class="section-title">Requested Items</div>
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

        <table class="totals">
          <tr><td>Sub Total</td><td>PHP ${formatMoney(payload.subTotal)}</td></tr>
          <tr><td>Freight</td><td>PHP ${formatMoney(payload.freight)}</td></tr>
          <tr><td>Discount</td><td>PHP ${formatMoney(payload.discount)}</td></tr>
          <tr><td>Grand Total</td><td>PHP ${formatMoney(payload.grandTotal)}</td></tr>
        </table>

        ${
          notes.length > 0
            ? `
              <div class="section-title">Notes</div>
              <div class="notes">
                ${notes.join("")}
              </div>
            `
            : ""
        }

        ${
          approvals.length > 0
            ? `
              <div class="section-title">Approval Trail</div>
              <div class="approval-grid">
                ${approvals}
              </div>
            `
            : ""
        }

        <div class="footer">Printed on ${escapeHtml(printedDate)} ${escapeHtml(printedTime)} (Asia/Manila)</div>
      </body>
    </html>
  `
}

export const openMaterialRequestPrintWindow = (payload: MaterialRequestPrintPayload): void => {
  const printWindow = window.open("about:blank", "_blank")
  if (!printWindow) {
    return
  }

  printWindow.document.open()
  printWindow.document.write(buildMaterialRequestPrintHtml(payload))
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}

export function MaterialRequestPrintButton({ payload, className }: MaterialRequestPrintButtonProps) {
  const handlePrint = () => {
    openMaterialRequestPrintWindow(payload)
  }

  return (
    <Button type="button" className={className ?? "rounded-lg bg-blue-600 text-white hover:bg-blue-700"} onClick={handlePrint}>
      <IconPrinter className="mr-1 h-4 w-4" />
      Print
    </Button>
  )
}
