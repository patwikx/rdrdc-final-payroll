import { AttendanceStatus, PayrollRunStatus, RequestStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly, toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import type { DtrLogItem, LeaveOverlayItem, WorkbenchItem, WorkbenchStats } from "@/modules/attendance/dtr/types"
import { createWallClockDateTime, ensureEndAfterStart, formatWallClockTime } from "@/modules/attendance/dtr/utils/wall-clock"

type DateRangeInput = {
  payPeriodId?: string
  startDate?: string
  endDate?: string
}

const PENDING_REQUEST_STATUSES: RequestStatus[] = [RequestStatus.PENDING, RequestStatus.SUPERVISOR_APPROVED]
const OPEN_PAYROLL_RUN_STATUSES: PayrollRunStatus[] = [
  PayrollRunStatus.DRAFT,
  PayrollRunStatus.VALIDATING,
  PayrollRunStatus.PROCESSING,
  PayrollRunStatus.COMPUTED,
  PayrollRunStatus.FOR_REVIEW,
  PayrollRunStatus.APPROVED,
  PayrollRunStatus.FOR_PAYMENT,
]

const toPendingStatusLabel = (status: RequestStatus): string => {
  if (status === RequestStatus.SUPERVISOR_APPROVED) {
    return "Waiting HR approval"
  }

  return "Waiting supervisor approval"
}

export type DtrPageData = {
  companyId: string
  companyName: string
  logs: DtrLogItem[]
  stats: {
    totalEmployees: number
    presentToday: number
    absentToday: number
  }
  workbenchData: {
    items: WorkbenchItem[]
    stats: WorkbenchStats
  }
  leaveOverlays: LeaveOverlayItem[]
  payPeriodOptions: Array<{
    id: string
    label: string
    startDate: string
    endDate: string
    isCurrent: boolean
  }>
  filters: {
    payPeriodId: string | null
    startDate: string
    endDate: string
  }
}

const toIsoOrNull = (value: Date | null): string | null => (value ? value.toISOString() : null)
const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const

type WorkScheduleSnapshot = {
  workStartTime: Date
  workEndTime: Date
  gracePeriodMins: number
  dayOverrides: unknown
} | null

type DayOverride = {
  isWorkingDay?: boolean
  timeIn?: string
  timeOut?: string
}

const parseTimeOnAttendanceDate = (attendanceDate: Date, value: Date): Date | null => {
  const hhmm = formatWallClockTime(value)
  return hhmm ? createWallClockDateTime(attendanceDate, hhmm) : null
}

const getScheduleTimes = (
  attendanceDate: Date,
  workSchedule: WorkScheduleSnapshot
): { scheduledIn: Date | null; scheduledOut: Date | null } => {
  if (!workSchedule) {
    return { scheduledIn: null, scheduledOut: null }
  }

  const dayName = DAY_NAMES[new Date(attendanceDate).getUTCDay()]
  const overrides =
    workSchedule.dayOverrides && typeof workSchedule.dayOverrides === "object" && !Array.isArray(workSchedule.dayOverrides)
      ? (workSchedule.dayOverrides as Record<string, DayOverride>)
      : null
  const dayOverride = overrides?.[dayName]

  if (dayOverride?.isWorkingDay === false) {
    return { scheduledIn: null, scheduledOut: null }
  }

  if (dayOverride?.timeIn && dayOverride?.timeOut) {
    const scheduledIn = createWallClockDateTime(attendanceDate, dayOverride.timeIn)
    const scheduledOut = createWallClockDateTime(attendanceDate, dayOverride.timeOut)
    if (!scheduledIn || !scheduledOut) {
      return { scheduledIn: null, scheduledOut: null }
    }
    return { scheduledIn, scheduledOut: ensureEndAfterStart(scheduledIn, scheduledOut) }
  }

  const scheduledIn = parseTimeOnAttendanceDate(attendanceDate, workSchedule.workStartTime)
  const scheduledOut = parseTimeOnAttendanceDate(attendanceDate, workSchedule.workEndTime)
  if (!scheduledIn || !scheduledOut) {
    return { scheduledIn: null, scheduledOut: null }
  }
  return { scheduledIn, scheduledOut: ensureEndAfterStart(scheduledIn, scheduledOut) }
}

const computeScheduleBasedAttendanceMetrics = (log: {
  attendanceDate: Date
  actualTimeIn: Date | null
  actualTimeOut: Date | null
  scheduledTimeIn: Date | null
  scheduledTimeOut: Date | null
  tardinessMins: number
  undertimeMins: number
  overtimeHours: number
  employee: { workSchedule: WorkScheduleSnapshot }
}): { tardinessMins: number; undertimeMins: number; overtimeHours: number } => {
  if (!log.actualTimeIn && !log.actualTimeOut) {
    return { tardinessMins: 0, undertimeMins: 0, overtimeHours: 0 }
  }

  let scheduledOut: Date | null = null
  let scheduledIn: Date | null = null

  if (log.scheduledTimeOut) {
    scheduledOut = parseTimeOnAttendanceDate(log.attendanceDate, log.scheduledTimeOut)
    scheduledIn = log.scheduledTimeIn ? parseTimeOnAttendanceDate(log.attendanceDate, log.scheduledTimeIn) : null
  } else {
    const fromSchedule = getScheduleTimes(log.attendanceDate, log.employee.workSchedule)
    scheduledIn = fromSchedule.scheduledIn
    scheduledOut = fromSchedule.scheduledOut
  }

  if (!scheduledIn && !scheduledOut) {
    return {
      tardinessMins: log.tardinessMins,
      undertimeMins: log.undertimeMins,
      overtimeHours: log.overtimeHours,
    }
  }

  const normalizedScheduledOut = scheduledOut
    ? (
    scheduledIn ? ensureEndAfterStart(scheduledIn, scheduledOut) : log.actualTimeIn ? ensureEndAfterStart(log.actualTimeIn, scheduledOut) : scheduledOut
      )
    : null

  const normalizedActualOut = log.actualTimeIn && log.actualTimeOut
    ? ensureEndAfterStart(log.actualTimeIn, log.actualTimeOut)
    : log.actualTimeOut

  const gracePeriodMins = log.employee.workSchedule?.gracePeriodMins ?? 0
  const tardinessMins = scheduledIn && log.actualTimeIn
    ? Math.max(0, Math.round((log.actualTimeIn.getTime() - scheduledIn.getTime()) / (1000 * 60) - gracePeriodMins))
    : log.tardinessMins

  const undertimeMins = normalizedScheduledOut && normalizedActualOut
    ? Math.max(0, Math.round((normalizedScheduledOut.getTime() - normalizedActualOut.getTime()) / (1000 * 60)))
    : log.undertimeMins

  if (!normalizedScheduledOut || !normalizedActualOut) {
    return {
      tardinessMins,
      undertimeMins,
      overtimeHours: log.overtimeHours,
    }
  }

  const overtimeMinutes = (normalizedActualOut.getTime() - normalizedScheduledOut.getTime()) / (1000 * 60)
  const overtimeHours = overtimeMinutes > 0 ? Number((overtimeMinutes / 60).toFixed(2)) : 0

  return { tardinessMins, undertimeMins, overtimeHours }
}

export async function getDtrPageData(companyId: string, range?: DateRangeInput): Promise<DtrPageData> {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    throw new Error("ACCESS_DENIED")
  }

  const todayPh = toPhDateOnlyUtc()
  const payPeriods = await db.payPeriod.findMany({
    where: {
      pattern: { companyId: context.companyId },
      cutoffStartDate: { lte: todayPh },
    },
    orderBy: [{ cutoffStartDate: "desc" }],
    take: 24,
    select: {
      id: true,
      year: true,
      periodNumber: true,
      periodHalf: true,
      cutoffStartDate: true,
      cutoffEndDate: true,
    },
  })

  const openRegularPayrollRun = await db.payrollRun.findFirst({
    where: {
      companyId: context.companyId,
      isTrialRun: false,
      statusCode: { in: OPEN_PAYROLL_RUN_STATUSES },
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      payPeriodId: true,
    },
  })

  const openTrialPayrollRun = openRegularPayrollRun
    ? null
    : await db.payrollRun.findFirst({
        where: {
          companyId: context.companyId,
          statusCode: { in: OPEN_PAYROLL_RUN_STATUSES },
        },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          payPeriodId: true,
        },
      })

  const openPayrollRunPayPeriodId = openRegularPayrollRun?.payPeriodId ?? openTrialPayrollRun?.payPeriodId ?? null
  const openPayrollRunPayPeriod =
    (openPayrollRunPayPeriodId ? payPeriods.find((period) => period.id === openPayrollRunPayPeriodId) : null) ?? null
  const currentPayPeriod = payPeriods.find((period) => period.cutoffStartDate <= todayPh && period.cutoffEndDate >= todayPh) ?? null
  const latestPayPeriod = payPeriods[0] ?? null
  const defaultPayPeriod = openPayrollRunPayPeriod ?? currentPayPeriod ?? latestPayPeriod
  const hasExplicitCustomRange = Boolean(range?.startDate && range?.endDate && !range?.payPeriodId)
  const selectedPayPeriod =
    hasExplicitCustomRange
      ? null
      : (range?.payPeriodId ? payPeriods.find((period) => period.id === range.payPeriodId) : null) ??
        defaultPayPeriod

  const parsedStart = range?.startDate ? parsePhDateInputToUtcDateOnly(range.startDate) : null
  const parsedEnd = range?.endDate ? parsePhDateInputToUtcDateOnly(range.endDate) : null
  const rawStart = hasExplicitCustomRange
    ? parsedStart ?? new Date(todayPh.getTime() - 30 * 24 * 60 * 60 * 1000)
    : selectedPayPeriod?.cutoffStartDate ?? parsedStart ?? new Date(todayPh.getTime() - 30 * 24 * 60 * 60 * 1000)
  const rawEnd = hasExplicitCustomRange ? parsedEnd ?? todayPh : selectedPayPeriod?.cutoffEndDate ?? parsedEnd ?? todayPh
  const [startDate, endDate] = rawStart.getTime() <= rawEnd.getTime() ? [rawStart, rawEnd] : [rawEnd, rawStart]

  const [logs, leaves, activeEmployees, presentToday, pendingLeaveRequests, pendingOvertimeRequests, anomalies] = await Promise.all([
    db.dailyTimeRecord.findMany({
      where: {
        employee: { companyId: context.companyId },
        attendanceDate: { gte: startDate, lte: endDate },
      },
      orderBy: [{ attendanceDate: "desc" }],
      select: {
        id: true,
        employeeId: true,
        attendanceDate: true,
        scheduledTimeIn: true,
        scheduledTimeOut: true,
        actualTimeIn: true,
        actualTimeOut: true,
        hoursWorked: true,
        tardinessMins: true,
        undertimeMins: true,
        overtimeHours: true,
        nightDiffHours: true,
        attendanceStatus: true,
        approvalStatusCode: true,
        remarks: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            photoUrl: true,
            workSchedule: {
              select: {
                workStartTime: true,
                workEndTime: true,
                gracePeriodMins: true,
                dayOverrides: true,
              },
            },
          },
        },
      },
    }),
    db.leaveRequest.findMany({
      where: {
        employee: { companyId: context.companyId },
        statusCode: RequestStatus.APPROVED,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        isHalfDay: true,
        halfDayPeriod: true,
        leaveType: { select: { name: true, code: true, isPaid: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            photoUrl: true,
          },
        },
      },
    }),
    db.employee.count({ where: { companyId: context.companyId, isActive: true, deletedAt: null } }),
    db.dailyTimeRecord.count({
      where: {
        employee: { companyId: context.companyId },
        attendanceDate: todayPh,
        attendanceStatus: AttendanceStatus.PRESENT,
      },
    }),
    db.leaveRequest.findMany({
      where: {
        employee: { companyId: context.companyId },
        statusCode: { in: PENDING_REQUEST_STATUSES },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        requestNumber: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        reason: true,
        statusCode: true,
        leaveType: {
          select: {
            name: true,
          },
        },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
      },
    }),
    db.overtimeRequest.findMany({
      where: {
        employee: { companyId: context.companyId },
        statusCode: { in: PENDING_REQUEST_STATUSES },
        overtimeDate: { gte: startDate, lte: endDate },
      },
      orderBy: [{ overtimeDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        requestNumber: true,
        employeeId: true,
        overtimeDate: true,
        hours: true,
        reason: true,
        statusCode: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
      },
    }),
    db.dailyTimeRecord.findMany({
      where: {
        employee: { companyId: context.companyId },
        attendanceDate: { gte: startDate, lte: endDate },
        OR: [
          { actualTimeIn: null },
          { actualTimeOut: null },
        ],
      },
      take: 100,
      orderBy: [{ attendanceDate: "desc" }],
      select: {
        id: true,
        employeeId: true,
        attendanceDate: true,
        scheduledTimeIn: true,
        scheduledTimeOut: true,
        actualTimeIn: true,
        actualTimeOut: true,
        hoursWorked: true,
        tardinessMins: true,
        undertimeMins: true,
        overtimeHours: true,
        nightDiffHours: true,
        attendanceStatus: true,
        approvalStatusCode: true,
        remarks: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            photoUrl: true,
            workSchedule: {
              select: {
                workStartTime: true,
                workEndTime: true,
                gracePeriodMins: true,
                dayOverrides: true,
              },
            },
          },
        },
      },
    }),
  ])

  const mappedLogs: DtrLogItem[] = logs.map((log) => {
    const computedMetrics = computeScheduleBasedAttendanceMetrics({
      attendanceDate: log.attendanceDate,
      actualTimeIn: log.actualTimeIn,
      actualTimeOut: log.actualTimeOut,
      scheduledTimeIn: log.scheduledTimeIn,
      scheduledTimeOut: log.scheduledTimeOut,
      tardinessMins: log.tardinessMins,
      undertimeMins: log.undertimeMins,
      overtimeHours: Number(log.overtimeHours ?? 0),
      employee: {
        workSchedule: log.employee.workSchedule,
      },
    })

    return {
      id: log.id,
      employeeId: log.employeeId,
      attendanceDate: log.attendanceDate.toISOString(),
      scheduledTimeIn: toIsoOrNull(log.scheduledTimeIn),
      scheduledTimeOut: toIsoOrNull(log.scheduledTimeOut),
      actualTimeIn: toIsoOrNull(log.actualTimeIn),
      actualTimeOut: toIsoOrNull(log.actualTimeOut),
      hoursWorked: Number(log.hoursWorked ?? 0),
      tardinessMins: computedMetrics.tardinessMins,
      undertimeMins: computedMetrics.undertimeMins,
      overtimeHours: computedMetrics.overtimeHours,
      nightDiffHours: Number(log.nightDiffHours ?? 0),
      attendanceStatus: log.attendanceStatus,
      approvalStatusCode: log.approvalStatusCode,
      remarks: log.remarks,
      employee: {
        id: log.employee.id,
        firstName: log.employee.firstName,
        lastName: log.employee.lastName,
        employeeNumber: log.employee.employeeNumber,
        photoUrl: log.employee.photoUrl,
      },
    }
  })

  const mappedLeaves: LeaveOverlayItem[] = leaves.map((leave) => ({
    id: leave.id,
    employeeId: leave.employeeId,
    startDate: leave.startDate.toISOString(),
    endDate: leave.endDate.toISOString(),
    isHalfDay: leave.isHalfDay,
    halfDayPeriod: leave.halfDayPeriod,
    leaveType: {
      name: leave.leaveType.name,
      code: leave.leaveType.code,
      isPaid: leave.leaveType.isPaid,
    },
    employee: {
      id: leave.employee.id,
      firstName: leave.employee.firstName,
      lastName: leave.employee.lastName,
      employeeNumber: leave.employee.employeeNumber,
      photoUrl: leave.employee.photoUrl,
    },
  }))

  const anomalyWorkbenchItems: WorkbenchItem[] = anomalies.map((log) => {
    const computedMetrics = computeScheduleBasedAttendanceMetrics({
      attendanceDate: log.attendanceDate,
      actualTimeIn: log.actualTimeIn,
      actualTimeOut: log.actualTimeOut,
      scheduledTimeIn: log.scheduledTimeIn,
      scheduledTimeOut: log.scheduledTimeOut,
      tardinessMins: log.tardinessMins,
      undertimeMins: log.undertimeMins,
      overtimeHours: Number(log.overtimeHours ?? 0),
      employee: {
        workSchedule: log.employee.workSchedule,
      },
    })

    const missingIn = !log.actualTimeIn
    const missingOut = !log.actualTimeOut
    const details = missingIn && missingOut
      ? "Missing clock-in and clock-out"
      : missingIn
        ? "Missing clock-in"
        : "Missing clock-out"

    return {
      id: `WB-${log.id}`,
      employeeId: log.employeeId,
      employeeName: `${log.employee.lastName}, ${log.employee.firstName}`,
      employeeNumber: log.employee.employeeNumber,
      date: log.attendanceDate.toISOString(),
      type: "MISSING_LOG",
      status: "ANOMALY",
      details,
      data: {
        id: log.id,
        employeeId: log.employeeId,
        attendanceDate: log.attendanceDate.toISOString(),
        scheduledTimeIn: toIsoOrNull(log.scheduledTimeIn),
        scheduledTimeOut: toIsoOrNull(log.scheduledTimeOut),
        actualTimeIn: toIsoOrNull(log.actualTimeIn),
        actualTimeOut: toIsoOrNull(log.actualTimeOut),
        hoursWorked: Number(log.hoursWorked ?? 0),
        tardinessMins: computedMetrics.tardinessMins,
        undertimeMins: computedMetrics.undertimeMins,
        overtimeHours: computedMetrics.overtimeHours,
        nightDiffHours: Number(log.nightDiffHours ?? 0),
        attendanceStatus: log.attendanceStatus,
        approvalStatusCode: log.approvalStatusCode,
        remarks: log.remarks,
        employee: {
          id: log.employee.id,
          firstName: log.employee.firstName,
          lastName: log.employee.lastName,
          employeeNumber: log.employee.employeeNumber,
          photoUrl: log.employee.photoUrl,
        },
      },
    }
  })

  const pendingLeaveItems: WorkbenchItem[] = pendingLeaveRequests.map((request) => {
    const startLabel = toPhDateInputValue(request.startDate)
    const endLabel = toPhDateInputValue(request.endDate)
    const dateRangeLabel = startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`

    return {
      id: `WB-LEAVE-${request.id}`,
      employeeId: request.employeeId,
      employeeName: `${request.employee.lastName}, ${request.employee.firstName}`,
      employeeNumber: request.employee.employeeNumber,
      date: request.startDate.toISOString(),
      type: "LEAVE_REQUEST",
      status: "PENDING",
      pendingStage: request.statusCode === RequestStatus.SUPERVISOR_APPROVED ? "HR" : "SUPERVISOR",
      details: `${request.leaveType.name} • ${dateRangeLabel} • ${toPendingStatusLabel(request.statusCode)}`,
      requestId: request.id,
      referenceId: request.requestNumber,
      requestTypeLabel: request.leaveType.name,
      requestReason: request.reason,
    }
  })

  const pendingOvertimeItems: WorkbenchItem[] = pendingOvertimeRequests.map((request) => {
    const requestedHours = Number(request.hours)
    const requestedHoursLabel = Number.isFinite(requestedHours) ? `${requestedHours.toFixed(2)}h` : "-"

    return {
      id: `WB-OT-${request.id}`,
      employeeId: request.employeeId,
      employeeName: `${request.employee.lastName}, ${request.employee.firstName}`,
      employeeNumber: request.employee.employeeNumber,
      date: request.overtimeDate.toISOString(),
      type: "OT_REQUEST",
      status: "PENDING",
      pendingStage: request.statusCode === RequestStatus.SUPERVISOR_APPROVED ? "HR" : "SUPERVISOR",
      details: `${requestedHoursLabel} • ${toPendingStatusLabel(request.statusCode)}`,
      requestId: request.id,
      referenceId: request.requestNumber,
      requestTypeLabel: "Overtime Request",
      requestReason: request.reason,
    }
  })

  const workbenchItems: WorkbenchItem[] = [...anomalyWorkbenchItems, ...pendingLeaveItems, ...pendingOvertimeItems].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  )

  const pendingLeaves = pendingLeaveRequests.length
  const pendingOTs = pendingOvertimeRequests.length
  const anomalyCount = anomalyWorkbenchItems.length
  const readinessScore = Math.max(0, Math.min(100, Math.round(100 - anomalyCount * 3 - pendingLeaves * 2 - pendingOTs * 2)))

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    logs: mappedLogs,
    stats: {
      totalEmployees: activeEmployees,
      presentToday,
      absentToday: Math.max(0, activeEmployees - presentToday),
    },
    workbenchData: {
      items: workbenchItems,
      stats: {
        pendingLeaves,
        pendingOTs,
        missingLogs: anomalyCount,
        absences: 0,
        readinessScore,
      },
    },
    leaveOverlays: mappedLeaves,
    payPeriodOptions: payPeriods.map((period) => ({
      id: period.id,
      label: `${toPhDateInputValue(period.cutoffStartDate)} to ${toPhDateInputValue(period.cutoffEndDate)}`,
      startDate: toPhDateInputValue(period.cutoffStartDate),
      endDate: toPhDateInputValue(period.cutoffEndDate),
      isCurrent: Boolean(defaultPayPeriod && period.id === defaultPayPeriod.id),
    })),
    filters: {
      payPeriodId: hasExplicitCustomRange ? null : selectedPayPeriod?.id ?? null,
      startDate: toPhDateInputValue(startDate),
      endDate: toPhDateInputValue(endDate),
    },
  }
}
