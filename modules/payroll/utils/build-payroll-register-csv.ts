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

const findByName = (
  lines: Array<{ description: string; amount: number }>,
  patterns: RegExp[]
): number => {
  return lines
    .filter((line) => patterns.some((pattern) => pattern.test(line.description.toLowerCase())))
    .reduce((sum, line) => sum + line.amount, 0)
}

type PayslipRegisterRow = {
  employeeNumber: string
  employeeName: string
  departmentName: string
  periodStart: Date
  periodEnd: Date
  basicPay: number
  sss: number
  philHealth: number
  pagIbig: number
  tax: number
  sssLoan: number
  allowance: number
  otherDeductions: number
  absent: number
  late: number
  undertime: number
  netPay: number
}

export type DepartmentGroup = {
  name: string
  employees: PayslipRegisterRow[]
}

export type PayrollRegisterReportData = {
  departments: DepartmentGroup[]
  grandTotal: {
    basicPay: number
    sss: number
    philHealth: number
    pagIbig: number
    tax: number
    sssLoan: number
    allowance: number
    otherDeductions: number
    absent: number
    late: number
    undertime: number
    netPay: number
  }
  headcount: number
}

const subtotal = (rows: PayslipRegisterRow[]) => {
  return rows.reduce(
    (acc, row) => ({
      basicPay: acc.basicPay + row.basicPay,
      sss: acc.sss + row.sss,
      philHealth: acc.philHealth + row.philHealth,
      pagIbig: acc.pagIbig + row.pagIbig,
      tax: acc.tax + row.tax,
      sssLoan: acc.sssLoan + row.sssLoan,
      allowance: acc.allowance + row.allowance,
      otherDeductions: acc.otherDeductions + row.otherDeductions,
      absent: acc.absent + row.absent,
      late: acc.late + row.late,
      undertime: acc.undertime + row.undertime,
      netPay: acc.netPay + row.netPay,
    }),
    {
      basicPay: 0,
      sss: 0,
      philHealth: 0,
      pagIbig: 0,
      tax: 0,
      sssLoan: 0,
      allowance: 0,
      otherDeductions: 0,
      absent: 0,
      late: 0,
      undertime: 0,
      netPay: 0,
    }
  )
}

const toCurrencyText = (value: number): string => roundCurrency(value).toFixed(2)

const buildRegisterRows = (input: {
  rows: Array<{
    employeeNumber: string
    employeeName: string
    departmentName: string | null
    periodStart: Date
    periodEnd: Date
    basicPay: DecimalLike
    sss: DecimalLike
    philHealth: DecimalLike
    pagIbig: DecimalLike
    tax: DecimalLike
    totalDeductions: DecimalLike
    netPay: DecimalLike
    earnings: Array<{ description: string; amount: DecimalLike }>
    deductions: Array<{ description: string; amount: DecimalLike }>
  }>
}): PayslipRegisterRow[] => {
  const registerRows: PayslipRegisterRow[] = input.rows.map((row) => {
    const earnings = row.earnings.map((entry) => ({
      description: entry.description,
      amount: toNumber(entry.amount),
    }))
    const deductions = row.deductions.map((entry) => ({
      description: entry.description,
      amount: toNumber(entry.amount),
    }))

    const sssLoan = findByName(deductions, [/sss\s*loan/])
    const absent = findByName(deductions, [/absent/, /absence/])
    const late = findByName(deductions, [/late/, /tard/])
    const undertime = findByName(deductions, [/undertime/])
    const allowance = findByName(earnings, [/allowance/])

    const statutory = toNumber(row.sss) + toNumber(row.philHealth) + toNumber(row.pagIbig) + toNumber(row.tax)
    const computedOtherDeductions =
      toNumber(row.totalDeductions) - statutory - sssLoan - absent - late - undertime

    return {
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      departmentName: row.departmentName ?? "UNASSIGNED",
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      basicPay: toNumber(row.basicPay),
      sss: toNumber(row.sss),
      philHealth: toNumber(row.philHealth),
      pagIbig: toNumber(row.pagIbig),
      tax: toNumber(row.tax),
      sssLoan,
      allowance,
      otherDeductions: Math.max(roundCurrency(computedOtherDeductions), 0),
      absent,
      late,
      undertime,
      netPay: toNumber(row.netPay),
    }
  })

  return registerRows
}

