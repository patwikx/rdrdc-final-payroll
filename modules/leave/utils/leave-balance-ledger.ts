import type { Prisma } from "@prisma/client"

import { resolveLeaveBalanceChargeDecisionForRequest } from "@/modules/leave/utils/leave-balance-policy"
import { isCtoLeaveType } from "@/modules/leave/utils/cto-leave-type"

type TxClient = Prisma.TransactionClient

type LeaveBalanceMutationResult =
  | { ok: true }
  | {
      ok: false
      error: string
    }

type BaseMutationInput = {
  employeeId: string
  leaveTypeId: string
  requestId: string
  requestNumber: string
  requestStartDate: Date
  numberOfDays: number
  numberOfHours?: number | null
  processedById: string
}

const roundTo2 = (value: number): number => Math.round(value * 100) / 100
const toDecimalText = (value: number): string => roundTo2(value).toFixed(2)
const toNumber = (value: Prisma.Decimal): number => Number(value)

const requestYear = (requestStartDate: Date): number => requestStartDate.getUTCFullYear()

const resolveBalanceChargeAmount = async (
  tx: TxClient,
  input: BaseMutationInput,
  chargeLeaveTypeId: string
): Promise<{ ok: true; amount: number; unitLabel: "day(s)" | "hour(s)" } | { ok: false; error: string }> => {
  const chargeLeaveType = await tx.leaveType.findUnique({
    where: { id: chargeLeaveTypeId },
    select: {
      id: true,
      code: true,
      name: true,
      isCTO: true,
    },
  })

  if (!chargeLeaveType) {
    return { ok: false, error: "Leave type is no longer available for balance computation." }
  }

  const isCto = isCtoLeaveType(chargeLeaveType)
  if (!isCto) {
    return { ok: true, amount: roundTo2(input.numberOfDays), unitLabel: "day(s)" }
  }

  if (typeof input.numberOfHours === "number" && Number.isFinite(input.numberOfHours) && input.numberOfHours > 0) {
    return { ok: true, amount: roundTo2(input.numberOfHours), unitLabel: "hour(s)" }
  }

  const employee = await tx.employee.findUnique({
    where: { id: input.employeeId },
    select: {
      workSchedule: {
        select: {
          requiredHoursPerDay: true,
        },
      },
    },
  })

  const requiredHoursPerDay = employee?.workSchedule?.requiredHoursPerDay
    ? Number(employee.workSchedule.requiredHoursPerDay)
    : null

  if (!requiredHoursPerDay || !Number.isFinite(requiredHoursPerDay) || requiredHoursPerDay <= 0) {
    return { ok: false, error: "Employee work schedule hours/day is required for CTO balance charging." }
  }

  return {
    ok: true,
    amount: roundTo2(input.numberOfDays * requiredHoursPerDay),
    unitLabel: "hour(s)",
  }
}

const getLeaveBalance = async (tx: TxClient, employeeId: string, leaveTypeId: string, year: number) => {
  return tx.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId,
        leaveTypeId,
        year,
      },
    },
    select: {
      id: true,
      currentBalance: true,
      availableBalance: true,
      pendingRequests: true,
      creditsUsed: true,
    },
  })
}

export async function reserveLeaveBalanceForRequest(
  tx: TxClient,
  input: BaseMutationInput
): Promise<LeaveBalanceMutationResult> {
  const chargeDecision = await resolveLeaveBalanceChargeDecisionForRequest(tx, {
    employeeId: input.employeeId,
    leaveTypeId: input.leaveTypeId,
  })
  if (!chargeDecision.ok) {
    return { ok: false, error: chargeDecision.error }
  }
  if (!chargeDecision.chargeLeaveTypeId) {
    return { ok: true }
  }

  const chargeAmount = await resolveBalanceChargeAmount(tx, input, chargeDecision.chargeLeaveTypeId)
  if (!chargeAmount.ok) {
    return { ok: false, error: chargeAmount.error }
  }

  const year = requestYear(input.requestStartDate)
  const leaveBalance = await getLeaveBalance(tx, input.employeeId, chargeDecision.chargeLeaveTypeId, year)

  if (!leaveBalance) {
    return {
      ok: false,
      error: `No leave balance found for ${chargeDecision.chargeLeaveTypeName ?? "this leave type"} in ${year}. Please initialize yearly leave balances first.`,
    }
  }

  const availableBalance = toNumber(leaveBalance.availableBalance)
  const pendingRequests = toNumber(leaveBalance.pendingRequests)
  const amount = chargeAmount.amount

  if (availableBalance < amount) {
    return {
      ok: false,
      error: "Insufficient leave balance for this request.",
    }
  }

  const nextPendingRequests = roundTo2(pendingRequests + amount)
  const nextAvailableBalance = roundTo2(availableBalance - amount)

  await tx.leaveBalance.update({
    where: { id: leaveBalance.id },
    data: {
      pendingRequests: toDecimalText(nextPendingRequests),
      availableBalance: toDecimalText(nextAvailableBalance),
    },
  })

  await tx.leaveBalanceTransaction.create({
    data: {
      leaveBalanceId: leaveBalance.id,
      transactionType: "ADJUSTMENT",
      amount: toDecimalText(-amount),
      runningBalance: leaveBalance.currentBalance,
      referenceType: "LEAVE_REQUEST",
      referenceId: input.requestId,
      remarks: `Reserved ${toDecimalText(amount)} ${chargeAmount.unitLabel} for leave request ${input.requestNumber} (${chargeDecision.sourceLeaveTypeName})`,
      processedById: input.processedById,
    },
  })

  return { ok: true }
}

