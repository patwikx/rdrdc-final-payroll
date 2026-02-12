import { DtrApprovalStatus, RequestStatus, type Prisma } from "@prisma/client"

import { db } from "@/lib/db"

type PayrollRunWithRelations = Prisma.PayrollRunGetPayload<{
  include: {
    payPeriod: {
      include: {
        pattern: true
      }
    }
    processSteps: true
  }
}>

type PayrollRunFilters = {
  departmentIds: string[]
  branchIds: string[]
  employeeIds: string[]
}

type EmployeeDtrSummary = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  totalDaysInPeriod: number
  missingDays: number
  incompleteDays: number
  absentDays: number
  presentDays: number
  overtimeHours: number
  ctoConversionHours: number
  ctoConversionEntries: number
  tardinessMins: number
  undertimeMins: number
}

export type PayrollRunValidationResult = {
  errors: string[]
  warnings: string[]
  employeeCount: number
  dtrSummary: {
    employeesWithMissingDtr: number
    employeesWithIncompleteDtr: number
    totalMissingDays: number
    totalIncompleteDays: number
      totalAbsentDays: number
      totalPresentDays: number
      totalOvertimeHours: number
      totalCtoConversionHours: number
      employeesWithCtoConversions: number
      details: EmployeeDtrSummary[]
  }
  prePayrollReport: {
    missingWorkScheduleCount: number
    unresolvedLeaveCount: number
    overtimeWithoutApprovalCount: number
    pendingOvertimeRequestCount: number
  }
}

const toNumber = (value: Prisma.Decimal | null | undefined): number => {
  if (!value) return 0
  return Number(value)
}

const toDateKey = (value: Date): string => {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
  return formatted
}

const dayName = (value: Date): string => {
  const name = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Manila",
  }).format(value)
  return name.toUpperCase()
}

