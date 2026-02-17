import { PayrollRunType } from "@prisma/client"

type MonthlyBirWTaxAggregateRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  tinNumberMasked: string | null
  runNumbers: string[]
  withholdingTaxAmount: number
}

export type MonthlyWTaxSourcePayslipRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  tinNumberMasked: string | null
  runNumber: string
  runCreatedAt: Date
  payPeriodId: string
  runTypeCode: PayrollRunType
  isTrialRun: boolean
  withholdingTaxAmount: number
}

const csvCurrencyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const isTrialRow = (row: MonthlyWTaxSourcePayslipRow): boolean => {
  return row.isTrialRun || row.runTypeCode === PayrollRunType.TRIAL_RUN
}

const isRegularRow = (row: MonthlyWTaxSourcePayslipRow): boolean => {
  return row.runTypeCode === PayrollRunType.REGULAR && !row.isTrialRun
}

const buildLatestTrialRunByPayPeriod = (
  rows: MonthlyWTaxSourcePayslipRow[]
): Map<string, { runNumber: string; runCreatedAtMs: number }> => {
  const latest = new Map<string, { runNumber: string; runCreatedAtMs: number }>()

  for (const row of rows) {
    if (!isTrialRow(row)) continue
    const runCreatedAtMs = row.runCreatedAt.getTime()
    const existing = latest.get(row.payPeriodId)

    if (
      !existing ||
      runCreatedAtMs > existing.runCreatedAtMs ||
      (runCreatedAtMs === existing.runCreatedAtMs && row.runNumber > existing.runNumber)
    ) {
      latest.set(row.payPeriodId, {
        runNumber: row.runNumber,
        runCreatedAtMs,
      })
    }
  }

  return latest
}

export const selectMonthlyBirWTaxRows = (
  rows: MonthlyWTaxSourcePayslipRow[],
  includeTrialRuns: boolean
): MonthlyWTaxSourcePayslipRow[] => {
  const regularRows = rows.filter((row) => isRegularRow(row))
  if (!includeTrialRuns) {
    return regularRows
  }

  const latestTrialByPayPeriod = buildLatestTrialRunByPayPeriod(rows)
  const includedTrialRows = rows.filter((row) => {
    if (!isTrialRow(row)) return false
    const latest = latestTrialByPayPeriod.get(row.payPeriodId)
    if (!latest) return false
    return row.runNumber === latest.runNumber && row.runCreatedAt.getTime() === latest.runCreatedAtMs
  })

  return [...regularRows, ...includedTrialRows]
}

export const aggregateMonthlyBirWTaxRows = (
  rows: MonthlyWTaxSourcePayslipRow[]
): MonthlyBirWTaxAggregateRow[] => {
  const grouped = new Map<
    string,
    {
      employeeId: string
      employeeNumber: string
      employeeName: string
      departmentName: string | null
      tinNumberMasked: string | null
      runNumbers: Set<string>
      withholdingTaxAmount: number
    }
  >()

  for (const row of rows) {
    const existing = grouped.get(row.employeeId)

    if (!existing) {
      grouped.set(row.employeeId, {
        employeeId: row.employeeId,
        employeeNumber: row.employeeNumber,
        employeeName: row.employeeName,
        departmentName: row.departmentName,
        tinNumberMasked: row.tinNumberMasked,
        runNumbers: new Set([row.runNumber]),
        withholdingTaxAmount: row.withholdingTaxAmount,
      })
      continue
    }

    existing.runNumbers.add(row.runNumber)
    existing.withholdingTaxAmount += row.withholdingTaxAmount
  }

  return Array.from(grouped.values())
    .map((row) => ({
      employeeId: row.employeeId,
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      departmentName: row.departmentName,
      tinNumberMasked: row.tinNumberMasked,
      runNumbers: Array.from(row.runNumbers).sort((a, b) => a.localeCompare(b)),
      withholdingTaxAmount: Math.round(row.withholdingTaxAmount * 100) / 100,
    }))
    .sort((a, b) => {
      const amountDiff = b.withholdingTaxAmount - a.withholdingTaxAmount
      if (amountDiff !== 0) return amountDiff
      return a.employeeName.localeCompare(b.employeeName)
    })
}

export const getMonthlyBirWTaxCsvRows = (rows: MonthlyBirWTaxAggregateRow[]): string[][] => {
  return rows.map((row) => [
    row.employeeNumber,
    row.employeeName,
    row.departmentName ?? "UNASSIGNED",
    row.tinNumberMasked ?? "",
    row.runNumbers.join(" | "),
    csvCurrencyFormatter.format(row.withholdingTaxAmount),
  ])
}
