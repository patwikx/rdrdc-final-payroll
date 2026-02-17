import type { SeparationAttritionDetailRow } from "@/modules/reports/hr/utils/get-separation-attrition-detail-view-model"

export type SeparationAttritionDetailPrintPayload = {
  companyName: string
  generatedAtLabel: string
  startDate: string
  endDate: string
  departmentLabel: string
  includeInactive: boolean
  attritionScopeLabel: string
  activeHeadcount: number
  attritionRate: number
  rows: SeparationAttritionDetailRow[]
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const decimalFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const buildSeparationAttritionDetailPrintHtml = (payload: SeparationAttritionDetailPrintPayload): string => {
  const rowsMarkup =
    payload.rows.length === 0
      ? `<tr><td colspan="11" class="text-center">No separated employee rows found for the selected filters.</td></tr>`
      : payload.rows
          .map((row) => {
            return `
              <tr>
                <td class="text-left">${escapeHtml(row.employeeName)}<br /><span class="muted">${escapeHtml(row.employeeNumber)}</span></td>
                <td class="text-left">${escapeHtml(row.departmentName ?? "UNASSIGNED")}</td>
                <td class="text-center">${row.isActive ? "ACTIVE" : "INACTIVE"}</td>
                <td class="text-left">${escapeHtml(row.hireDateValue)}</td>
                <td class="text-left">${escapeHtml(row.separationDateValue)}</td>
                <td class="text-left">${escapeHtml(row.lastWorkingDayValue ?? "-")}</td>
                <td class="text-left">${escapeHtml(row.separationReasonLabel)}</td>
                <td class="text-left">${escapeHtml(row.attritionType)}</td>
                <td>${escapeHtml(String(row.tenureMonths))}</td>
                <td class="text-left">${escapeHtml(row.tenureLabel)}</td>
                <td>${escapeHtml(String(row.serviceDays))}</td>
              </tr>
            `
          })
          .join("")

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Separation and Attrition Detail Report</title>
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
      <p>SEPARATION AND ATTRITION DETAIL REPORT</p>
      <p>PERIOD: ${escapeHtml(payload.startDate)} TO ${escapeHtml(payload.endDate)}</p>
      <p>DEPARTMENT: ${escapeHtml(payload.departmentLabel)} | INACTIVE INCLUDED: ${payload.includeInactive ? "YES" : "NO"} | SCOPE: ${escapeHtml(payload.attritionScopeLabel)}</p>
      <p>ACTIVE HEADCOUNT: ${escapeHtml(String(payload.activeHeadcount))} | ATTRITION RATE: ${escapeHtml(decimalFormatter.format(payload.attritionRate))}%</p>
      <p>GENERATED: ${escapeHtml(payload.generatedAtLabel)} | TOTAL RECORDS: ${escapeHtml(String(payload.rows.length))}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Department</th>
          <th>Status</th>
          <th>Hire Date</th>
          <th>Separation Date</th>
          <th>Last Working Day</th>
          <th>Reason</th>
          <th>Attrition Type</th>
          <th>Tenure (Months)</th>
          <th>Tenure Label</th>
          <th>Service Days</th>
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
