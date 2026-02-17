import { PayrollRunType, RequestStatus } from "@prisma/client"

import { toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type {
  LateOvertimeReportViewModel,
  LateOvertimeReportSectionKey,
  LateOvertimeTopEmployeeRow,
} from "@/modules/reports/payroll/types/report-view-models"
import {
  aggregateLateOvertimeDepartmentRows,
  aggregateLateOvertimeEmployeeRows,
  rankTopDepartmentsByLate,
  rankTopDepartmentsByOvertime,
  rankTopEmployeesByLate,
  rankTopEmployeesByOvertime,
  summarizeLateOvertimeRows,
  type LateOvertimeSourcePayslipRow,
} from "@/modules/reports/payroll/utils/late-overtime-report-helpers"
import { normalizeReportDateRange, toReportDateRangeLabel } from "@/modules/reports/payroll/utils/report-time-utils"

type LateOvertimeInput = {
  companyId: string
  startDate?: string
  endDate?: string
  topN?: string | number
}

export type LateOvertimeReportWorkspaceViewModel = LateOvertimeReportViewModel & {
  filters: {
    startDate: string
    endDate: string
    topN: number
  }
  generatedAtLabel: string
}

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const toDayColumnLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toDateTimeLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const parseTopN = (value: string | number | undefined): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 10
  const normalized = Math.floor(parsed)
  if (normalized < 1) return 1
  if (normalized > 100) return 100
  return normalized
}

const toNormalizedCode = (value: string): string => value.trim().toUpperCase()

const toNormalizedDescription = (value: string): string => value.trim().toUpperCase()

const isOvertimeEarningLine = (line: { code: string; description: string }): boolean => {
  if (toNormalizedCode(line.code) === "OVERTIME") return true
  return toNormalizedDescription(line.description).includes("OVERTIME")
}

const isTardinessDeductionLine = (line: { code: string; description: string }): boolean => {
  const code = toNormalizedCode(line.code)
  if (code === "TARDINESS") return true
  const description = toNormalizedDescription(line.description)
  return description.includes("TARDINESS") || description.includes("LATE")
}

const toLateBreakdownLabel = (events: Array<{ dateLabel: string; lateMins: number }>): string => {
  if (events.length === 0) return "-"
  return events.map((event) => `${event.dateLabel} (${event.lateMins}m)`).join(", ")
}

const toOvertimeBreakdownLabel = (events: Array<{ dateLabel: string; overtimeHours: number }>): string => {
  if (events.length === 0) return "-"
  const hoursFormatter = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return events.map((event) => `${event.dateLabel} (${hoursFormatter.format(event.overtimeHours)}h)`).join(", ")
}

const roundValue = (value: number): number => Math.round(value * 100) / 100

const buildLateDateColumns = (
  rows: LateOvertimeTopEmployeeRow[]
): Array<{ dateValue: string; dateLabel: string }> => {
  const dateLabelByValue = new Map<string, string>()
  for (const row of rows) {
    const lateDailyBreakdown = Array.isArray(row.lateDailyBreakdown) ? row.lateDailyBreakdown : []
    for (const entry of lateDailyBreakdown) {
      if (dateLabelByValue.has(entry.dateValue)) continue
      dateLabelByValue.set(entry.dateValue, entry.dateLabel)
    }
  }

  return Array.from(dateLabelByValue.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateValue, dateLabel]) => ({ dateValue, dateLabel }))
}

const buildOvertimeDateColumns = (
  rows: LateOvertimeTopEmployeeRow[]
): Array<{ dateValue: string; dateLabel: string }> => {
  const dateLabelByValue = new Map<string, string>()
  for (const row of rows) {
    const overtimeDailyBreakdown = Array.isArray(row.overtimeDailyBreakdown) ? row.overtimeDailyBreakdown : []
    for (const entry of overtimeDailyBreakdown) {
      if (dateLabelByValue.has(entry.dateValue)) continue
      dateLabelByValue.set(entry.dateValue, entry.dateLabel)
    }
  }

  return Array.from(dateLabelByValue.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateValue, dateLabel]) => ({ dateValue, dateLabel }))
}

