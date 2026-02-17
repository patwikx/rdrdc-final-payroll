import type { TrainingCertificationComplianceRow } from "@/modules/reports/hr/utils/get-training-certification-compliance-view-model"

export type TrainingCertificationCompliancePrintPayload = {
  companyName: string
  generatedAtLabel: string
  asOfDateValue: string
  departmentLabel: string
  includeInactive: boolean
  complianceScopeLabel: string
  rows: TrainingCertificationComplianceRow[]
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

export const buildTrainingCertificationCompliancePrintHtml = (
  payload: TrainingCertificationCompliancePrintPayload
): string => {
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
                <td class="text-left">${escapeHtml(row.complianceStatus)}</td>
                <td>${escapeHtml(String(row.trainingCount))}</td>
                <td>${escapeHtml(String(row.certificationCount))}</td>
                <td>${escapeHtml(String(row.licenseCount))}</td>
                <td class="text-left">${escapeHtml(row.latestTrainingDateValue ?? "-")}</td>
                <td class="text-left">${escapeHtml(row.latestCredentialExpiryDateValue ?? "-")}</td>
                <td>${escapeHtml(String(row.expiredCredentialsCount))}</td>
                <td>${escapeHtml(String(row.expiringSoonCredentialsCount))}</td>
                <td class="text-left">${escapeHtml(row.complianceNotes)}</td>
              </tr>
            `
          })
          .join("")

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Training and Certification Compliance Report</title>
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
      <p>TRAINING AND CERTIFICATION COMPLIANCE REPORT</p>
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
          <th>Compliance</th>
          <th>Trainings</th>
          <th>Certifications</th>
          <th>Licenses</th>
          <th>Latest Training</th>
          <th>Latest Credential Expiry</th>
          <th>Expired</th>
          <th>Expiring 30 Days</th>
          <th>Notes</th>
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
