import { PayrollRunType } from "@prisma/client"

export type LateOvertimeSourcePayslipRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentId: string | null
  departmentName: string | null
  payPeriodId: string
  runNumber: string
  runCreatedAt: Date
  runTypeCode: PayrollRunType
  isTrialRun: boolean
  lateMins: number
  overtimeHours: number
  overtimePayAmount: number
  tardinessDeductionAmount: number
}

export type LateOvertimeEmployeeAggregateRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  lateMins: number
  overtimeHours: number
  overtimePayAmount: number
  tardinessDeductionAmount: number
}

export type LateOvertimeDepartmentAggregateRow = {
  departmentId: string | null
  departmentName: string
  employeeCount: number
  lateMins: number
  overtimeHours: number
  overtimePayAmount: number
  tardinessDeductionAmount: number
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100

const isTrialRow = (row: LateOvertimeSourcePayslipRow): boolean => {
  return row.isTrialRun || row.runTypeCode === PayrollRunType.TRIAL_RUN
}

const isRegularRow = (row: LateOvertimeSourcePayslipRow): boolean => {
  return row.runTypeCode === PayrollRunType.REGULAR && !row.isTrialRun
}

const buildLatestTrialRunByPayPeriod = (
  rows: LateOvertimeSourcePayslipRow[]
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

export const selectLateOvertimeRows = (
  rows: LateOvertimeSourcePayslipRow[],
  includeTrialRuns: boolean
): LateOvertimeSourcePayslipRow[] => {
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

export const summarizeLateOvertimeRows = (
  rows: LateOvertimeSourcePayslipRow[]
): {
  totalLateMins: number
  totalOvertimeHours: number
  totalOvertimePayAmount: number
  totalTardinessDeductionAmount: number
} => {
  let totalLateMins = 0
  let totalOvertimeHours = 0
  let totalOvertimePayAmount = 0
  let totalTardinessDeductionAmount = 0

  for (const row of rows) {
    totalLateMins += row.lateMins
    totalOvertimeHours += row.overtimeHours
    totalOvertimePayAmount += row.overtimePayAmount
    totalTardinessDeductionAmount += row.tardinessDeductionAmount
  }

  return {
    totalLateMins,
    totalOvertimeHours: roundCurrency(totalOvertimeHours),
    totalOvertimePayAmount: roundCurrency(totalOvertimePayAmount),
    totalTardinessDeductionAmount: roundCurrency(totalTardinessDeductionAmount),
  }
}

export const aggregateLateOvertimeEmployeeRows = (
  rows: LateOvertimeSourcePayslipRow[]
): LateOvertimeEmployeeAggregateRow[] => {
  const grouped = new Map<string, LateOvertimeEmployeeAggregateRow>()

  for (const row of rows) {
    const existing = grouped.get(row.employeeId)
    if (!existing) {
      grouped.set(row.employeeId, {
        employeeId: row.employeeId,
        employeeNumber: row.employeeNumber,
        employeeName: row.employeeName,
        departmentName: row.departmentName,
        lateMins: row.lateMins,
        overtimeHours: row.overtimeHours,
        overtimePayAmount: row.overtimePayAmount,
        tardinessDeductionAmount: row.tardinessDeductionAmount,
      })
      continue
    }

    existing.lateMins += row.lateMins
    existing.overtimeHours += row.overtimeHours
    existing.overtimePayAmount += row.overtimePayAmount
    existing.tardinessDeductionAmount += row.tardinessDeductionAmount
  }

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    overtimeHours: roundCurrency(row.overtimeHours),
    overtimePayAmount: roundCurrency(row.overtimePayAmount),
    tardinessDeductionAmount: roundCurrency(row.tardinessDeductionAmount),
  }))
}