const buildLateOvertimeCsvRows = (
  viewModel: LateOvertimeReportWorkspaceViewModel,
  section?: LateOvertimeReportSectionKey
): string[][] => {
  const numberFormatter = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const baseRows: string[][] = [
    ["Late and Overtime Totals Report"],
    ["Company", viewModel.companyName],
    ["Date Range", `${viewModel.summary.startDateValue} to ${viewModel.summary.endDateValue}`],
    ["Section", section ?? "all"],
    ["Top N", String(viewModel.filters.topN)],
    [],
    ["Summary"],
    ["Total Late Minutes", String(viewModel.summary.totalLateMins)],
    ["Total Overtime Hours", numberFormatter.format(viewModel.summary.totalOvertimeHours)],
    ["Total Overtime Pay", numberFormatter.format(viewModel.summary.totalOvertimePayAmount)],
    ["Total Tardiness Deduction", numberFormatter.format(viewModel.summary.totalTardinessDeductionAmount)],
    [],
  ]
  const lateDateColumns = buildLateDateColumns(viewModel.topEmployeesByLate)
  const overtimeDateColumns = buildOvertimeDateColumns(viewModel.topEmployeesByOvertime)

  const employeeLateRows: string[][] = [
    ["Top Employees by Late"],
    [
      "Employee Number",
      "Employee Name",
      "Department",
      ...lateDateColumns.map((column) => column.dateLabel),
      "Late Minutes",
      "Late Deduction",
    ],
    ...viewModel.topEmployeesByLate.map((row) => {
      const lateDailyBreakdown = Array.isArray(row.lateDailyBreakdown) ? row.lateDailyBreakdown : []
      const lateMinsByDate = new Map(lateDailyBreakdown.map((entry) => [entry.dateValue, entry.lateMins]))
      return [
        row.employeeNumber,
        row.employeeName,
        row.departmentName ?? "UNASSIGNED",
        ...lateDateColumns.map((column) => {
          const lateMins = lateMinsByDate.get(column.dateValue)
          return lateMins && lateMins > 0 ? String(lateMins) : "-"
        }),
        String(row.lateMins),
        numberFormatter.format(row.tardinessDeductionAmount),
      ]
    }),
    [],
  ]

  const employeeOvertimeRows: string[][] = [
    ["Top Employees by Overtime"],
    [
      "Employee Number",
      "Employee Name",
      "Department",
      ...overtimeDateColumns.map((column) => column.dateLabel),
      "OT Hours",
      "OT Pay",
    ],
    ...viewModel.topEmployeesByOvertime.map((row) => {
      const overtimeDailyBreakdown = Array.isArray(row.overtimeDailyBreakdown) ? row.overtimeDailyBreakdown : []
      const overtimeHoursByDate = new Map(
        overtimeDailyBreakdown.map((entry) => [entry.dateValue, entry.overtimeHours])
      )
      return [
        row.employeeNumber,
        row.employeeName,
        row.departmentName ?? "UNASSIGNED",
        ...overtimeDateColumns.map((column) => {
          const overtimeHours = overtimeHoursByDate.get(column.dateValue)
          return overtimeHours && overtimeHours > 0 ? numberFormatter.format(overtimeHours) : "-"
        }),
        numberFormatter.format(row.overtimeHours),
        numberFormatter.format(row.overtimePayAmount),
      ]
    }),
    [],
  ]

  const departmentLateRows: string[][] = [
    ["Top Departments by Late"],
    ["Department", "Headcount", "Late Minutes", "Late Days", "Late Deduction"],
    ...viewModel.topDepartmentsByLate.map((row) => [
      row.departmentName,
      String(row.employeeCount),
      String(row.lateMins),
      String(row.lateDays ?? 0),
      numberFormatter.format(row.tardinessDeductionAmount),
    ]),
    [],
  ]

  const departmentOvertimeRows: string[][] = [
    ["Top Departments by Overtime"],
    ["Department", "Headcount", "OT Hours", "OT Days", "OT Pay"],
    ...viewModel.topDepartmentsByOvertime.map((row) => [
      row.departmentName,
      String(row.employeeCount),
      numberFormatter.format(row.overtimeHours),
      String(row.overtimeDays ?? 0),
      numberFormatter.format(row.overtimePayAmount),
    ]),
  ]

  if (section === "employees-late") {
    return [...baseRows, ...employeeLateRows]
  }
  if (section === "employees-overtime") {
    return [...baseRows, ...employeeOvertimeRows]
  }
  if (section === "departments-late") {
    return [...baseRows, ...departmentLateRows]
  }
  if (section === "departments-overtime") {
    return [...baseRows, ...departmentOvertimeRows]
  }

  return [...baseRows, ...employeeLateRows, ...employeeOvertimeRows, ...departmentLateRows, ...departmentOvertimeRows]
}

