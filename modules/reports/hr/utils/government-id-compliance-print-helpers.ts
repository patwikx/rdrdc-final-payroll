import type { GovernmentIdComplianceRow } from "@/modules/reports/hr/utils/get-government-id-compliance-view-model"

export type GovernmentIdCompliancePrintPayload = {
  companyName: string
  generatedAtLabel: string
  asOfDateValue: string
  departmentLabel: string
  includeInactive: boolean
  complianceScopeLabel: string
  rows: GovernmentIdComplianceRow[]
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

const formatIdCell = (status: string, value: string | null): string => {
  const normalized = value && value.trim().length > 0 ? value : "-"
  return `${status} | ${normalized}`
}

export const buildGovernmentIdCompliancePrintHtml = (payload: GovernmentIdCompliancePrintPayload): string => {
  const rowsMarkup =
    payload.rows.length === 0
      ? `<tr><td colspan="10" class="text-center">No employee rows found for the selected filters.</td></tr>`
      : payload.rows
          .map((row) => {
            return `
              <tr>
                <td class="text-left">${escapeHtml(row.employeeName)}<br /><span class="muted">${escapeHtml(row.employeeNumber)}</span></td>
                <td class="text-left">${escapeHtml(row.departmentName ?? "UNASSIGNED")}</td>
                <td class="text-center">${row.isActive ? "ACTIVE" : "INACTIVE"}</td>
                <td class="text-left">${escapeHtml(formatIdCell(row.tinStatus, row.tinValue))}</td>
                <td class="text-left">${escapeHtml(formatIdCell(row.sssStatus, row.sssValue))}</td>
                <td class="text-left">${escapeHtml(formatIdCell(row.philHealthStatus, row.philHealthValue))}</td>
                <td class="text-left">${escapeHtml(formatIdCell(row.pagIbigStatus, row.pagIbigValue))}</td>
                <td>${escapeHtml(`${decimalFormatter.format(row.completionRate)}%`)}</td>
                <td class="text-left">${escapeHtml(row.missingIdLabels.join(", ") || "-")}</td>
                <td class="text-left">${escapeHtml(row.qualityIssueLabels.join(", ") || "-")}</td>
              </tr>
            `
          })
          .join("")

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Government ID Compliance Report</title>
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
      <p>GOVERNMENT ID COMPLIANCE REPORT</p>
      <p>AS OF: ${escapeHtml(payload.asOfDateValue)} | DEPARTMENT: ${escapeHtml(payload.departmentLabel)} | INACTIVE INCLUDED: ${payload.includeInactive ? "YES" : "NO"}</p>
      <p>SCOPE: ${escapeHtml(payload.complianceScopeLabel)} | GENERATED: ${escapeHtml(payload.generatedAtLabel)}</p>
      <p>TOTAL RECORDS: ${escapeHtml(String(payload.rows.length))}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Department</th>
          <th>Status</th>
          <th>TIN</th>
          <th>SSS</th>
          <th>PhilHealth</th>
          <th>Pag-IBIG</th>
          <th>Completion</th>
          <th>Missing Required IDs</th>
          <th>Quality Issues</th>
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
