"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  dtrEmployeeLeaveContextInputSchema,
  type DtrEmployeeLeaveContextInput,
} from "@/modules/attendance/dtr/schemas/dtr-actions-schema"
import { DTR_MANUAL_LEAVE_REFERENCE_TYPE } from "@/modules/attendance/dtr/utils/manual-dtr-leave"
import { extractDtrLeaveTypeIdFromRemarks, parsePhDateInput } from "@/modules/attendance/dtr/utils/wall-clock"

type EmployeeLeaveBalanceOption = {
  leaveTypeId: string
  name: string
  code: string
  currentBalance: number
  availableBalance: number
}

const normalizeText = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")

const ALLOWED_LEAVE_TYPE_KEYS = new Set([
  normalizeText("Sick Leave"),
  normalizeText("Vacation Leave"),
  normalizeText("Compensary Time Off"),
  normalizeText("Compensatory Time Off"),
  normalizeText("Leave Without Pay"),
  normalizeText("Mandatory Leave"),
])

const isAllowedLeaveType = (value: { name: string; code: string }): boolean => {
  if (ALLOWED_LEAVE_TYPE_KEYS.has(normalizeText(value.name))) {
    return true
  }

  const codeKey = normalizeText(value.code)
  return codeKey === "sl" || codeKey === "vl" || codeKey === "cto" || codeKey === "lwop" || codeKey === "mandatory"
}

type EmployeeLeaveBalancesActionResult =
  | {
      ok: true
      data: {
        year: number
        leaveOptions: EmployeeLeaveBalanceOption[]
        activeManualLeave: {
          leaveTypeId: string
          numberOfDays: number
        } | null
      }
    }
  | {
      ok: false
      error: string
    }

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

export async function getEmployeeLeaveBalancesAction(
  input: DtrEmployeeLeaveContextInput
): Promise<EmployeeLeaveBalancesActionResult> {
  const parsed = dtrEmployeeLeaveContextInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid leave balance lookup payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  if (!hasAttendanceSensitiveAccess(companyRole) && !isSuperAdmin) {
    return { ok: false, error: "You do not have permission to view employee leave balances." }
  }

  const attendanceDate = parsePhDateInput(payload.attendanceDate)
  if (!attendanceDate) {
    return { ok: false, error: "Invalid attendance date." }
  }
  const year = attendanceDate.getUTCFullYear()

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

  const [leaveTypes, leaveBalances, latestManualLeaveTx, dtrRecord] = await Promise.all([
    db.leaveType.findMany({
      where: {
        isActive: true,
        OR: [{ companyId: context.companyId }, { companyId: null }],
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),
    db.leaveBalance.findMany({
      where: {
        employeeId: payload.employeeId,
        year,
      },
      select: {
        leaveTypeId: true,
        currentBalance: true,
        availableBalance: true,
      },
    }),
    payload.dtrId
      ? db.leaveBalanceTransaction.findFirst({
          where: {
            referenceType: DTR_MANUAL_LEAVE_REFERENCE_TYPE,
            referenceId: payload.dtrId,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            transactionType: true,
            amount: true,
            leaveBalance: {
              select: {
                employeeId: true,
                leaveTypeId: true,
                year: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    payload.dtrId
      ? db.dailyTimeRecord.findFirst({
          where: {
            id: payload.dtrId,
            employeeId: payload.employeeId,
            employee: { companyId: context.companyId },
          },
          select: {
            remarks: true,
          },
        })
      : Promise.resolve(null),
  ])

  const leaveTypeFromRemarks = extractDtrLeaveTypeIdFromRemarks(dtrRecord?.remarks)
  const activeManualLeave =
    leaveTypeFromRemarks
      ? {
          leaveTypeId: leaveTypeFromRemarks,
          numberOfDays:
            latestManualLeaveTx &&
            latestManualLeaveTx.transactionType === "USAGE" &&
            latestManualLeaveTx.leaveBalance.employeeId === payload.employeeId &&
            latestManualLeaveTx.leaveBalance.year === year
              ? toNumber(latestManualLeaveTx.amount)
              : 0,
        }
      : latestManualLeaveTx &&
          latestManualLeaveTx.transactionType === "USAGE" &&
          latestManualLeaveTx.leaveBalance.employeeId === payload.employeeId &&
          latestManualLeaveTx.leaveBalance.year === year
        ? {
            leaveTypeId: latestManualLeaveTx.leaveBalance.leaveTypeId,
            numberOfDays: toNumber(latestManualLeaveTx.amount),
          }
      : null

  const leaveBalanceByTypeId = new Map(
    leaveBalances.map((item) => [
      item.leaveTypeId,
      {
        currentBalance: toNumber(item.currentBalance),
        availableBalance: toNumber(item.availableBalance),
      },
    ])
  )
  const filteredLeaveTypes = leaveTypes.filter((item) => isAllowedLeaveType({ name: item.name, code: item.code }))

  return {
    ok: true,
    data: {
      year,
      leaveOptions: filteredLeaveTypes.map((item) => ({
        leaveTypeId: item.id,
        name: item.name,
        code: item.code,
        currentBalance: leaveBalanceByTypeId.get(item.id)?.currentBalance ?? 0,
        availableBalance: leaveBalanceByTypeId.get(item.id)?.availableBalance ?? 0,
      })),
      activeManualLeave,
    },
  }
}
