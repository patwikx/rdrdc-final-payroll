import type { Prisma } from "@prisma/client"

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
  processedById: string
}

const roundTo2 = (value: number): number => Math.round(value * 100) / 100
const toDecimalText = (value: number): string => roundTo2(value).toFixed(2)
const toNumber = (value: Prisma.Decimal): number => Number(value)

const requestYear = (requestStartDate: Date): number => requestStartDate.getUTCFullYear()

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
  const year = requestYear(input.requestStartDate)
  const leaveBalance = await getLeaveBalance(tx, input.employeeId, input.leaveTypeId, year)

  if (!leaveBalance) {
    return {
      ok: false,
      error: `No leave balance found for ${year}. Please initialize yearly leave balances first.`,
    }
  }

  const availableBalance = toNumber(leaveBalance.availableBalance)
  const pendingRequests = toNumber(leaveBalance.pendingRequests)
  const numberOfDays = roundTo2(input.numberOfDays)

  if (availableBalance < numberOfDays) {
    return {
      ok: false,
      error: "Insufficient leave balance for this request.",
    }
  }

  const nextPendingRequests = roundTo2(pendingRequests + numberOfDays)
  const nextAvailableBalance = roundTo2(availableBalance - numberOfDays)

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
      amount: toDecimalText(-numberOfDays),
      runningBalance: leaveBalance.currentBalance,
      referenceType: "LEAVE_REQUEST",
      referenceId: input.requestId,
      remarks: `Reserved ${toDecimalText(numberOfDays)} day(s) for leave request ${input.requestNumber}`,
      processedById: input.processedById,
    },
  })

  return { ok: true }
}

export async function releaseReservedLeaveBalanceForRequest(
  tx: TxClient,
  input: BaseMutationInput
): Promise<LeaveBalanceMutationResult> {
  const year = requestYear(input.requestStartDate)
  const leaveBalance = await getLeaveBalance(tx, input.employeeId, input.leaveTypeId, year)

  if (!leaveBalance) {
    return {
      ok: false,
      error: `No leave balance found for ${year}.`,
    }
  }

  const pendingRequests = toNumber(leaveBalance.pendingRequests)
  const availableBalance = toNumber(leaveBalance.availableBalance)
  const numberOfDays = roundTo2(input.numberOfDays)

  if (pendingRequests < numberOfDays) {
    return {
      ok: false,
      error: "Leave balance reservation is inconsistent. Pending requests are lower than the request duration.",
    }
  }

  const nextPendingRequests = roundTo2(pendingRequests - numberOfDays)
  const nextAvailableBalance = roundTo2(availableBalance + numberOfDays)

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
      amount: toDecimalText(numberOfDays),
      runningBalance: leaveBalance.currentBalance,
      referenceType: "LEAVE_REQUEST",
      referenceId: input.requestId,
      remarks: `Released ${toDecimalText(numberOfDays)} day(s) back to available balance for ${input.requestNumber}`,
      processedById: input.processedById,
    },
  })

  return { ok: true }
}

export async function consumeReservedLeaveBalanceForRequest(
  tx: TxClient,
  input: BaseMutationInput
): Promise<LeaveBalanceMutationResult> {
  const year = requestYear(input.requestStartDate)
  const leaveBalance = await getLeaveBalance(tx, input.employeeId, input.leaveTypeId, year)

  if (!leaveBalance) {
    return {
      ok: false,
      error: `No leave balance found for ${year}.`,
    }
  }

  const currentBalance = toNumber(leaveBalance.currentBalance)
  const pendingRequests = toNumber(leaveBalance.pendingRequests)
  const creditsUsed = toNumber(leaveBalance.creditsUsed)
  const numberOfDays = roundTo2(input.numberOfDays)

  if (pendingRequests < numberOfDays) {
    return {
      ok: false,
      error: "Leave balance reservation is inconsistent. Pending requests are lower than the request duration.",
    }
  }

  if (currentBalance < numberOfDays) {
    return {
      ok: false,
      error: "Leave balance is insufficient to finalize this approval.",
    }
  }

  const nextCurrentBalance = roundTo2(currentBalance - numberOfDays)
  const nextPendingRequests = roundTo2(pendingRequests - numberOfDays)
  const nextCreditsUsed = roundTo2(creditsUsed + numberOfDays)
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
      amount: toDecimalText(numberOfDays),
      runningBalance: toDecimalText(nextCurrentBalance),
      referenceType: "LEAVE_REQUEST",
      referenceId: input.requestId,
      remarks: `Consumed ${toDecimalText(numberOfDays)} day(s) for approved leave request ${input.requestNumber}`,
      processedById: input.processedById,
    },
  })

  return { ok: true }
}