const getDateRange = (start: Date, end: Date): Date[] => {
  const startKey = toDateKey(start)
  const endKey = toDateKey(end)

  const [sY, sM, sD] = startKey.split("-").map((value) => Number(value))
  const [eY, eM, eD] = endKey.split("-").map((value) => Number(value))

  const cursor = new Date(Date.UTC(sY, sM - 1, sD))
  const last = new Date(Date.UTC(eY, eM - 1, eD))

  const dates: Date[] = []
  while (cursor <= last) {
    dates.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

const activeRunStatuses = ["DRAFT", "VALIDATING", "PROCESSING", "COMPUTED", "FOR_REVIEW", "APPROVED", "FOR_PAYMENT"] as const

const unresolvedLeaveStatuses: RequestStatus[] = [
  RequestStatus.DRAFT,
  RequestStatus.PENDING,
  RequestStatus.SUPERVISOR_APPROVED,
  RequestStatus.FOR_CANCELLATION,
]

const pendingOvertimeStatuses: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.SUPERVISOR_APPROVED,
]

export async function validatePayrollRun(
  run: PayrollRunWithRelations,
  filters: PayrollRunFilters
): Promise<PayrollRunValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  if (run.payPeriod.statusCode !== "OPEN") {
    errors.push("Pay period is locked or not open.")
  }

  const concurrentRuns = await db.payrollRun.findMany({
    where: {
      payPeriodId: run.payPeriodId,
      companyId: run.companyId,
      id: { not: run.id },
      statusCode: { in: [...activeRunStatuses] },
    },
    select: {
      runNumber: true,
      statusCode: true,
    },
  })

  if (concurrentRuns.length > 0) {
    errors.push(
      `Concurrent payroll run detected for this period: ${concurrentRuns[0].runNumber} (${concurrentRuns[0].statusCode}).`
    )
  }

  const incompletePreviousSteps = run.processSteps
    .filter((step) => step.stepNumber < 2)
    .filter((step) => !step.isCompleted)

  if (incompletePreviousSteps.length > 0) {
    errors.push("Previous payroll steps are incomplete.")
  }

  if (!["DRAFT", "VALIDATING"].includes(run.statusCode)) {
    warnings.push(`Run status is currently ${run.statusCode}. Re-validation may overwrite prior notes.`)
  }

  const employeeWhere: Prisma.EmployeeWhereInput = {
    companyId: run.companyId,
    isActive: true,
    deletedAt: null,
    payPeriodPatternId: run.payPeriod.patternId,
  }

  if (filters.departmentIds.length > 0) employeeWhere.departmentId = { in: filters.departmentIds }
  if (filters.branchIds.length > 0) employeeWhere.branchId = { in: filters.branchIds }
  if (filters.employeeIds.length > 0) employeeWhere.id = { in: filters.employeeIds }

  const employees = await db.employee.findMany({
    where: employeeWhere,
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      isOvertimeEligible: true,
      payPeriodPatternId: true,
      workSchedule: {
        select: {
          id: true,
          restDays: true,
        },
      },
      salary: {
        select: {
          id: true,
          isActive: true,
        },
      },
    },
  })

  if (employees.length === 0) {
    errors.push("No eligible employees found for this payroll scope.")
  }

  for (const employee of employees) {
    if (!employee.salary || !employee.salary.isActive) {
      errors.push(`Employee ${employee.employeeNumber} has no active salary record.`)
    }

    if (!employee.workSchedule) {
      warnings.push(`Employee ${employee.employeeNumber} has no assigned work schedule.`)
    }

    if (!employee.payPeriodPatternId || employee.payPeriodPatternId !== run.payPeriod.patternId) {
      warnings.push(`Employee ${employee.employeeNumber} pay period pattern does not match the run pattern.`)
    }
  }

  const employeeIds = employees.map((employee) => employee.id)
  const [holidays, approvedLeaves, unresolvedLeaves, overtimeRequests, dtrRows, nonApprovedDtrCount] = await Promise.all([
    db.holiday.findMany({
      where: {
        holidayDate: { gte: run.payPeriod.cutoffStartDate, lte: run.payPeriod.cutoffEndDate },
        isActive: true,
        OR: [{ companyId: null }, { companyId: run.companyId }],
      },
      select: { holidayDate: true },
    }),
    db.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        statusCode: RequestStatus.APPROVED,
        startDate: { lte: run.payPeriod.cutoffEndDate },
        endDate: { gte: run.payPeriod.cutoffStartDate },
      },
      select: {
        employeeId: true,
        startDate: true,
        endDate: true,
      },
    }),
    db.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        statusCode: { in: unresolvedLeaveStatuses },
        startDate: { lte: run.payPeriod.cutoffEndDate },
        endDate: { gte: run.payPeriod.cutoffStartDate },
      },
      select: {
        id: true,
      },
    }),
    db.overtimeRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        overtimeDate: { gte: run.payPeriod.cutoffStartDate, lte: run.payPeriod.cutoffEndDate },
      },
      select: {
        employeeId: true,
        overtimeDate: true,
        hours: true,
        statusCode: true,
      },
    }),
    db.dailyTimeRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        attendanceDate: { gte: run.payPeriod.cutoffStartDate, lte: run.payPeriod.cutoffEndDate },
        approvalStatusCode: DtrApprovalStatus.APPROVED,
      },
      select: {
        employeeId: true,
        attendanceDate: true,
        attendanceStatus: true,
        actualTimeIn: true,
        actualTimeOut: true,
        overtimeHours: true,
        tardinessMins: true,
        undertimeMins: true,
      },
    }),
    db.dailyTimeRecord.count({
      where: {
        employeeId: { in: employeeIds },
        attendanceDate: { gte: run.payPeriod.cutoffStartDate, lte: run.payPeriod.cutoffEndDate },
        approvalStatusCode: { not: DtrApprovalStatus.APPROVED },
      },
    }),
  ])

  const holidayDates = new Set(holidays.map((holiday) => toDateKey(holiday.holidayDate)))

  const approvedLeaveRangesByEmployee = new Map<string, Array<{ startDate: Date; endDate: Date }>>()
  for (const leave of approvedLeaves) {
    const existing = approvedLeaveRangesByEmployee.get(leave.employeeId)
    if (existing) {
      existing.push({ startDate: leave.startDate, endDate: leave.endDate })
    } else {
      approvedLeaveRangesByEmployee.set(leave.employeeId, [{ startDate: leave.startDate, endDate: leave.endDate }])
    }
  }

  const approvedOvertimeByEmployeeDate = new Set<string>()
  const approvedOvertimeHoursByEmployeeDate = new Map<string, number>()
  const approvedOvertimeHoursByEmployee = new Map<string, number>()
  const approvedOvertimeEntriesByEmployee = new Map<string, number>()
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
  let pendingOvertimeRequestCount = 0
  for (const overtime of overtimeRequests) {
    const key = `${overtime.employeeId}:${toDateKey(overtime.overtimeDate)}`
    if (overtime.statusCode === RequestStatus.APPROVED) {
      approvedOvertimeByEmployeeDate.add(key)
      approvedOvertimeHoursByEmployeeDate.set(
        key,
        Math.round(((approvedOvertimeHoursByEmployeeDate.get(key) ?? 0) + toNumber(overtime.hours)) * 100) / 100
      )

      const employee = employeeById.get(overtime.employeeId)
      if (employee && !employee.isOvertimeEligible) {
        approvedOvertimeHoursByEmployee.set(
          overtime.employeeId,
          Math.round(((approvedOvertimeHoursByEmployee.get(overtime.employeeId) ?? 0) + toNumber(overtime.hours)) * 100) / 100
        )
        approvedOvertimeEntriesByEmployee.set(
          overtime.employeeId,
          (approvedOvertimeEntriesByEmployee.get(overtime.employeeId) ?? 0) + 1
        )
      }
    }
    if (pendingOvertimeStatuses.includes(overtime.statusCode)) {
      pendingOvertimeRequestCount += 1
    }
  }

  if (nonApprovedDtrCount > 0) {
    errors.push(
      `${nonApprovedDtrCount} DTR entr${nonApprovedDtrCount === 1 ? "y is" : "ies are"} pending/rejected. Approve all DTR records before payroll validation.`
    )
  }

  const dtrsByEmployeeId = new Map<string, typeof dtrRows>()
  for (const row of dtrRows) {
    const existing = dtrsByEmployeeId.get(row.employeeId)
    if (existing) {
      existing.push(row)
    } else {
      dtrsByEmployeeId.set(row.employeeId, [row])
    }
  }

  const datesInPeriod = getDateRange(run.payPeriod.cutoffStartDate, run.payPeriod.cutoffEndDate)
  const summaries: EmployeeDtrSummary[] = []
  let overtimeWithoutApprovalCount = 0

  for (const employee of employees) {
    const dtrs = dtrsByEmployeeId.get(employee.id) ?? []
    const dtrByDate = new Map(dtrs.map((row) => [toDateKey(row.attendanceDate), row]))
    const approvedLeavesForEmployee = approvedLeaveRangesByEmployee.get(employee.id) ?? []

    const restDays = (() => {
      if (!employee.workSchedule?.restDays || !Array.isArray(employee.workSchedule.restDays)) {
        return ["SATURDAY", "SUNDAY"]
      }

      return employee.workSchedule.restDays
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toUpperCase())
    })()

    let missingDays = 0
    let incompleteDays = 0
    let absentDays = 0
    let presentDays = 0
    let overtimeHours = 0
    let tardinessMins = 0
    let undertimeMins = 0

    for (const date of datesInPeriod) {
      const key = toDateKey(date)
      const dtr = dtrByDate.get(key)
      const isHoliday = holidayDates.has(key)
      const isRestDay = restDays.includes(dayName(date))

      const onApprovedLeave = approvedLeavesForEmployee.some((leave) => {
        const start = toDateKey(leave.startDate)
        const end = toDateKey(leave.endDate)
        return key >= start && key <= end
      })

      if (!dtr && !isHoliday && !isRestDay && !onApprovedLeave) {
        missingDays += 1
        continue
      }

      if (!dtr) {
        continue
      }

      if ((dtr.actualTimeIn && !dtr.actualTimeOut) || (!dtr.actualTimeIn && dtr.actualTimeOut)) {
        incompleteDays += 1
      }

      if (dtr.attendanceStatus === "ABSENT") absentDays += 1
      if (dtr.attendanceStatus === "PRESENT" || dtr.attendanceStatus === "HOLIDAY") presentDays += 1

      const approvedOvertimeHours = approvedOvertimeHoursByEmployeeDate.get(`${employee.id}:${key}`) ?? 0
      overtimeHours += approvedOvertimeHours
      tardinessMins += dtr.tardinessMins
      undertimeMins += dtr.undertimeMins

      if (toNumber(dtr.overtimeHours) > 0) {
        const overtimeKey = `${employee.id}:${key}`
        if (!approvedOvertimeByEmployeeDate.has(overtimeKey)) {
          overtimeWithoutApprovalCount += 1
        }
      }
    }

    summaries.push({
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      employeeName: `${employee.lastName}, ${employee.firstName}`,
      totalDaysInPeriod: datesInPeriod.length,
      missingDays,
      incompleteDays,
      absentDays,
      presentDays,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      ctoConversionHours: approvedOvertimeHoursByEmployee.get(employee.id) ?? 0,
      ctoConversionEntries: approvedOvertimeEntriesByEmployee.get(employee.id) ?? 0,
      tardinessMins,
      undertimeMins,
    })

    if (missingDays > 0) {
      warnings.push(`Employee ${employee.employeeNumber} has ${missingDays} missing DTR day(s).`)
    }
    if (incompleteDays > 0) {
      warnings.push(`Employee ${employee.employeeNumber} has ${incompleteDays} incomplete DTR day(s).`)
    }
  }

  if (unresolvedLeaves.length > 0) {
    warnings.push(`${unresolvedLeaves.length} unresolved leave request(s) overlap the payroll period.`)
  }

  if (pendingOvertimeRequestCount > 0) {
    warnings.push(`${pendingOvertimeRequestCount} pending overtime request(s) overlap the payroll period.`)
  }

  if (overtimeWithoutApprovalCount > 0) {
    warnings.push(`${overtimeWithoutApprovalCount} DTR overtime entr${overtimeWithoutApprovalCount === 1 ? "y" : "ies"} have no approved overtime request.`)
  }

  return {
    errors,
    warnings,
    employeeCount: employees.length,
    dtrSummary: {
      employeesWithMissingDtr: summaries.filter((summary) => summary.missingDays > 0).length,
      employeesWithIncompleteDtr: summaries.filter((summary) => summary.incompleteDays > 0).length,
      totalMissingDays: summaries.reduce((sum, summary) => sum + summary.missingDays, 0),
      totalIncompleteDays: summaries.reduce((sum, summary) => sum + summary.incompleteDays, 0),
      totalAbsentDays: summaries.reduce((sum, summary) => sum + summary.absentDays, 0),
      totalPresentDays: summaries.reduce((sum, summary) => sum + summary.presentDays, 0),
      totalOvertimeHours: Math.round(summaries.reduce((sum, summary) => sum + summary.overtimeHours, 0) * 100) / 100,
      totalCtoConversionHours: Math.round(summaries.reduce((sum, summary) => sum + summary.ctoConversionHours, 0) * 100) / 100,
      employeesWithCtoConversions: summaries.filter((summary) => summary.ctoConversionEntries > 0).length,
      details: summaries,
    },
    prePayrollReport: {
      missingWorkScheduleCount: employees.filter((employee) => !employee.workSchedule).length,
      unresolvedLeaveCount: unresolvedLeaves.length,
      overtimeWithoutApprovalCount,
      pendingOvertimeRequestCount,
    },
  }
}
