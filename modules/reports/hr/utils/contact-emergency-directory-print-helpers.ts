import type { ContactEmergencyDirectoryRow } from "@/modules/reports/hr/utils/get-contact-emergency-directory-view-model"

export type ContactEmergencyDirectoryPrintPayload = {
  companyName: string
  generatedAtLabel: string
  departmentLabel: string
  includeInactive: boolean
  directoryScopeLabel: string
  rows: ContactEmergencyDirectoryRow[]
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

export const buildContactEmergencyDirectoryPrintHtml = (payload: ContactEmergencyDirectoryPrintPayload): string => {
  const rowsMarkup =
    payload.rows.length === 0
      ? `<tr><td colspan="8" class="text-center">No employee rows found for the selected filters.</td></tr>`
      : payload.rows
          .map((row) => {
            return `
              <tr>
                <td class="text-left">${escapeHtml(row.employeeName)}<br /><span class="muted">${escapeHtml(row.employeeNumber)}</span></td>
                <td class="text-left">${escapeHtml(row.departmentName ?? "UNASSIGNED")}</td>
                <td class="text-center">${row.isActive ? "ACTIVE" : "INACTIVE"}</td>
                <td class="text-left">${escapeHtml(row.primaryContactNumber ?? "N/A")}<br /><span class="muted">${escapeHtml(row.allContactNumbersLabel.replace(/\n/g, " | "))}</span></td>
                <td class="text-left">${escapeHtml(row.primaryEmail ?? "N/A")}<br /><span class="muted">${escapeHtml(row.allEmailsLabel.replace(/\n/g, " | "))}</span></td>
                <td class="text-left">${escapeHtml(row.primaryEmergencyContactName ?? "N/A")}<br /><span class="muted">${escapeHtml(row.primaryEmergencyRelationship ?? "N/A")}</span></td>
                <td class="text-left">${escapeHtml(row.primaryEmergencyContactNumber ?? "N/A")}<br /><span class="muted">${escapeHtml(row.allEmergencyContactsLabel.replace(/\n/g, " | "))}</span></td>
                <td class="text-left">${escapeHtml(row.missingFlags.join(", ") || "-")}</td>
              </tr>
            `
          })
          .join("")

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Contact and Emergency Directory Report</title>
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
      <p>CONTACT AND EMERGENCY DIRECTORY REPORT</p>
      <p>DEPARTMENT: ${escapeHtml(payload.departmentLabel)} | INACTIVE INCLUDED: ${payload.includeInactive ? "YES" : "NO"}</p>
      <p>SCOPE: ${escapeHtml(payload.directoryScopeLabel)} | GENERATED: ${escapeHtml(payload.generatedAtLabel)}</p>
      <p>TOTAL RECORDS: ${escapeHtml(String(payload.rows.length))}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Department</th>
          <th>Status</th>
          <th>Contact Number(s)</th>
          <th>Email(s)</th>
          <th>Emergency Contact</th>
          <th>Emergency Number(s)</th>
          <th>Missing Fields</th>
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
