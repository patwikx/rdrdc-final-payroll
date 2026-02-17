import type {
  LateOvertimeReportSectionKey,
  LateOvertimeTopDepartmentRow,
  LateOvertimeTopEmployeeRow,
} from "@/modules/reports/payroll/types/report-view-models"

export type LateOvertimeReportPrintPayload = {
  companyName: string
  generatedAtLabel: string
  periodLabel: string
  topN: number
  section?: LateOvertimeReportSectionKey
  totalLateMins: number
  totalOvertimeHours: number
  totalOvertimePayAmount: number
  totalTardinessDeductionAmount: number
  topEmployeesByLate: LateOvertimeTopEmployeeRow[]
  topEmployeesByOvertime: LateOvertimeTopEmployeeRow[]
  topDepartmentsByLate: LateOvertimeTopDepartmentRow[]
  topDepartmentsByOvertime: LateOvertimeTopDepartmentRow[]
}

const numberFormatter = new Intl.NumberFormat("en-PH", {
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

const toCurrencyLabel = (value: number): string => `PHP ${numberFormatter.format(value)}`
const toHoursLabel = (value: number): string => numberFormatter.format(value)
const toMinutesLabel = (value: number): string => value.toLocaleString("en-PH")

const toSectionTitle = (section: LateOvertimeReportSectionKey | undefined): string => {
  if (!section) return "All Sections"
  if (section === "employees-late") return "Top Employees by Late"
  if (section === "employees-overtime") return "Top Employees by Overtime"
  if (section === "departments-late") return "Top Departments by Late"
  return "Top Departments by Overtime"
}

const buildLateDateColumns = (
  rows: LateOvertimeTopEmployeeRow[]
): Array<{ dateValue: string; dateLabel: string }> => {
  const dateLabelByDateValue = new Map<string, string>()
  for (const row of rows) {
    const lateDailyBreakdown = Array.isArray(row.lateDailyBreakdown) ? row.lateDailyBreakdown : []
    for (const entry of lateDailyBreakdown) {
      if (dateLabelByDateValue.has(entry.dateValue)) continue
      dateLabelByDateValue.set(entry.dateValue, entry.dateLabel)
    }
  }

  return Array.from(dateLabelByDateValue.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateValue, dateLabel]) => ({ dateValue, dateLabel }))
}

const buildOvertimeDateColumns = (
  rows: LateOvertimeTopEmployeeRow[]
): Array<{ dateValue: string; dateLabel: string }> => {
  const dateLabelByDateValue = new Map<string, string>()
  for (const row of rows) {
    const overtimeDailyBreakdown = Array.isArray(row.overtimeDailyBreakdown) ? row.overtimeDailyBreakdown : []
    for (const entry of overtimeDailyBreakdown) {
      if (dateLabelByDateValue.has(entry.dateValue)) continue
      dateLabelByDateValue.set(entry.dateValue, entry.dateLabel)
    }
  }

  return Array.from(dateLabelByDateValue.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateValue, dateLabel]) => ({ dateValue, dateLabel }))
}

const buildLateEmployeeRowsMarkup = (
  rows: LateOvertimeTopEmployeeRow[],
  lateDateColumns: Array<{ dateValue: string; dateLabel: string }>
): string => {
  if (rows.length === 0) {
    return `<tr><td colspan="${escapeHtml(String(5 + lateDateColumns.length))}" class="text-center">No employee data found for the selected date range.</td></tr>`
  }

  return rows
    .map((row, index) => {
      const lateDailyBreakdown = Array.isArray(row.lateDailyBreakdown) ? row.lateDailyBreakdown : []
      const lateMinsByDate = new Map(lateDailyBreakdown.map((entry) => [entry.dateValue, entry.lateMins]))
      const perDayColumnsMarkup = lateDateColumns
        .map((column) => {
          const lateMins = lateMinsByDate.get(column.dateValue)
          return `<td class="text-right">${escapeHtml(lateMins && lateMins > 0 ? String(lateMins) : "-")}</td>`
        })
        .join("")

      return `
        <tr>
          <td class="text-center">${escapeHtml(String(index + 1))}</td>
          <td class="text-left">${escapeHtml(row.employeeName)}<br /><span class="muted">${escapeHtml(row.employeeNumber)}</span></td>
          <td class="text-left">${escapeHtml(row.departmentName ?? "UNASSIGNED")}</td>
          ${perDayColumnsMarkup}
          <td class="text-right">${escapeHtml(toMinutesLabel(row.lateMins))}</td>
          <td class="text-right">${escapeHtml(toCurrencyLabel(row.tardinessDeductionAmount))}</td>
        </tr>
      `
    })
    .join("")
}

