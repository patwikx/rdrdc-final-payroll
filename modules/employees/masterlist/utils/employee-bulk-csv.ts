export const EMPLOYEE_BULK_UPDATE_CLEAR_TOKEN = "__CLEAR__"

export const EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS = [
  "employeeNumber",
  "firstName",
  "lastName",
  "middleName",
  "suffix",
  "maidenName",
  "nickname",
  "birthDate",
  "birthPlace",
  "nationality",
  "citizenship",
  "gender",
  "civilStatus",
  "religion",
  "bloodType",
  "heightCm",
  "weightKg",
  "mobileNumber",
  "personalEmail",
  "biometricId",
  "rfidNumber",
  "hireDate",
  "applicationDate",
  "interviewDate",
  "jobOfferDate",
  "probationStartDate",
  "probationEndDate",
  "regularizationDate",
  "contractStartDate",
  "contractEndDate",
  "employmentStatus",
  "employmentType",
  "employmentClass",
  "department",
  "division",
  "position",
  "rank",
  "branch",
  "reportingManagerEmployeeNumber",
  "workSchedule",
  "payPeriodPattern",
  "taxStatus",
  "numberOfDependents",
  "previousEmployerIncome",
  "previousEmployerTaxWithheld",
  "monthlyRate",
  "monthlyDivisor",
  "hoursPerDay",
  "salaryGrade",
  "salaryBand",
  "minimumWageRegion",
  "wfhSchedule",
  "tinNumber",
  "sssNumber",
  "philHealthNumber",
  "pagIbigNumber",
  "umidNumber",
  "isSubstitutedFiling",
  "isOvertimeEligible",
  "isNightDiffEligible",
  "isAuthorizedSignatory",
  "isWfhEligible",
] as const

export type EmployeeBulkUpdateTemplateHeader = (typeof EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS)[number]
export const EMPLOYEE_BULK_UPDATE_REQUIRED_HEADERS: readonly EmployeeBulkUpdateTemplateHeader[] = ["employeeNumber"]

export type ParsedCsvRow = {
  lineNumber: number
  cells: string[]
}

export const normalizeBulkKey = (value: string): string => {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

export const normalizeBulkHeaderKey = (value: string): string => {
  return normalizeBulkKey(value)
    .replace(/\[required\]/g, "")
    .replace(/\(required\)/g, "")
    .replace(/\*/g, "")
    .trim()
}

export const isClearToken = (value: string): boolean => {
  return normalizeBulkKey(value) === normalizeBulkKey(EMPLOYEE_BULK_UPDATE_CLEAR_TOKEN)
}

export const isCsvRowBlank = (cells: string[]): boolean => {
  return cells.every((cell) => cell.trim().length === 0)
}

export const csvEscape = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export const buildEmployeeBulkTemplateCsv = (
  rows: Array<Partial<Record<EmployeeBulkUpdateTemplateHeader, string>>>,
  options?: {
    requiredHeaders?: readonly EmployeeBulkUpdateTemplateHeader[]
  }
): string => {
  const requiredHeaders = new Set(options?.requiredHeaders ?? [])
  const headerLine = EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS.map((header) =>
    csvEscape(requiredHeaders.has(header) ? `${header} *` : header)
  ).join(",")
  const bodyLines = rows.map((row) =>
    EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS.map((header) => csvEscape(row[header] ?? "")).join(",")
  )

  return [headerLine, ...bodyLines].join("\n")
}

export const parseCsvRows = (rawContent: string): ParsedCsvRow[] => {
  const content = rawContent.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  const rows: ParsedCsvRow[] = []
  let currentRow: string[] = []
  let currentCell = ""
  let inQuotes = false
  let currentLineNumber = 1
  let rowStartLineNumber = 1

  const pushCell = () => {
    currentRow.push(currentCell)
    currentCell = ""
  }

  const pushRow = () => {
    rows.push({
      lineNumber: rowStartLineNumber,
      cells: currentRow,
    })
    currentRow = []
  }

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]

    if (char === '"') {
      const nextChar = content[index + 1]

      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        index += 1
        continue
      }

      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      pushCell()
      continue
    }

    if (char === "\n" && !inQuotes) {
      pushCell()
      pushRow()
      currentLineNumber += 1
      rowStartLineNumber = currentLineNumber
      continue
    }

    if (char === "\n") {
      currentLineNumber += 1
    }

    currentCell += char
  }

  if (inQuotes) {
    throw new Error("Invalid CSV format: Unterminated quoted field.")
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    pushCell()
    pushRow()
  }

  return rows
}
