"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  updateLeaveBalanceInputSchema,
  type UpdateLeaveBalanceInput,
} from "@/modules/leave/schemas/leave-balance-actions-schema"

type UpdateLeaveBalanceActionResult =
  | {
      ok: true
      message: string
      data: {
        leaveBalanceId: string
        currentBalance: number
        availableBalance: number
        pendingRequests: number
      }
    }
  | { ok: false; error: string }

const canEditLeaveBalances = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN"
}

const roundTo2 = (value: number): number => Math.round(value * 100) / 100
const toDecimalText = (value: number): string => roundTo2(value).toFixed(2)
const toNumber = (value: Prisma.Decimal | null | undefined): number => {
  if (!value) return 0
  return Number(value)
}

const equalsWithPrecision = (a: number, b: number): boolean => {
  return Math.abs(a - b) < 0.005
}

export async function updateLeaveBalanceAction(
  input: UpdateLeaveBalanceInput
): Promise<UpdateLeaveBalanceActionResult> {
  const parsed = updateLeaveBalanceInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid leave balance payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (!hasModuleAccess(companyRole, "leave")) {
    return { ok: false, error: "You do not have permission to edit leave balances." }
  }

  if (!canEditLeaveBalances(companyRole)) {
    return { ok: false, error: "Only HR or company admins can edit leave balances." }
  }

  try {
    const transactionResult = await db.$transaction(async (tx) => {
      const existing = await tx.leaveBalance.findFirst({
        where: {
          id: payload.leaveBalanceId,
          employee: {
            companyId: context.companyId,
            deletedAt: null,
          },
        },
        select: {
          id: true,
          currentBalance: true,
          availableBalance: true,
          pendingRequests: true,
          employee: {
            select: {
              employeeNumber: true,
              firstName: true,
              lastName: true,
            },
          },
          leaveType: {
            select: {
              name: true,
            },
          },
        },
      })

      if (!existing) {
        return { ok: false as const, error: "Leave balance row not found for the active company." }
      }

      const oldCurrentBalance = roundTo2(toNumber(existing.currentBalance))
      const oldAvailableBalance = roundTo2(toNumber(existing.availableBalance))
      const pendingRequests = roundTo2(toNumber(existing.pendingRequests))
      const nextCurrentBalance = roundTo2(payload.currentBalance)

      if (nextCurrentBalance < pendingRequests) {
        return {
          ok: false as const,
          error: `Current balance cannot be lower than pending requests (${pendingRequests.toFixed(2)}).`,
        }
      }

      const nextAvailableBalance = roundTo2(nextCurrentBalance - pendingRequests)
      if (nextAvailableBalance < 0) {
        return { ok: false as const, error: "Computed available balance cannot be negative." }
      }

      const hasCurrentChange = !equalsWithPrecision(oldCurrentBalance, nextCurrentBalance)
      const hasAvailableChange = !equalsWithPrecision(oldAvailableBalance, nextAvailableBalance)
      if (!hasCurrentChange && !hasAvailableChange) {
        return {
          ok: true as const,
          message: "No leave balance changes were applied.",
          data: {
            leaveBalanceId: existing.id,
            currentBalance: oldCurrentBalance,
            availableBalance: oldAvailableBalance,
            pendingRequests,
          },
        }
      }

      const updated = await tx.leaveBalance.update({
        where: { id: existing.id },
        data: {
          currentBalance: toDecimalText(nextCurrentBalance),
          availableBalance: toDecimalText(nextAvailableBalance),
        },
        select: {
          id: true,
          currentBalance: true,
          availableBalance: true,
          pendingRequests: true,
        },
      })

      const currentDelta = roundTo2(nextCurrentBalance - oldCurrentBalance)
      await tx.leaveBalanceTransaction.create({
        data: {
          leaveBalanceId: existing.id,
          transactionType: "ADJUSTMENT",
          amount: toDecimalText(currentDelta),
          runningBalance: toDecimalText(nextCurrentBalance),
          referenceType: "MANUAL",
          remarks: `Manual leave balance edit for ${existing.employee.employeeNumber} (${existing.employee.lastName}, ${existing.employee.firstName}) - ${existing.leaveType.name}`,
          processedById: context.userId,
        },
      })

      await createAuditLog(
        {
          tableName: "LeaveBalance",
          recordId: existing.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "MANUAL_LEAVE_BALANCE_UPDATE",
          changes: [
            { fieldName: "currentBalance", oldValue: oldCurrentBalance, newValue: nextCurrentBalance },
            { fieldName: "availableBalance", oldValue: oldAvailableBalance, newValue: nextAvailableBalance },
          ],
        },
        tx
      )

      return {
        ok: true as const,
        message: "Leave balance updated successfully.",
        data: {
          leaveBalanceId: updated.id,
          currentBalance: toNumber(updated.currentBalance),
          availableBalance: toNumber(updated.availableBalance),
          pendingRequests: toNumber(updated.pendingRequests),
        },
      }
    })

    if (!transactionResult.ok) {
      return { ok: false, error: transactionResult.error }
    }

    revalidatePath(`/${context.companyId}/leave/balances`)
    revalidatePath(`/${context.companyId}/leave/balances/report`)

    return transactionResult
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to update leave balance: ${message}` }
  }
}