const buildOvertimeEmployeeRowsMarkup = (
  rows: LateOvertimeTopEmployeeRow[],
  overtimeDateColumns: Array<{ dateValue: string; dateLabel: string }>
): string => {
  if (rows.length === 0) {
    return `<tr><td colspan="${escapeHtml(String(5 + overtimeDateColumns.length))}" class="text-center">No employee data found for the selected date range.</td></tr>`
  }

  return rows
    .map((row, index) => {
      const overtimeDailyBreakdown = Array.isArray(row.overtimeDailyBreakdown) ? row.overtimeDailyBreakdown : []
      const overtimeHoursByDate = new Map(
        overtimeDailyBreakdown.map((entry) => [entry.dateValue, entry.overtimeHours])
      )
      const perDayColumnsMarkup = overtimeDateColumns
        .map((column) => {
          const overtimeHours = overtimeHoursByDate.get(column.dateValue)
          return `<td class="text-right">${escapeHtml(overtimeHours && overtimeHours > 0 ? toHoursLabel(overtimeHours) : "-")}</td>`
        })
        .join("")

      return `
        <tr>
          <td class="text-center">${escapeHtml(String(index + 1))}</td>
          <td class="text-left">${escapeHtml(row.employeeName)}<br /><span class="muted">${escapeHtml(row.employeeNumber)}</span></td>
          <td class="text-left">${escapeHtml(row.departmentName ?? "UNASSIGNED")}</td>
          ${perDayColumnsMarkup}
          <td class="text-right">${escapeHtml(toHoursLabel(row.overtimeHours))}</td>
          <td class="text-right">${escapeHtml(toCurrencyLabel(row.overtimePayAmount))}</td>
        </tr>
      `
    })
    .join("")
}

const buildDepartmentRowsMarkup = (rows: LateOvertimeTopDepartmentRow[], sortMode: "late" | "overtime"): string => {
  if (rows.length === 0) {
    return `<tr><td colspan="6" class="text-center">No department data found for the selected date range.</td></tr>`
  }

  return rows
    .map((row, index) => {
      if (sortMode === "late") {
        return `
          <tr>
            <td class="text-center">${escapeHtml(String(index + 1))}</td>
            <td class="text-left">${escapeHtml(row.departmentName)}</td>
            <td class="text-right">${escapeHtml(String(row.employeeCount))}</td>
            <td class="text-right">${escapeHtml(toMinutesLabel(row.lateMins))}</td>
            <td class="text-right">${escapeHtml(String(row.lateDays ?? 0))}</td>
            <td class="text-right">${escapeHtml(toCurrencyLabel(row.tardinessDeductionAmount))}</td>
          </tr>
        `
      }
      return `
        <tr>
          <td class="text-center">${escapeHtml(String(index + 1))}</td>
          <td class="text-left">${escapeHtml(row.departmentName)}</td>
          <td class="text-right">${escapeHtml(String(row.employeeCount))}</td>
          <td class="text-right">${escapeHtml(toHoursLabel(row.overtimeHours))}</td>
          <td class="text-right">${escapeHtml(String(row.overtimeDays ?? 0))}</td>
          <td class="text-right">${escapeHtml(toCurrencyLabel(row.overtimePayAmount))}</td>
        </tr>
      `
    })
    .join("")
}

