"use server"

import { RequestStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import type { LeaveOverlayItem } from "@/modules/attendance/dtr/types"

type GetEmployeeLeaveOverlaysActionResult =
  | { ok: true; data: LeaveOverlayItem[] }
  | { ok: false; error: string }

const toPhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

export async function getEmployeeLeaveOverlaysAction(params: {
  companyId: string
  employeeId: string
  startDate: string
  endDate: string
}): Promise<GetEmployeeLeaveOverlaysActionResult> {
  const context = await getActiveCompanyContext({ companyId: params.companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "attendance")) {
    return { ok: false, error: "You do not have permission to view leave overlays." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: params.employeeId,
      companyId: context.companyId,
      deletedAt: null,
    },
    select: { id: true },
  })

  if (!employee) {
    return { ok: false, error: "Employee not found for this company." }
  }

  const leaves = await db.leaveRequest.findMany({
    where: {
      employeeId: params.employeeId,
      statusCode: RequestStatus.APPROVED,
      startDate: { lte: toPhDate(params.endDate) },
      endDate: { gte: toPhDate(params.startDate) },
    },
    orderBy: [{ startDate: "asc" }],
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
  })

  return {
    ok: true,
    data: leaves.map((leave) => ({
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
    })),
  }
}