export async function releaseReservedLeaveBalanceForRequest(
  tx: TxClient,
  input: BaseMutationInput
): Promise<LeaveBalanceMutationResult> {
  const chargeDecision = await resolveLeaveBalanceChargeDecisionForRequest(tx, {
    employeeId: input.employeeId,
    leaveTypeId: input.leaveTypeId,
  })
  if (!chargeDecision.ok) {
    return { ok: false, error: chargeDecision.error }
  }
  if (!chargeDecision.chargeLeaveTypeId) {
    return { ok: true }
  }

  const chargeAmount = await resolveBalanceChargeAmount(tx, input, chargeDecision.chargeLeaveTypeId)
  if (!chargeAmount.ok) {
    return { ok: false, error: chargeAmount.error }
  }

  const year = requestYear(input.requestStartDate)
  const leaveBalance = await getLeaveBalance(tx, input.employeeId, chargeDecision.chargeLeaveTypeId, year)

  if (!leaveBalance) {
    return {
      ok: false,
      error: `No leave balance found for ${chargeDecision.chargeLeaveTypeName ?? "this leave type"} in ${year}.`,
    }
  }

  const pendingRequests = toNumber(leaveBalance.pendingRequests)
  const availableBalance = toNumber(leaveBalance.availableBalance)
  const amount = chargeAmount.amount

  if (pendingRequests < amount) {
    return {
      ok: false,
      error: "Leave balance reservation is inconsistent. Pending requests are lower than the request duration.",
    }
  }

  const nextPendingRequests = roundTo2(pendingRequests - amount)
  const nextAvailableBalance = roundTo2(availableBalance + amount)

  await tx.leaveBalance.update({
    where: { id: leaveBalance.id },
    data: {
      pendingRequests: toDecimalText(nextPendingRequests),
      availableBalance: toDecimalText(nextAvailableBalance),
    },
  })

  await tx.leaveBalanceTransaction.create({
    data: {
      leaveBalanceId: leaveBalance.id,
      transactionType: "ADJUSTMENT",
      amount: toDecimalText(amount),
      runningBalance: leaveBalance.currentBalance,
      referenceType: "LEAVE_REQUEST",
      referenceId: input.requestId,
      remarks: `Released ${toDecimalText(amount)} ${chargeAmount.unitLabel} back to available balance for ${input.requestNumber} (${chargeDecision.sourceLeaveTypeName})`,
      processedById: input.processedById,
    },
  })

  return { ok: true }
}

export async function consumeReservedLeaveBalanceForRequest(
  tx: TxClient,
  input: BaseMutationInput
): Promise<LeaveBalanceMutationResult> {
  const chargeDecision = await resolveLeaveBalanceChargeDecisionForRequest(tx, {
    employeeId: input.employeeId,
    leaveTypeId: input.leaveTypeId,
  })
  if (!chargeDecision.ok) {
    return { ok: false, error: chargeDecision.error }
  }
  if (!chargeDecision.chargeLeaveTypeId) {
    return { ok: true }
  }

  const chargeAmount = await resolveBalanceChargeAmount(tx, input, chargeDecision.chargeLeaveTypeId)
  if (!chargeAmount.ok) {
    return { ok: false, error: chargeAmount.error }
  }

  const year = requestYear(input.requestStartDate)
  const leaveBalance = await getLeaveBalance(tx, input.employeeId, chargeDecision.chargeLeaveTypeId, year)

  if (!leaveBalance) {
    return {
      ok: false,
      error: `No leave balance found for ${chargeDecision.chargeLeaveTypeName ?? "this leave type"} in ${year}.`,
    }
  }

  const currentBalance = toNumber(leaveBalance.currentBalance)
  const pendingRequests = toNumber(leaveBalance.pendingRequests)
  const creditsUsed = toNumber(leaveBalance.creditsUsed)
  const amount = chargeAmount.amount

  if (pendingRequests < amount) {
    return {
      ok: false,
      error: "Leave balance reservation is inconsistent. Pending requests are lower than the request duration.",
    }
  }

  if (currentBalance < amount) {
    return {
      ok: false,
      error: "Leave balance is insufficient to finalize this approval.",
    }
  }

  const nextCurrentBalance = roundTo2(currentBalance - amount)
  const nextPendingRequests = roundTo2(pendingRequests - amount)
  const nextCreditsUsed = roundTo2(creditsUsed + amount)
  const nextAvailableBalance = roundTo2(nextCurrentBalance - nextPendingRequests)

  if (nextAvailableBalance < 0) {
    return {
      ok: false,
      error: "Leave balance computation failed. Available balance cannot be negative.",
    }
  }

  await tx.leaveBalance.update({
    where: { id: leaveBalance.id },
    data: {
      currentBalance: toDecimalText(nextCurrentBalance),
      pendingRequests: toDecimalText(nextPendingRequests),
      creditsUsed: toDecimalText(nextCreditsUsed),
      availableBalance: toDecimalText(nextAvailableBalance),
    },
  })

  await tx.leaveBalanceTransaction.create({
    data: {
      leaveBalanceId: leaveBalance.id,
      transactionType: "USAGE",
      amount: toDecimalText(amount),
      runningBalance: toDecimalText(nextCurrentBalance),
      referenceType: "LEAVE_REQUEST",
      referenceId: input.requestId,
      remarks: `Consumed ${toDecimalText(amount)} ${chargeAmount.unitLabel} for approved leave request ${input.requestNumber} (${chargeDecision.sourceLeaveTypeName})`,
      processedById: input.processedById,
    },
  })

  return { ok: true }
}
