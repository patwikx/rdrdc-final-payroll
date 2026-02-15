"use server"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { dtrEmployeeDateRangeInputSchema, type DtrEmployeeDateRangeInput } from "@/modules/attendance/dtr/schemas/dtr-actions-schema"
import type { DtrLogItem } from "@/modules/attendance/dtr/types"

type GetEmployeeDtrLogsActionResult =
  | { ok: true; data: DtrLogItem[] }
  | { ok: false; error: string }

const toPhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

export async function getEmployeeDtrLogsAction(params: {
  companyId: string
  employeeId: string
  startDate: string
  endDate: string
}): Promise<GetEmployeeDtrLogsActionResult> {
  const parsed = dtrEmployeeDateRangeInputSchema.safeParse(params)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid DTR filters." }
  }

  const payload: DtrEmployeeDateRangeInput = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to view DTR logs." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
      deletedAt: null,
    },
    select: { id: true },
  })

  if (!employee) {
    return { ok: false, error: "Employee not found for this company." }
  }

  const logs = await db.dailyTimeRecord.findMany({
    where: {
      employeeId: payload.employeeId,
      attendanceDate: {
        gte: toPhDate(payload.startDate),
        lte: toPhDate(payload.endDate),
      },
    },
    orderBy: [{ attendanceDate: "asc" }],
    include: {
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
  })

  return {
    ok: true,
    data: logs.map((log) => ({
      id: log.id,
      employeeId: log.employeeId,
      attendanceDate: log.attendanceDate.toISOString(),
      actualTimeIn: log.actualTimeIn ? log.actualTimeIn.toISOString() : null,
      actualTimeOut: log.actualTimeOut ? log.actualTimeOut.toISOString() : null,
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
    })),
  }
}
