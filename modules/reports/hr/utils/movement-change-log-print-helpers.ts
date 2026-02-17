import type { MovementChangeLogRow } from "@/modules/reports/hr/utils/get-movement-change-log-view-model"

export type MovementChangeLogPrintPayload = {
  companyName: string
  generatedAtLabel: string
  startDate: string
  endDate: string
  departmentLabel: string
  includeInactive: boolean
  movementCategoryLabel: string
  rows: MovementChangeLogRow[]
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

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

export const buildMovementChangeLogPrintHtml = (payload: MovementChangeLogPrintPayload): string => {
  const rowsMarkup =
    payload.rows.length === 0
      ? `<tr><td colspan="10" class="text-center">No movement rows found for the selected filters.</td></tr>`
      : payload.rows
          .map((row) => {
            return `
              <tr>
                <td class="text-left">${escapeHtml(row.effectiveDateValue)}</td>
                <td class="text-left">${escapeHtml(row.employeeName)}<br /><span class="muted">${escapeHtml(row.employeeNumber)}</span></td>
                <td class="text-left">${escapeHtml(row.departmentName ?? "UNASSIGNED")}</td>
                <td class="text-left">${escapeHtml(row.category)}</td>
                <td class="text-left">${escapeHtml(row.movementLabel)}</td>
                <td class="text-left">${escapeHtml(row.previousValue)}</td>
                <td class="text-left">${escapeHtml(row.newValue)}</td>
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
    <title>Movement and Change Log Report</title>
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
      <p>MOVEMENT AND CHANGE LOG REPORT</p>
      <p>PERIOD: ${escapeHtml(payload.startDate)} TO ${escapeHtml(payload.endDate)}</p>
      <p>DEPARTMENT: ${escapeHtml(payload.departmentLabel)} | INACTIVE INCLUDED: ${payload.includeInactive ? "YES" : "NO"}</p>
      <p>CATEGORY: ${escapeHtml(payload.movementCategoryLabel)} | GENERATED: ${escapeHtml(payload.generatedAtLabel)}</p>
      <p>TOTAL RECORDS: ${escapeHtml(String(payload.rows.length))}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Effective Date</th>
          <th>Employee</th>
          <th>Department</th>
          <th>Category</th>
          <th>Movement</th>
          <th>Previous Value</th>
          <th>New Value</th>
          <th>Reason</th>
          <th>Remarks</th>
          <th>Logged At</th>
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
