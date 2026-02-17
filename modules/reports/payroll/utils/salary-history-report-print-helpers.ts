import type { SalaryHistoryReportRow } from "@/modules/reports/payroll/types/report-view-models"

export type SalaryHistoryReportPrintPayload = {
  companyName: string
  generatedAtLabel: string
  startDate: string
  endDate: string
  employeeLabel: string
  departmentLabel: string
  rows: SalaryHistoryReportRow[]
}

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const toCurrencyLabel = (value: number | null): string => {
  if (value === null) return "-"
  return `PHP ${currencyFormatter.format(value)}`
}

const toAdjustmentType = (value: string | null): string => {
  if (!value) return "-"
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const toDateTimeLabel = (value: string): string => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

export const buildSalaryHistoryReportPrintHtml = (payload: SalaryHistoryReportPrintPayload): string => {
  const rowsMarkup =
    payload.rows.length === 0
      ? `<tr><td colspan="10" class="text-center">No salary history records found for the selected filters.</td></tr>`
      : payload.rows
          .map((row) => {
            return `
              <tr>
                <td class="text-left">${escapeHtml(row.employeeName)}<br /><span class="muted">${escapeHtml(row.employeeNumber)}</span></td>
                <td class="text-left">${escapeHtml(row.departmentName ?? "UNASSIGNED")}</td>
                <td class="text-left">${escapeHtml(row.effectiveDateValue)}</td>
                <td>${escapeHtml(toCurrencyLabel(row.previousSalaryAmount))}</td>
                <td>${escapeHtml(toCurrencyLabel(row.newSalaryAmount))}</td>
                <td>${escapeHtml(toCurrencyLabel(row.deltaAmount))}</td>
                <td class="text-left">${escapeHtml(toAdjustmentType(row.adjustmentTypeCode))}</td>
                <td class="text-left">${escapeHtml(row.reason ?? "-")}</td>
                <td class="text-left">${escapeHtml(row.remarks ?? "-")}</td>
                <td class="text-left">${escapeHtml(toDateTimeLabel(row.createdAtIso))}</td>
              </tr>
            `
          })
          .join("")

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Salary History Report</title>
    <style>
      :root { color-scheme: light; }
      @page { size: A4 landscape; margin: 6mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 7pt; color: #000; margin: 8mm; }
      .header { text-align: center; margin-bottom: 10px; }
      .header h1 { margin: 0; font-size: 11pt; }
      .header p { margin: 2px 0; font-size: 8pt; }
      table { width: 100%; border-collapse: collapse; font-size: 6.8pt; }
      th, td { border: 1px solid #000; padding: 2px 3px; text-align: right; vertical-align: top; word-break: break-word; }
      th { text-align: center; font-weight: 700; }
      .text-left { text-align: left !important; }
      .text-center { text-align: center !important; }
      .muted { color: #4b5563; font-size: 6.4pt; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>${escapeHtml(payload.companyName)}</h1>
      <p>SALARY HISTORY REPORT</p>
      <p>PERIOD: ${escapeHtml(payload.startDate)} TO ${escapeHtml(payload.endDate)}</p>
      <p>EMPLOYEE: ${escapeHtml(payload.employeeLabel)} | DEPARTMENT: ${escapeHtml(payload.departmentLabel)}</p>
      <p>GENERATED: ${escapeHtml(payload.generatedAtLabel)} | TOTAL RECORDS: ${escapeHtml(String(payload.rows.length))}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Department</th>
          <th>Effective Date</th>
          <th>Previous Salary</th>
          <th>New Salary</th>
          <th>Delta</th>
          <th>Adjustment Type</th>
          <th>Reason</th>
          <th>Remarks</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${rowsMarkup}
      </tbody>
    </table>
    <script>
      window.addEventListener("load", () => {
        window.print()
      })
    </script>
  </body>
</html>
`
}