export const aggregateLateOvertimeDepartmentRows = (
  rows: LateOvertimeSourcePayslipRow[]
): LateOvertimeDepartmentAggregateRow[] => {
  const grouped = new Map<
    string,
    {
      departmentId: string | null
      departmentName: string
      employeeIds: Set<string>
      lateMins: number
      overtimeHours: number
      overtimePayAmount: number
      tardinessDeductionAmount: number
    }
  >()

  for (const row of rows) {
    const key = row.departmentId ?? "__UNASSIGNED__"
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, {
        departmentId: row.departmentId,
        departmentName: row.departmentName ?? "UNASSIGNED",
        employeeIds: new Set([row.employeeId]),
        lateMins: row.lateMins,
        overtimeHours: row.overtimeHours,
        overtimePayAmount: row.overtimePayAmount,
        tardinessDeductionAmount: row.tardinessDeductionAmount,
      })
      continue
    }

    existing.employeeIds.add(row.employeeId)
    existing.lateMins += row.lateMins
    existing.overtimeHours += row.overtimeHours
    existing.overtimePayAmount += row.overtimePayAmount
    existing.tardinessDeductionAmount += row.tardinessDeductionAmount
  }

  return Array.from(grouped.values()).map((row) => ({
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    employeeCount: row.employeeIds.size,
    lateMins: row.lateMins,
    overtimeHours: roundCurrency(row.overtimeHours),
    overtimePayAmount: roundCurrency(row.overtimePayAmount),
    tardinessDeductionAmount: roundCurrency(row.tardinessDeductionAmount),
  }))
}

export const rankTopEmployeesByLate = (
  rows: LateOvertimeEmployeeAggregateRow[],
  topN: number
): LateOvertimeEmployeeAggregateRow[] => {
  return [...rows]
    .sort((a, b) => {
      const lateDiff = b.lateMins - a.lateMins
      if (lateDiff !== 0) return lateDiff
      const deductionDiff = b.tardinessDeductionAmount - a.tardinessDeductionAmount
      if (deductionDiff !== 0) return deductionDiff
      const nameDiff = a.employeeName.localeCompare(b.employeeName)
      if (nameDiff !== 0) return nameDiff
      return a.employeeNumber.localeCompare(b.employeeNumber)
    })
    .slice(0, topN)
}

export const rankTopEmployeesByOvertime = (
  rows: LateOvertimeEmployeeAggregateRow[],
  topN: number
): LateOvertimeEmployeeAggregateRow[] => {
  return [...rows]
    .sort((a, b) => {
      const overtimeDiff = b.overtimeHours - a.overtimeHours
      if (overtimeDiff !== 0) return overtimeDiff
      const overtimePayDiff = b.overtimePayAmount - a.overtimePayAmount
      if (overtimePayDiff !== 0) return overtimePayDiff
      const nameDiff = a.employeeName.localeCompare(b.employeeName)
      if (nameDiff !== 0) return nameDiff
      return a.employeeNumber.localeCompare(b.employeeNumber)
    })
    .slice(0, topN)
}

export const rankTopDepartmentsByLate = (
  rows: LateOvertimeDepartmentAggregateRow[],
  topN: number
): LateOvertimeDepartmentAggregateRow[] => {
  return [...rows]
    .sort((a, b) => {
      const lateDiff = b.lateMins - a.lateMins
      if (lateDiff !== 0) return lateDiff
      const deductionDiff = b.tardinessDeductionAmount - a.tardinessDeductionAmount
      if (deductionDiff !== 0) return deductionDiff
      return a.departmentName.localeCompare(b.departmentName)
    })
    .slice(0, topN)
}

export const rankTopDepartmentsByOvertime = (
  rows: LateOvertimeDepartmentAggregateRow[],
  topN: number
): LateOvertimeDepartmentAggregateRow[] => {
  return [...rows]
    .sort((a, b) => {
      const overtimeDiff = b.overtimeHours - a.overtimeHours
      if (overtimeDiff !== 0) return overtimeDiff
      const overtimePayDiff = b.overtimePayAmount - a.overtimePayAmount
      if (overtimePayDiff !== 0) return overtimePayDiff
      return a.departmentName.localeCompare(b.departmentName)
    })
    .slice(0, topN)
}
