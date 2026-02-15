import { AttendanceStatus, RequestStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly, toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import type { DtrLogItem, LeaveOverlayItem, WorkbenchItem, WorkbenchStats } from "@/modules/attendance/dtr/types"

type DateRangeInput = {
  startDate?: string
  endDate?: string
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
  filters: {
    startDate: string
    endDate: string
  }
}

const toIsoOrNull = (value: Date | null): string | null => (value ? value.toISOString() : null)

export async function getDtrPageData(companyId: string, range?: DateRangeInput): Promise<DtrPageData> {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    throw new Error("ACCESS_DENIED")
  }

  const todayPh = toPhDateOnlyUtc()
  const defaultStart = new Date(todayPh.getTime() - 30 * 24 * 60 * 60 * 1000)
  const parsedStart = range?.startDate ? parsePhDateInputToUtcDateOnly(range.startDate) : null
  const parsedEnd = range?.endDate ? parsePhDateInputToUtcDateOnly(range.endDate) : null

  const rawStart = parsedStart ?? defaultStart
  const rawEnd = parsedEnd ?? todayPh
  const [startDate, endDate] = rawStart.getTime() <= rawEnd.getTime() ? [rawStart, rawEnd] : [rawEnd, rawStart]

  const [logs, leaves, activeEmployees, presentToday, pendingLeaves, pendingOTs, anomalies] = await Promise.all([
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
    db.leaveRequest.count({
      where: {
        employee: { companyId: context.companyId },
        statusCode: { in: [RequestStatus.PENDING, RequestStatus.SUPERVISOR_APPROVED] },
      },
    }),
    db.overtimeRequest.count({
      where: {
        employee: { companyId: context.companyId },
        statusCode: { in: [RequestStatus.PENDING, RequestStatus.SUPERVISOR_APPROVED] },
      },
    }),
    db.dailyTimeRecord.findMany({
      where: {
        employee: { companyId: context.companyId },
        attendanceDate: { gte: startDate, lte: endDate },
        OR: [
          { attendanceStatus: AttendanceStatus.ABSENT },
          { approvalStatusCode: "PENDING" },
          { actualTimeIn: null },
          { actualTimeOut: null },
          { tardinessMins: { gt: 0 } },
          { undertimeMins: { gt: 0 } },
        ],
      },
      take: 100,
      orderBy: [{ attendanceDate: "desc" }],
      select: {
        id: true,
        employeeId: true,
        attendanceDate: true,
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
          },
        },
      },
    }),
  ])

  const mappedLogs: DtrLogItem[] = logs.map((log) => ({
    id: log.id,
    employeeId: log.employeeId,
    attendanceDate: log.attendanceDate.toISOString(),
    actualTimeIn: toIsoOrNull(log.actualTimeIn),
    actualTimeOut: toIsoOrNull(log.actualTimeOut),
    hoursWorked: Number(log.hoursWorked ?? 0),
    tardinessMins: log.tardinessMins,
    undertimeMins: log.undertimeMins,
    overtimeHours: Number(log.overtimeHours ?? 0),
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
  }))

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

  const workbenchItems: WorkbenchItem[] = anomalies.map((log) => {
    const isAbsence = log.attendanceStatus === AttendanceStatus.ABSENT
    return {
      id: `WB-${log.id}`,
      employeeId: log.employeeId,
      employeeName: `${log.employee.lastName}, ${log.employee.firstName}`,
      date: log.attendanceDate.toISOString(),
      type: isAbsence ? "ABSENCE" : "MISSING_LOG",
      status: "ANOMALY",
      details: isAbsence
        ? "Marked absent"
        : log.actualTimeIn && log.actualTimeOut
          ? "For approval"
          : "Missing biometric punches",
      data: {
        id: log.id,
        employeeId: log.employeeId,
        attendanceDate: log.attendanceDate.toISOString(),
        actualTimeIn: toIsoOrNull(log.actualTimeIn),
        actualTimeOut: toIsoOrNull(log.actualTimeOut),
        hoursWorked: Number(log.hoursWorked ?? 0),
        tardinessMins: log.tardinessMins,
        undertimeMins: log.undertimeMins,
        overtimeHours: Number(log.overtimeHours ?? 0),
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

  const anomalyCount = workbenchItems.length
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
        absences: workbenchItems.filter((item) => item.type === "ABSENCE").length,
        readinessScore,
      },
    },
    leaveOverlays: mappedLeaves,
    filters: {
      startDate: toPhDateInputValue(startDate),
      endDate: toPhDateInputValue(endDate),
    },
  }
}