export const getLateOvertimeCsvRows = buildLateOvertimeCsvRows

export async function getLateOvertimeReportWorkspaceViewModel(
  input: LateOvertimeInput
): Promise<LateOvertimeReportWorkspaceViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const topN = parseTopN(input.topN)

  const latestRegularRun = await db.payrollRun.findFirst({
    where: {
      companyId: context.companyId,
      runTypeCode: PayrollRunType.REGULAR,
      isTrialRun: false,
    },
    select: {
      payPeriod: {
        select: {
          cutoffStartDate: true,
          cutoffEndDate: true,
        },
      },
    },
    orderBy: [{ payPeriod: { cutoffEndDate: "desc" } }, { createdAt: "desc" }],
  })

  const defaultStartUtcDateOnly = latestRegularRun?.payPeriod.cutoffStartDate ?? toPhDateOnlyUtc()
  const defaultEndUtcDateOnly = latestRegularRun?.payPeriod.cutoffEndDate ?? defaultStartUtcDateOnly
  const normalizedRange = normalizeReportDateRange({
    startDate: input.startDate,
    endDate: input.endDate,
  })

  let selectedStartUtcDateOnly = defaultStartUtcDateOnly
  let selectedEndUtcDateOnly = defaultEndUtcDateOnly
  if (normalizedRange.ok) {
    if (normalizedRange.startUtcDateOnly) {
      selectedStartUtcDateOnly = normalizedRange.startUtcDateOnly
    }
    if (normalizedRange.endUtcDateOnly) {
      selectedEndUtcDateOnly = normalizedRange.endUtcDateOnly
    }
  }
  if (selectedStartUtcDateOnly.getTime() > selectedEndUtcDateOnly.getTime()) {
    selectedEndUtcDateOnly = selectedStartUtcDateOnly
  }

  const selectedStartDateValue = toPhDateInputValue(selectedStartUtcDateOnly)
  const selectedEndDateValue = toPhDateInputValue(selectedEndUtcDateOnly)
  const selectedPeriodLabel = toReportDateRangeLabel(selectedStartUtcDateOnly, selectedEndUtcDateOnly)

  const [payslipRows, approvedOvertimeRequests] = await Promise.all([
    db.payslip.findMany({
      where: {
        payrollRun: {
          companyId: context.companyId,
          runTypeCode: PayrollRunType.REGULAR,
          isTrialRun: false,
          payPeriod: {
            cutoffStartDate: { lte: selectedEndUtcDateOnly },
            cutoffEndDate: { gte: selectedStartUtcDateOnly },
          },
        },
      },
      select: {
        departmentSnapshotId: true,
        departmentSnapshotName: true,
        tardinessMins: true,
        overtimeHours: true,
        earnings: {
          select: {
            amount: true,
            description: true,
            earningType: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
        deductions: {
          select: {
            amount: true,
            description: true,
            deductionType: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            departmentId: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
        payrollRun: {
          select: {
            payPeriodId: true,
            runNumber: true,
            createdAt: true,
            runTypeCode: true,
            isTrialRun: true,
          },
        },
      },
      orderBy: [{ payrollRun: { createdAt: "desc" } }],
    }),
    db.overtimeRequest.findMany({
      where: {
        statusCode: RequestStatus.APPROVED,
        overtimeDate: {
          gte: selectedStartUtcDateOnly,
          lte: selectedEndUtcDateOnly,
        },
        employee: {
          companyId: context.companyId,
        },
      },
      select: {
        employeeId: true,
        overtimeDate: true,
        hours: true,
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
            departmentId: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ overtimeDate: "asc" }, { createdAt: "asc" }],
    }),
  ])

  const sourceRows: LateOvertimeSourcePayslipRow[] = payslipRows.map((row) => {
    const overtimePayAmount = row.earnings.reduce((sum, line) => {
      const description = line.description ?? line.earningType.name
      if (!isOvertimeEarningLine({ code: line.earningType.code, description })) {
        return sum
      }
      return sum + toNumber(line.amount)
    }, 0)

    const tardinessDeductionAmount = row.deductions.reduce((sum, line) => {
      const description = line.description ?? line.deductionType.name
      if (!isTardinessDeductionLine({ code: line.deductionType.code, description })) {
        return sum
      }
      return sum + toNumber(line.amount)
    }, 0)

    return {
      employeeId: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      employeeName: `${row.employee.lastName}, ${row.employee.firstName}`,
      departmentId: row.departmentSnapshotId ?? row.employee.departmentId,
      departmentName: row.departmentSnapshotName ?? row.employee.department?.name ?? null,
      payPeriodId: row.payrollRun.payPeriodId,
      runNumber: row.payrollRun.runNumber,
      runCreatedAt: row.payrollRun.createdAt,
      runTypeCode: row.payrollRun.runTypeCode,
      isTrialRun: row.payrollRun.isTrialRun,
      lateMins: row.tardinessMins,
      overtimeHours: toNumber(row.overtimeHours),
      overtimePayAmount,
      tardinessDeductionAmount,
    }
  })

  const selectedRows = sourceRows
  const summaryTotals = summarizeLateOvertimeRows(selectedRows)
  const employeeRows = aggregateLateOvertimeEmployeeRows(selectedRows)
  const departmentRows = aggregateLateOvertimeDepartmentRows(selectedRows)

  const lateBreakdownByEmployee = new Map<
    string,
    Map<string, { dateValue: string; dateLabel: string; lateMins: number }>
  >()
  const overtimeBreakdownByEmployee = new Map<
    string,
    Map<string, { dateValue: string; dateLabel: string; overtimeHours: number }>
  >()
  const employeeDepartmentKeyById = new Map<string, string>()
  const employeeIdentityById = new Map<
    string,
    { employeeNumber: string; employeeName: string; departmentName: string | null; departmentId: string | null }
  >()
  const lateDaysByDepartmentKey = new Map<string, number>()
  const overtimeDaysByDepartmentKey = new Map<string, number>()
  for (const row of sourceRows) {
    if (employeeDepartmentKeyById.has(row.employeeId)) continue
    employeeDepartmentKeyById.set(row.employeeId, row.departmentId ?? "__UNASSIGNED__")
    employeeIdentityById.set(row.employeeId, {
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      departmentName: row.departmentName,
      departmentId: row.departmentId,
    })
  }
  for (const overtime of approvedOvertimeRequests) {
    if (employeeDepartmentKeyById.has(overtime.employeeId)) continue
    employeeDepartmentKeyById.set(overtime.employeeId, overtime.employee.departmentId ?? "__UNASSIGNED__")
    employeeIdentityById.set(overtime.employeeId, {
      employeeNumber: overtime.employee.employeeNumber,
      employeeName: `${overtime.employee.lastName}, ${overtime.employee.firstName}`,
      departmentName: overtime.employee.department?.name ?? null,
      departmentId: overtime.employee.departmentId,
    })
  }
  if (employeeRows.length > 0) {
    const dtrRows = await db.dailyTimeRecord.findMany({
      where: {
        employeeId: { in: employeeRows.map((row) => row.employeeId) },
        attendanceDate: {
          gte: selectedStartUtcDateOnly,
          lte: selectedEndUtcDateOnly,
        },
        tardinessMins: { gt: 0 },
      },
      select: {
        employeeId: true,
        attendanceDate: true,
        tardinessMins: true,
      },
      orderBy: [{ attendanceDate: "asc" }],
    })

    for (const row of dtrRows) {
      const departmentKey = employeeDepartmentKeyById.get(row.employeeId) ?? "__UNASSIGNED__"
      if (row.tardinessMins > 0) {
        const dateValue = toPhDateInputValue(row.attendanceDate)
        if (dateValue) {
          const existingByDate = lateBreakdownByEmployee.get(row.employeeId)
          const dateLabel = toDayColumnLabel(row.attendanceDate)
          if (existingByDate) {
            const existing = existingByDate.get(dateValue)
            if (existing) {
              existing.lateMins += row.tardinessMins
            } else {
              existingByDate.set(dateValue, {
                dateValue,
                dateLabel,
                lateMins: row.tardinessMins,
              })
            }
          } else {
            lateBreakdownByEmployee.set(
              row.employeeId,
              new Map([
                [
                  dateValue,
                  {
                    dateValue,
                    dateLabel,
                    lateMins: row.tardinessMins,
                  },
                ],
              ])
            )
          }
        }
        lateDaysByDepartmentKey.set(departmentKey, (lateDaysByDepartmentKey.get(departmentKey) ?? 0) + 1)
      }
    }
  }

  const approvedOvertimeHoursByEmployee = new Map<string, number>()
  const approvedOvertimeHoursByDepartmentKey = new Map<string, number>()
  const overtimeDayKeysByDepartment = new Map<string, Set<string>>()
  for (const overtime of approvedOvertimeRequests) {
    const overtimeHours = toNumber(overtime.hours)
    if (overtimeHours <= 0) continue

    const dateValue = toPhDateInputValue(overtime.overtimeDate)
    if (!dateValue) continue

    const dateLabel = toDayColumnLabel(overtime.overtimeDate)
    const departmentKey = employeeDepartmentKeyById.get(overtime.employeeId) ?? "__UNASSIGNED__"

    const existingByDate = overtimeBreakdownByEmployee.get(overtime.employeeId)
    if (existingByDate) {
      const existing = existingByDate.get(dateValue)
      if (existing) {
        existing.overtimeHours += overtimeHours
      } else {
        existingByDate.set(dateValue, {
          dateValue,
          dateLabel,
          overtimeHours,
        })
      }
    } else {
      overtimeBreakdownByEmployee.set(
        overtime.employeeId,
        new Map([
          [
            dateValue,
            {
              dateValue,
              dateLabel,
              overtimeHours,
            },
          ],
        ])
      )
    }

    approvedOvertimeHoursByEmployee.set(
      overtime.employeeId,
      roundValue((approvedOvertimeHoursByEmployee.get(overtime.employeeId) ?? 0) + overtimeHours)
    )
    approvedOvertimeHoursByDepartmentKey.set(
      departmentKey,
      roundValue((approvedOvertimeHoursByDepartmentKey.get(departmentKey) ?? 0) + overtimeHours)
    )

    const overtimeDaySet = overtimeDayKeysByDepartment.get(departmentKey) ?? new Set<string>()
    overtimeDaySet.add(`${overtime.employeeId}:${dateValue}`)
    overtimeDayKeysByDepartment.set(departmentKey, overtimeDaySet)
  }

  for (const [departmentKey, overtimeDaySet] of overtimeDayKeysByDepartment.entries()) {
    overtimeDaysByDepartmentKey.set(departmentKey, overtimeDaySet.size)
  }

  const employeeRowsById = new Map(
    employeeRows.map((row) => [
      row.employeeId,
      {
        ...row,
        overtimeHours: 0,
      },
    ])
  )
  for (const [employeeId, approvedHours] of approvedOvertimeHoursByEmployee.entries()) {
    const existing = employeeRowsById.get(employeeId)
    if (existing) {
      existing.overtimeHours = approvedHours
      continue
    }

    const identity = employeeIdentityById.get(employeeId)
    if (!identity) continue
    employeeRowsById.set(employeeId, {
      employeeId,
      employeeNumber: identity.employeeNumber,
      employeeName: identity.employeeName,
      departmentName: identity.departmentName,
      lateMins: 0,
      overtimeHours: approvedHours,
      overtimePayAmount: 0,
      tardinessDeductionAmount: 0,
    })
  }
  const employeeRowsWithApprovedOvertime = Array.from(employeeRowsById.values())

  const overtimeEmployeeIdsByDepartment = new Map<string, Set<string>>()
  for (const overtime of approvedOvertimeRequests) {
    const departmentKey = employeeDepartmentKeyById.get(overtime.employeeId) ?? "__UNASSIGNED__"
    const employeeIds = overtimeEmployeeIdsByDepartment.get(departmentKey) ?? new Set<string>()
    employeeIds.add(overtime.employeeId)
    overtimeEmployeeIdsByDepartment.set(departmentKey, employeeIds)
  }

  const departmentRowsById = new Map(
    (departmentRows ?? []).map((row) => [
      row.departmentId ?? "__UNASSIGNED__",
      {
        ...row,
        overtimeHours: 0,
      },
    ])
  )
  for (const [departmentKey, approvedHours] of approvedOvertimeHoursByDepartmentKey.entries()) {
    const existing = departmentRowsById.get(departmentKey)
    if (existing) {
      existing.overtimeHours = approvedHours
      existing.employeeCount = Math.max(
        existing.employeeCount,
        overtimeEmployeeIdsByDepartment.get(departmentKey)?.size ?? existing.employeeCount
      )
      continue
    }

    const sampleEmployee = Array.from(employeeIdentityById.values()).find(
      (employee) => (employee.departmentId ?? "__UNASSIGNED__") === departmentKey
    )
    departmentRowsById.set(departmentKey, {
      departmentId: departmentKey === "__UNASSIGNED__" ? null : departmentKey,
      departmentName: sampleEmployee?.departmentName ?? "UNASSIGNED",
      employeeCount: overtimeEmployeeIdsByDepartment.get(departmentKey)?.size ?? 1,
      lateMins: 0,
      overtimeHours: approvedHours,
      overtimePayAmount: 0,
      tardinessDeductionAmount: 0,
    })
  }
  const departmentRowsWithApprovedOvertime = Array.from(departmentRowsById.values())
  const totalOvertimeHoursFromApprovedRequests = roundValue(
    Array.from(approvedOvertimeHoursByEmployee.values()).reduce((sum, value) => sum + value, 0)
  )

  const withBreakdowns = (row: {
    employeeId: string
    employeeNumber: string
    employeeName: string
    departmentName: string | null
    lateMins: number
    overtimeHours: number
    overtimePayAmount: number
    tardinessDeductionAmount: number
  }): LateOvertimeTopEmployeeRow => {
    const lateBreakdown = Array.from(lateBreakdownByEmployee.get(row.employeeId)?.values() ?? []).sort((a, b) =>
      a.dateValue.localeCompare(b.dateValue)
    )
    const overtimeBreakdown = Array.from(overtimeBreakdownByEmployee.get(row.employeeId)?.values() ?? []).sort(
      (a, b) => a.dateValue.localeCompare(b.dateValue)
    )
    return {
      ...row,
      lateDays: lateBreakdown.length,
      lateBreakdownLabel: toLateBreakdownLabel(lateBreakdown),
      lateDailyBreakdown: lateBreakdown,
      overtimeDays: overtimeBreakdown.length,
      overtimeBreakdownLabel: toOvertimeBreakdownLabel(overtimeBreakdown),
      overtimeDailyBreakdown: overtimeBreakdown,
    }
  }

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    summary: {
      startDateValue: selectedStartDateValue,
      endDateValue: selectedEndDateValue,
      periodLabel: selectedPeriodLabel,
      totalLateMins: summaryTotals.totalLateMins,
      totalOvertimeHours: totalOvertimeHoursFromApprovedRequests,
      totalOvertimePayAmount: summaryTotals.totalOvertimePayAmount,
      totalTardinessDeductionAmount: summaryTotals.totalTardinessDeductionAmount,
    },
    topEmployeesByLate: rankTopEmployeesByLate(employeeRows, topN).map(withBreakdowns),
    topEmployeesByOvertime: rankTopEmployeesByOvertime(
      employeeRowsWithApprovedOvertime.filter((row) => row.overtimeHours > 0),
      topN
    ).map(withBreakdowns),
    topDepartmentsByLate: rankTopDepartmentsByLate(departmentRows, topN).map((row) => ({
      ...row,
      lateDays: lateDaysByDepartmentKey.get(row.departmentId ?? "__UNASSIGNED__") ?? 0,
      overtimeDays: overtimeDaysByDepartmentKey.get(row.departmentId ?? "__UNASSIGNED__") ?? 0,
    })),
    topDepartmentsByOvertime: rankTopDepartmentsByOvertime(
      departmentRowsWithApprovedOvertime.filter((row) => row.overtimeHours > 0),
      topN
    ).map((row) => ({
      ...row,
      lateDays: lateDaysByDepartmentKey.get(row.departmentId ?? "__UNASSIGNED__") ?? 0,
      overtimeDays: overtimeDaysByDepartmentKey.get(row.departmentId ?? "__UNASSIGNED__") ?? 0,
    })),
    filters: {
      startDate: selectedStartDateValue,
      endDate: selectedEndDateValue,
      topN,
    },
    generatedAtLabel: toDateTimeLabel(new Date()),
  }
}
