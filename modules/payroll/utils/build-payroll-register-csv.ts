import type { Prisma } from "@prisma/client"

type DecimalLike = Prisma.Decimal | number | null | undefined

const toNumber = (value: DecimalLike): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  return Number(value)
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100

const formatDateRange = (start: Date, end: Date): string => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  })
  return `${formatter.format(start)}-${formatter.format(end)}`
}

const csvEscape = (value: string): string => {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/\"/g, '""')}"`
  }
  return value
}

const toCurrencyText = (value: number): string => roundCurrency(value).toFixed(2)

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").trim().toUpperCase()

const toColumnCode = (value: string | null | undefined): string => {
  const normalized = normalizeText(value)
  if (!normalized) return "UNMAPPED"
  return normalized
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_") || "UNMAPPED"
}

type RegisterLineInput = {
  code: string
  name: string
  description: string
  amount: DecimalLike
}

export type PayrollRegisterDynamicColumn = {
  key: string
  code: string
  label: string
  category: "EARNING" | "DEDUCTION"
}

export type PayslipRegisterRow = {
  employeeNumber: string
  employeeName: string
  departmentName: string
  periodStart: Date
  periodEnd: Date
  basicPay: number
  grossPay: number
  sss: number
  philHealth: number
  pagIbig: number
  tax: number
  absent: number
  late: number
  undertime: number
  dynamicAmountsByKey: Record<string, number>
  dynamicEarningsTotal: number
  dynamicDeductionsTotal: number
  netPay: number
}

export type PayrollRegisterTotals = {
  basicPay: number
  grossPay: number
  sss: number
  philHealth: number
  pagIbig: number
  tax: number
  absent: number
  late: number
  undertime: number
  dynamicAmountsByKey: Record<string, number>
  dynamicEarningsTotal: number
  dynamicDeductionsTotal: number
  netPay: number
}

export type DepartmentGroup = {
  name: string
  employees: PayslipRegisterRow[]
  subtotal: PayrollRegisterTotals
}

export type PayrollRegisterReportData = {
  columns: PayrollRegisterDynamicColumn[]
  departments: DepartmentGroup[]
  grandTotal: PayrollRegisterTotals
  headcount: number
}

type RegisterInputRow = {
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  periodStart: Date
  periodEnd: Date
  basicPay: DecimalLike
  grossPay: DecimalLike
  sss: DecimalLike
  philHealth: DecimalLike
  pagIbig: DecimalLike
  tax: DecimalLike
  netPay: DecimalLike
  earnings: RegisterLineInput[]
  deductions: RegisterLineInput[]
}

type RegisterInput = {
  rows: RegisterInputRow[]
}

const CORE_EARNING_CODES = new Set(["BASIC_PAY", "THIRTEENTH_MONTH", "MID_YEAR_BONUS"])
const CORE_DEDUCTION_CODES = new Set(["SSS", "PHILHEALTH", "PAGIBIG", "WTAX"])
const MANUAL_ADJUSTMENT_CODE = "ADJUSTMENT"
const ADJUSTMENT_DESCRIPTION_CODE_REGEX = /^\s*([A-Z0-9_]{1,20})\s*[-:]\s*/i

const isCoreEarning = (line: RegisterLineInput): boolean => {
  const code = normalizeText(line.code)
  if (CORE_EARNING_CODES.has(code)) return true
  const mergedText = `${normalizeText(line.name)} ${normalizeText(line.description)}`
  return mergedText.includes("BASIC PAY")
}

const isCoreDeduction = (line: RegisterLineInput): boolean => CORE_DEDUCTION_CODES.has(normalizeText(line.code))

const extractAdjustmentColumnCodeFromText = (value: string | null | undefined): string | null => {
  const normalized = (value ?? "").trim()
  if (!normalized) return null

  const match = normalized.match(ADJUSTMENT_DESCRIPTION_CODE_REGEX)
  if (!match?.[1]) return null

  return toColumnCode(match[1])
}

const resolveDynamicColumnCode = (input: { code: string; name: string; description: string }): string => {
  const normalizedInputCode = normalizeText(input.code)
  if (normalizedInputCode !== MANUAL_ADJUSTMENT_CODE) {
    return toColumnCode(input.code)
  }

  return (
    extractAdjustmentColumnCodeFromText(input.description) ??
    extractAdjustmentColumnCodeFromText(input.name) ??
    toColumnCode(input.description || input.name || input.code)
  )
}

const getAlwaysOnDeductionBucket = (line: RegisterLineInput): "ABSENT" | "LATE" | "UNDERTIME" | null => {
  const code = normalizeText(line.code)
  const mergedText = `${normalizeText(line.name)} ${normalizeText(line.description)}`

  if (code === "ABSENT" || code === "ABSENCE" || /ABSENT|ABSENCE/.test(mergedText)) {
    return "ABSENT"
  }
  if (code === "TARDINESS" || /TARDINESS|LATE/.test(mergedText)) {
    return "LATE"
  }
  if (code === "UNDERTIME" || /UNDERTIME/.test(mergedText)) {
    return "UNDERTIME"
  }

  return null
}

const toColumnMetadata = (input: {
  category: "EARNING" | "DEDUCTION"
  code: string
  name: string
  description: string
}): PayrollRegisterDynamicColumn => {
  const normalizedCode = resolveDynamicColumnCode(input)
  const isManualAdjustment = normalizeText(input.code) === MANUAL_ADJUSTMENT_CODE
  const preferredLabel = (isManualAdjustment ? input.description || input.name : input.name || input.description || normalizedCode).trim()

  return {
    key: `${input.category}:${normalizedCode}`,
    code: normalizedCode,
    label: preferredLabel.length > 0 ? preferredLabel : normalizedCode,
    category: input.category,
  }
}

const toDynamicColumnHeader = (sign: "+" | "-", column: PayrollRegisterDynamicColumn): string => {
  return `${sign} ${column.code}`
}

const createEmptyTotals = (columns: PayrollRegisterDynamicColumn[]): PayrollRegisterTotals => ({
  basicPay: 0,
  grossPay: 0,
  sss: 0,
  philHealth: 0,
  pagIbig: 0,
  tax: 0,
  absent: 0,
  late: 0,
  undertime: 0,
  dynamicAmountsByKey: Object.fromEntries(columns.map((column) => [column.key, 0])),
  dynamicEarningsTotal: 0,
  dynamicDeductionsTotal: 0,
  netPay: 0,
})

const accumulateRows = (rows: PayslipRegisterRow[], columns: PayrollRegisterDynamicColumn[]): PayrollRegisterTotals => {
  const totals = createEmptyTotals(columns)

  for (const row of rows) {
    totals.basicPay += row.basicPay
    totals.grossPay += row.grossPay
    totals.sss += row.sss
    totals.philHealth += row.philHealth
    totals.pagIbig += row.pagIbig
    totals.tax += row.tax
    totals.absent += row.absent
    totals.late += row.late
    totals.undertime += row.undertime
    totals.dynamicEarningsTotal += row.dynamicEarningsTotal
    totals.dynamicDeductionsTotal += row.dynamicDeductionsTotal
    totals.netPay += row.netPay

    for (const [key, value] of Object.entries(row.dynamicAmountsByKey)) {
      totals.dynamicAmountsByKey[key] = (totals.dynamicAmountsByKey[key] ?? 0) + value
    }
  }

  totals.basicPay = roundCurrency(totals.basicPay)
  totals.grossPay = roundCurrency(totals.grossPay)
  totals.sss = roundCurrency(totals.sss)
  totals.philHealth = roundCurrency(totals.philHealth)
  totals.pagIbig = roundCurrency(totals.pagIbig)
  totals.tax = roundCurrency(totals.tax)
  totals.absent = roundCurrency(totals.absent)
  totals.late = roundCurrency(totals.late)
  totals.undertime = roundCurrency(totals.undertime)
  totals.dynamicEarningsTotal = roundCurrency(totals.dynamicEarningsTotal)
  totals.dynamicDeductionsTotal = roundCurrency(totals.dynamicDeductionsTotal)
  totals.netPay = roundCurrency(totals.netPay)

  for (const key of Object.keys(totals.dynamicAmountsByKey)) {
    totals.dynamicAmountsByKey[key] = roundCurrency(totals.dynamicAmountsByKey[key] ?? 0)
  }

  return totals
}

const buildRowsAndColumns = (rows: RegisterInputRow[]): { columns: PayrollRegisterDynamicColumn[]; registerRows: PayslipRegisterRow[] } => {
  const dynamicColumnMap = new Map<string, PayrollRegisterDynamicColumn>()

  const registerRows = rows.map((row) => {
    const dynamicAmountsByKey: Record<string, number> = {}

    let absent = 0
    let late = 0
    let undertime = 0
    let dynamicEarningsTotal = 0
    let dynamicDeductionsTotal = 0

    for (const earningLine of row.earnings) {
      if (isCoreEarning(earningLine)) continue

      const amount = toNumber(earningLine.amount)
      const column = toColumnMetadata({
        category: "EARNING",
        code: earningLine.code,
        name: earningLine.name,
        description: earningLine.description,
      })

      dynamicColumnMap.set(column.key, column)
      dynamicAmountsByKey[column.key] = (dynamicAmountsByKey[column.key] ?? 0) + amount
      dynamicEarningsTotal += amount
    }

    for (const deductionLine of row.deductions) {
      const amount = toNumber(deductionLine.amount)
      if (isCoreDeduction(deductionLine)) continue
      const alwaysOnBucket = getAlwaysOnDeductionBucket(deductionLine)

      if (alwaysOnBucket === "ABSENT") {
        absent += amount
        continue
      }
      if (alwaysOnBucket === "LATE") {
        late += amount
        continue
      }
      if (alwaysOnBucket === "UNDERTIME") {
        undertime += amount
        continue
      }

      const column = toColumnMetadata({
        category: "DEDUCTION",
        code: deductionLine.code,
        name: deductionLine.name,
        description: deductionLine.description,
      })

      dynamicColumnMap.set(column.key, column)
      dynamicAmountsByKey[column.key] = (dynamicAmountsByKey[column.key] ?? 0) + amount
      dynamicDeductionsTotal += amount
    }

    // DED TOTAL should include fixed statutory/attendance deductions plus all dynamic deduction-type columns.
    // This keeps totals aligned with what users see on the register columns.
    const rowDeductionsTotal = roundCurrency(
      toNumber(row.sss) +
        toNumber(row.philHealth) +
        toNumber(row.pagIbig) +
        toNumber(row.tax) +
        absent +
        late +
        undertime +
        dynamicDeductionsTotal
    )

    return {
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      departmentName: row.departmentName ?? "UNASSIGNED",
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      basicPay: roundCurrency(toNumber(row.basicPay)),
      grossPay: roundCurrency(toNumber(row.grossPay)),
      sss: roundCurrency(toNumber(row.sss)),
      philHealth: roundCurrency(toNumber(row.philHealth)),
      pagIbig: roundCurrency(toNumber(row.pagIbig)),
      tax: roundCurrency(toNumber(row.tax)),
      absent: roundCurrency(absent),
      late: roundCurrency(late),
      undertime: roundCurrency(undertime),
      dynamicAmountsByKey: Object.fromEntries(
        Object.entries(dynamicAmountsByKey).map(([key, value]) => [key, roundCurrency(value)])
      ),
      dynamicEarningsTotal: roundCurrency(dynamicEarningsTotal),
      dynamicDeductionsTotal: rowDeductionsTotal,
      netPay: roundCurrency(toNumber(row.netPay)),
    }
  })

  const sortedColumns = Array.from(dynamicColumnMap.values()).sort((a, b) => {
    if (a.category !== b.category) {
      return a.category === "EARNING" ? -1 : 1
    }
    const codeDiff = a.code.localeCompare(b.code)
    if (codeDiff !== 0) return codeDiff
    return a.label.localeCompare(b.label)
  })

  return {
    columns: sortedColumns,
    registerRows,
  }
}

const groupByDepartment = (rows: PayslipRegisterRow[], columns: PayrollRegisterDynamicColumn[]): DepartmentGroup[] => {
  const departmentMap = new Map<string, PayslipRegisterRow[]>()

  for (const row of rows) {
    const key = row.departmentName
    const existing = departmentMap.get(key)
    if (existing) {
      existing.push(row)
    } else {
      departmentMap.set(key, [row])
    }
  }

  return Array.from(departmentMap.entries())
    .map(([name, employees]) => {
      const sortedEmployees = [...employees].sort((a, b) => {
        const nameDiff = a.employeeName.localeCompare(b.employeeName)
        if (nameDiff !== 0) return nameDiff
        return a.employeeNumber.localeCompare(b.employeeNumber)
      })

      return {
        name,
        employees: sortedEmployees,
        subtotal: accumulateRows(sortedEmployees, columns),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const buildPayrollRegisterReportData = (input: RegisterInput): PayrollRegisterReportData => {
  const { columns, registerRows } = buildRowsAndColumns(input.rows)
  const departments = groupByDepartment(registerRows, columns)

  return {
    columns,
    departments,
    grandTotal: accumulateRows(registerRows, columns),
    headcount: registerRows.length,
  }
}

export const buildPayrollRegisterCsv = (input: RegisterInput): string => {
  const reportData = buildPayrollRegisterReportData(input)

  const earningColumns = reportData.columns.filter((column) => column.category === "EARNING")
  const deductionColumns = reportData.columns.filter((column) => column.category === "DEDUCTION")

  const headers = [
    "Emp ID",
    "Employee Name",
    "Period Date",
    "BAS",
    "SSS",
    "PHI",
    "HDMF",
    "WTAX",
    "ABS",
    "LTE",
    "UT",
    ...earningColumns.map((column) => toDynamicColumnHeader("+", column)),
    ...deductionColumns.map((column) => toDynamicColumnHeader("-", column)),
    "+ EARN TOTAL",
    "GROSS",
    "- DED TOTAL",
    "NET",
  ]

  const lines: string[] = [headers.map(csvEscape).join(",")]

  for (const group of reportData.departments) {
    lines.push(csvEscape(`DEPARTMENT: ${group.name}`))

    for (const row of group.employees) {
      lines.push(
        [
          row.employeeNumber,
          row.employeeName,
          formatDateRange(row.periodStart, row.periodEnd),
          toCurrencyText(row.basicPay),
          toCurrencyText(row.sss),
          toCurrencyText(row.philHealth),
          toCurrencyText(row.pagIbig),
          toCurrencyText(row.tax),
          toCurrencyText(row.absent),
          toCurrencyText(row.late),
          toCurrencyText(row.undertime),
          ...earningColumns.map((column) => toCurrencyText(row.dynamicAmountsByKey[column.key] ?? 0)),
          ...deductionColumns.map((column) => toCurrencyText(row.dynamicAmountsByKey[column.key] ?? 0)),
          toCurrencyText(row.dynamicEarningsTotal),
          toCurrencyText(row.grossPay),
          toCurrencyText(row.dynamicDeductionsTotal),
          toCurrencyText(row.netPay),
        ]
          .map(csvEscape)
          .join(",")
      )
    }

    lines.push(
      [
        `SUB-TOTAL: ${group.name}`,
        "",
        `HC:${group.employees.length}`,
        toCurrencyText(group.subtotal.basicPay),
        toCurrencyText(group.subtotal.sss),
        toCurrencyText(group.subtotal.philHealth),
        toCurrencyText(group.subtotal.pagIbig),
        toCurrencyText(group.subtotal.tax),
        toCurrencyText(group.subtotal.absent),
        toCurrencyText(group.subtotal.late),
        toCurrencyText(group.subtotal.undertime),
        ...earningColumns.map((column) => toCurrencyText(group.subtotal.dynamicAmountsByKey[column.key] ?? 0)),
        ...deductionColumns.map((column) => toCurrencyText(group.subtotal.dynamicAmountsByKey[column.key] ?? 0)),
        toCurrencyText(group.subtotal.dynamicEarningsTotal),
        toCurrencyText(group.subtotal.grossPay),
        toCurrencyText(group.subtotal.dynamicDeductionsTotal),
        toCurrencyText(group.subtotal.netPay),
      ]
        .map(csvEscape)
        .join(",")
    )
  }

  lines.push(
    [
      "GRAND TOTAL",
      "",
      `HC:${reportData.headcount}`,
      toCurrencyText(reportData.grandTotal.basicPay),
      toCurrencyText(reportData.grandTotal.sss),
      toCurrencyText(reportData.grandTotal.philHealth),
      toCurrencyText(reportData.grandTotal.pagIbig),
      toCurrencyText(reportData.grandTotal.tax),
      toCurrencyText(reportData.grandTotal.absent),
      toCurrencyText(reportData.grandTotal.late),
      toCurrencyText(reportData.grandTotal.undertime),
      ...earningColumns.map((column) => toCurrencyText(reportData.grandTotal.dynamicAmountsByKey[column.key] ?? 0)),
      ...deductionColumns.map((column) => toCurrencyText(reportData.grandTotal.dynamicAmountsByKey[column.key] ?? 0)),
      toCurrencyText(reportData.grandTotal.dynamicEarningsTotal),
      toCurrencyText(reportData.grandTotal.grossPay),
      toCurrencyText(reportData.grandTotal.dynamicDeductionsTotal),
      toCurrencyText(reportData.grandTotal.netPay),
    ]
      .map(csvEscape)
      .join(",")
  )

  return lines.join("\n")
}