const groupByDepartment = (rows: PayslipRegisterRow[]): DepartmentGroup[] => {
  const departmentMap = new Map<string, PayslipRegisterRow[]>()
  rows.forEach((row) => {
    const key = row.departmentName
    const existing = departmentMap.get(key)
    if (existing) existing.push(row)
    else departmentMap.set(key, [row])
  })

  return Array.from(departmentMap.entries())
    .map(([name, employees]) => ({ name, employees }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const buildPayrollRegisterReportData = (input: {
  rows: Array<{
    employeeNumber: string
    employeeName: string
    departmentName: string | null
    periodStart: Date
    periodEnd: Date
    basicPay: DecimalLike
    sss: DecimalLike
    philHealth: DecimalLike
    pagIbig: DecimalLike
    tax: DecimalLike
    totalDeductions: DecimalLike
    netPay: DecimalLike
    earnings: Array<{ description: string; amount: DecimalLike }>
    deductions: Array<{ description: string; amount: DecimalLike }>
  }>
}): PayrollRegisterReportData => {
  const registerRows = buildRegisterRows(input)
  const departments = groupByDepartment(registerRows)
  return {
    departments,
    grandTotal: subtotal(registerRows),
    headcount: registerRows.length,
  }
}

export const buildPayrollRegisterCsv = (input: {
  rows: Array<{
    employeeNumber: string
    employeeName: string
    departmentName: string | null
    periodStart: Date
    periodEnd: Date
    basicPay: DecimalLike
    sss: DecimalLike
    philHealth: DecimalLike
    pagIbig: DecimalLike
    tax: DecimalLike
    totalDeductions: DecimalLike
    netPay: DecimalLike
    earnings: Array<{ description: string; amount: DecimalLike }>
    deductions: Array<{ description: string; amount: DecimalLike }>
  }>
}): string => {
  const reportData = buildPayrollRegisterReportData(input)

  const lines: string[] = []
  lines.push(["Emp ID", "Employee Name", "Period Date", "BAS", "SSS", "PHI", "HDMF", "TAX", "SSSL", "ALW", "OTH", "ABS", "LTE", "UT", "NET"].join(","))

  reportData.departments.forEach((group) => {
    lines.push(csvEscape(`DEPARTMENT: ${group.name}`))

    group.employees
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
      .forEach((row) => {
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
            toCurrencyText(row.sssLoan),
            toCurrencyText(row.allowance),
            toCurrencyText(row.otherDeductions),
            toCurrencyText(row.absent),
            toCurrencyText(row.late),
            toCurrencyText(row.undertime),
            toCurrencyText(row.netPay),
          ]
            .map(csvEscape)
            .join(",")
        )
      })

    const groupSubtotal = subtotal(group.employees)
    lines.push(
      [
        `SUB-TOTAL: ${group.name}`,
        "",
        `HC:${group.employees.length}`,
        toCurrencyText(groupSubtotal.basicPay),
        toCurrencyText(groupSubtotal.sss),
        toCurrencyText(groupSubtotal.philHealth),
        toCurrencyText(groupSubtotal.pagIbig),
        toCurrencyText(groupSubtotal.tax),
        toCurrencyText(groupSubtotal.sssLoan),
        toCurrencyText(groupSubtotal.allowance),
        toCurrencyText(groupSubtotal.otherDeductions),
        toCurrencyText(groupSubtotal.absent),
        toCurrencyText(groupSubtotal.late),
        toCurrencyText(groupSubtotal.undertime),
        toCurrencyText(groupSubtotal.netPay),
      ]
        .map(csvEscape)
        .join(",")
    )
  })

  const grand = reportData.grandTotal
  lines.push(
    [
      "GRAND TOTAL",
      "",
      `HC:${reportData.headcount}`,
      toCurrencyText(grand.basicPay),
      toCurrencyText(grand.sss),
      toCurrencyText(grand.philHealth),
      toCurrencyText(grand.pagIbig),
      toCurrencyText(grand.tax),
      toCurrencyText(grand.sssLoan),
      toCurrencyText(grand.allowance),
      toCurrencyText(grand.otherDeductions),
      toCurrencyText(grand.absent),
      toCurrencyText(grand.late),
      toCurrencyText(grand.undertime),
      toCurrencyText(grand.netPay),
    ]
      .map(csvEscape)
      .join(",")
  )

  return lines.join("\n")
}