export const buildLateOvertimeReportPrintHtml = (payload: LateOvertimeReportPrintPayload): string => {
  const lateDateColumns = buildLateDateColumns(payload.topEmployeesByLate)
  const overtimeDateColumns = buildOvertimeDateColumns(payload.topEmployeesByOvertime)
  const employeeLateRows = buildLateEmployeeRowsMarkup(payload.topEmployeesByLate, lateDateColumns)
  const employeeOvertimeRows = buildOvertimeEmployeeRowsMarkup(payload.topEmployeesByOvertime, overtimeDateColumns)
  const departmentLateRows = buildDepartmentRowsMarkup(payload.topDepartmentsByLate, "late")
  const departmentOvertimeRows = buildDepartmentRowsMarkup(payload.topDepartmentsByOvertime, "overtime")
  const lateDateHeaderCells = lateDateColumns
    .map(
      (column) =>
        `<th class="text-right" style="min-width:44px">${escapeHtml(column.dateLabel)}</th>`
    )
    .join("")
  const overtimeDateHeaderCells = overtimeDateColumns
    .map(
      (column) =>
        `<th class="text-right" style="min-width:44px">${escapeHtml(column.dateLabel)}</th>`
    )
    .join("")
  const sectionTitle = toSectionTitle(payload.section)
  const showEmployeeLate = !payload.section || payload.section === "employees-late"
  const showEmployeeOvertime = !payload.section || payload.section === "employees-overtime"
  const showDepartmentLate = !payload.section || payload.section === "departments-late"
  const showDepartmentOvertime = !payload.section || payload.section === "departments-overtime"

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Late and Overtime Report</title>
    <style>
      :root { color-scheme: light; }
      @page { size: A4 landscape; margin: 6mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #000;
        background: #fff;
        font-family: Arial, sans-serif;
        font-size: 7pt;
        line-height: 1.25;
      }
      .doc {
        width: 100%;
      }
      .header {
        text-align: center;
        margin-bottom: 10px;
      }
      .header h1 {
        margin: 0;
        font-size: 11pt;
        font-weight: 700;
      }
      .header p {
        margin: 2px 0;
        font-size: 8pt;
      }
      .summary-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 10px;
        font-size: 7pt;
      }
      .summary-table th,
      .summary-table td {
        border: 1px solid #000;
        padding: 4px 5px;
      }
      .summary-table th {
        text-align: left;
        background: #f3f4f6;
      }
      .section {
        margin-bottom: 10px;
      }
      .section-title {
        margin: 0 0 4px 0;
        font-size: 8pt;
        font-weight: 700;
      }
      table.report-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        font-size: 6.8pt;
      }
      .report-table th,
      .report-table td {
        border: 1px solid #000;
        padding: 2px 3px;
        vertical-align: top;
        word-break: break-word;
      }
      .report-table th {
        text-align: center;
        font-weight: 700;
        background: #f3f4f6;
      }
      .text-left { text-align: left !important; }
      .text-right { text-align: right !important; }
      .text-center { text-align: center !important; }
      .muted {
        color: #4b5563;
        font-size: 6.2pt;
      }
    </style>
  </head>
  <body>
    <article class="doc">
      <header class="header">
        <h1>${escapeHtml(payload.companyName)}</h1>
        <p>LATE AND OVERTIME REPORT</p>
        <p>DATE RANGE: ${escapeHtml(payload.periodLabel)}</p>
        <p>SECTION: ${escapeHtml(sectionTitle)}</p>
        <p>TOP RANKING: ${escapeHtml(String(payload.topN))}</p>
        <p>GENERATED: ${escapeHtml(payload.generatedAtLabel)}</p>
      </header>

      <table class="summary-table">
        <thead>
          <tr>
            <th>Total Late Minutes</th>
            <th>Total Overtime Hours</th>
            <th>Total Overtime Pay</th>
            <th>Total Late Deduction</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="text-right">${escapeHtml(toMinutesLabel(payload.totalLateMins))}</td>
            <td class="text-right">${escapeHtml(toHoursLabel(payload.totalOvertimeHours))}</td>
            <td class="text-right">${escapeHtml(toCurrencyLabel(payload.totalOvertimePayAmount))}</td>
            <td class="text-right">${escapeHtml(toCurrencyLabel(payload.totalTardinessDeductionAmount))}</td>
          </tr>
        </tbody>
      </table>

      ${showEmployeeLate ? `
      <section class="section">
        <h2 class="section-title">Top Employees by Late</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:5%">Rank</th>
              <th style="width:18%">Employee</th>
              <th style="width:13%">Department</th>
              ${lateDateHeaderCells}
              <th style="width:8%">Late Minutes</th>
              <th style="width:12%">Late Deduction</th>
            </tr>
          </thead>
          <tbody>${employeeLateRows}</tbody>
        </table>
      </section>
      ` : ""}

      ${showEmployeeOvertime ? `
      <section class="section">
        <h2 class="section-title">Top Employees by Overtime</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:5%">Rank</th>
              <th style="width:21%">Employee</th>
              <th style="width:14%">Department</th>
              ${overtimeDateHeaderCells}
              <th style="width:11%">OT Hours</th>
              <th style="width:15%">OT Pay</th>
            </tr>
          </thead>
          <tbody>${employeeOvertimeRows}</tbody>
        </table>
      </section>
      ` : ""}

      ${showDepartmentLate ? `
      <section class="section">
        <h2 class="section-title">Top Departments by Late</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:5%">Rank</th>
              <th style="width:29%">Department</th>
              <th style="width:11%">Headcount</th>
              <th style="width:15%">Late Minutes</th>
              <th style="width:12%">Late Days</th>
              <th style="width:28%">Late Deduction</th>
            </tr>
          </thead>
          <tbody>${departmentLateRows}</tbody>
        </table>
      </section>
      ` : ""}

      ${showDepartmentOvertime ? `
      <section class="section">
        <h2 class="section-title">Top Departments by Overtime</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:5%">Rank</th>
              <th style="width:29%">Department</th>
              <th style="width:11%">Headcount</th>
              <th style="width:15%">OT Hours</th>
              <th style="width:12%">OT Days</th>
              <th style="width:28%">OT Pay</th>
            </tr>
          </thead>
          <tbody>${departmentOvertimeRows}</tbody>
        </table>
      </section>
      ` : ""}
    </article>
    <script>
      window.addEventListener("load", () => {
        window.print()
      })
    </script>
  </body>
</html>
`
}
