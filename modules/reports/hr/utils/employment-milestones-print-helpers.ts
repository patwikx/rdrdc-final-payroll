import type { EmploymentMilestonesRow } from "@/modules/reports/hr/utils/get-employment-milestones-view-model"

export type EmploymentMilestonesPrintPayload = {
  companyName: string
  generatedAtLabel: string
  asOfDateValue: string
  departmentLabel: string
  includeInactive: boolean
  milestoneScopeLabel: string
  rows: EmploymentMilestonesRow[]
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

export const buildEmploymentMilestonesPrintHtml = (payload: EmploymentMilestonesPrintPayload): string => {
  const rowsMarkup =
    payload.rows.length === 0
      ? `<tr><td colspan="12" class="text-center">No employee rows found for the selected filters.</td></tr>`
      : payload.rows
          .map((row) => {
            return `
              <tr>
                <td class="text-left">${escapeHtml(row.employeeName)}<br /><span class="muted">${escapeHtml(row.employeeNumber)}</span></td>
                <td class="text-left">${escapeHtml(row.departmentName ?? "UNASSIGNED")}</td>
                <td class="text-center">${row.isActive ? "ACTIVE" : "INACTIVE"}</td>
                <td class="text-left">${escapeHtml(row.hireDateValue)}</td>
                <td class="text-left">${escapeHtml(row.probationEndDateValue ?? "-")}</td>
                <td class="text-left">${escapeHtml(row.regularizationDateValue ?? "-")}</td>
                <td class="text-left">${escapeHtml(row.contractEndDateValue ?? "-")}</td>
                <td class="text-left">${escapeHtml(row.separationDateValue ?? "-")}</td>
                <td class="text-left">${escapeHtml(row.lastWorkingDayValue ?? "-")}</td>
                <td class="text-left">${escapeHtml(
                  row.nextMilestoneLabel && row.nextMilestoneDateValue
                    ? `${row.nextMilestoneLabel} (${row.nextMilestoneDateValue})`
                    : "-"
                )}</td>
                <td>${escapeHtml(row.daysToNextMilestone === null ? "-" : String(row.daysToNextMilestone))}</td>
                <td class="text-left">${escapeHtml(row.overdueMilestonesLabel)}</td>
              </tr>
            `
          })
          .join("")

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Employment Milestones Report</title>
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
      <p>EMPLOYMENT MILESTONES REPORT</p>
      <p>AS OF: ${escapeHtml(payload.asOfDateValue)} | DEPARTMENT: ${escapeHtml(payload.departmentLabel)} | INACTIVE INCLUDED: ${payload.includeInactive ? "YES" : "NO"}</p>
      <p>SCOPE: ${escapeHtml(payload.milestoneScopeLabel)} | GENERATED: ${escapeHtml(payload.generatedAtLabel)}</p>
      <p>TOTAL RECORDS: ${escapeHtml(String(payload.rows.length))}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Department</th>
          <th>Status</th>
          <th>Hire Date</th>
          <th>Probation End</th>
          <th>Regularization</th>
          <th>Contract End</th>
          <th>Separation Date</th>
          <th>Last Working Day</th>
          <th>Next Milestone</th>
          <th>Days to Next</th>
          <th>Overdue Milestones</th>
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
