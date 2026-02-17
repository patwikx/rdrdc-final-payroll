import type { DemographicEmployeeRow } from "@/modules/reports/payroll/types/report-view-models"

export type DemographicPrintColumnKey =
  | "employee"
  | "department"
  | "branch"
  | "gender"
  | "civilStatus"
  | "employmentStatus"
  | "hireDate"
  | "age"
  | "address"
  | "contactNumbers"
  | "emergencyContact"
  | "emergencyContactNumber"
  | "education"

type DemographicPrintColumn = {
  key: DemographicPrintColumnKey
  label: string
  resolveText: (row: DemographicEmployeeRow) => string
}

export const DEMOGRAPHIC_PRINT_COLUMNS: DemographicPrintColumn[] = [
  {
    key: "employee",
    label: "Employee",
    resolveText: (row) => `${row.employeeName}\n${row.employeeNumber}`,
  },
  {
    key: "department",
    label: "Department",
    resolveText: (row) => row.departmentName ?? "UNASSIGNED",
  },
  {
    key: "branch",
    label: "Branch",
    resolveText: (row) => row.branchName ?? "UNASSIGNED",
  },
  {
    key: "gender",
    label: "Gender",
    resolveText: (row) => row.genderLabel,
  },
  {
    key: "civilStatus",
    label: "Civil Status",
    resolveText: (row) => row.civilStatusLabel,
  },
  {
    key: "employmentStatus",
    label: "Employment Status",
    resolveText: (row) => row.employmentStatusName,
  },
  {
    key: "hireDate",
    label: "Hire Date",
    resolveText: (row) => row.hireDateValue,
  },
  {
    key: "age",
    label: "Age",
    resolveText: (row) => (row.ageYears === null ? "-" : String(row.ageYears)),
  },
  {
    key: "address",
    label: "Address",
    resolveText: (row) => row.addressLabel,
  },
  {
    key: "contactNumbers",
    label: "Contact Number(s)",
    resolveText: (row) => row.contactNumbersLabel,
  },
  {
    key: "emergencyContact",
    label: "Emergency Contact",
    resolveText: (row) => row.emergencyContactName,
  },
  {
    key: "emergencyContactNumber",
    label: "Emergency Contact Number",
    resolveText: (row) => row.emergencyContactNumber,
  },
  {
    key: "education",
    label: "Education",
    resolveText: (row) => row.educationLabel,
  },
]

export type DemographicReportPrintPayload = {
  companyName: string
  asOfDateValue: string
  generatedAtLabel: string
  includeInactive: boolean
  departmentLabel: string
  totalEmployees: number
  activeEmployees: number
  inactiveEmployees: number
  averageAgeYears: number | null
  columns: DemographicPrintColumnKey[]
  employees: DemographicEmployeeRow[]
}

const countFormatter = new Intl.NumberFormat("en-PH")
const decimalFormatter = new Intl.NumberFormat("en-PH", {
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

const formatCellText = (value: string): string => {
  return escapeHtml(value).replaceAll("\n", "<br />")
}

export const resolveDemographicPrintColumns = (columns: DemographicPrintColumnKey[]): DemographicPrintColumn[] => {
  const allowedKeys = new Set(columns)
  const selectedColumns = DEMOGRAPHIC_PRINT_COLUMNS.filter((column) => allowedKeys.has(column.key))
  if (selectedColumns.length > 0) return selectedColumns
  return DEMOGRAPHIC_PRINT_COLUMNS
}

export const buildDemographicReportPrintHtml = (payload: DemographicReportPrintPayload): string => {
  const selectedColumns = resolveDemographicPrintColumns(payload.columns)
  const columnHeaders = selectedColumns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("")

  const rowMarkup =
    payload.employees.length === 0
      ? `<tr class="employee-row"><td colspan="${selectedColumns.length}" class="text-center">No employee records found for the selected filters.</td></tr>`
      : payload.employees
          .map((employee) => {
            const cells = selectedColumns
              .map((column) => {
                const alignClass = column.key === "age" ? "text-right" : "text-left"
                return `<td class="${alignClass}">${formatCellText(column.resolveText(employee))}</td>`
              })
              .join("")

            return `<tr class="employee-row">${cells}</tr>`
          })
          .join("")

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Demographic Report</title>
    <style>
      :root { color-scheme: light; }
      @page { size: A4 landscape; margin: 4mm; }
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
        padding-top: 0;
      }
      .header {
        text-align: center;
        margin-bottom: 12px;
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
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        table-layout: fixed;
        font-size: 6.8pt;
        border: 1px solid #000;
      }
      th, td {
        border: 0;
        border-right: 1px solid #000;
        border-bottom: 1px solid #000;
        padding: 2px 3px;
        text-align: right;
        vertical-align: top;
        word-break: break-word;
        white-space: normal;
        line-height: 1.2;
      }
      tr > :first-child {
        border-left: 1px solid #000;
      }
      thead tr:first-child > * {
        border-top: 1px solid #000;
      }
      tbody .employee-row {
        page-break-inside: avoid;
      }
      th {
        text-align: center;
        font-weight: 700;
      }
      .text-right {
        text-align: right;
      }
      .text-left {
        text-align: left !important;
      }
      .text-center {
        text-align: center !important;
      }
    </style>
  </head>
  <body>
    <article class="doc">
      <header class="header">
        <h1>${escapeHtml(payload.companyName)}</h1>
        <p>DEMOGRAPHIC REPORT</p>
        <p>AS OF: ${escapeHtml(payload.asOfDateValue)}</p>
        <p>GENERATED: ${escapeHtml(payload.generatedAtLabel)}</p>
        <p>DEPARTMENT: ${escapeHtml(payload.departmentLabel)} | INCLUDE INACTIVE: ${payload.includeInactive ? "YES" : "NO"} | VISIBLE COLUMNS: ${escapeHtml(String(selectedColumns.length))}</p>
        <p>TOTAL: ${escapeHtml(countFormatter.format(payload.totalEmployees))} | ACTIVE: ${escapeHtml(countFormatter.format(payload.activeEmployees))} | INACTIVE: ${escapeHtml(countFormatter.format(payload.inactiveEmployees))} | AVG AGE: ${payload.averageAgeYears === null ? "-" : escapeHtml(decimalFormatter.format(payload.averageAgeYears))}</p>
      </header>

      <table>
        <thead>
          <tr>
            ${columnHeaders}
          </tr>
        </thead>
        <tbody>
          ${rowMarkup}
        </tbody>
      </table>
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
