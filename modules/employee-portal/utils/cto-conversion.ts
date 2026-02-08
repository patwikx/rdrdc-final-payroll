import type { Prisma } from "@prisma/client"

type TxClient = Prisma.TransactionClient

type CtoConversionInput = {
  companyId: string
  employeeId: string
  overtimeRequestId: string
  requestNumber: string
  overtimeDate: Date
  overtimeHours: number
  isOvertimeEligible: boolean
  processedById: string
}

type CtoConversionResult =
  | { ok: true; converted: boolean }
  | { ok: false; error: string }

const roundTo2 = (value: number): number => Math.round(value * 100) / 100
const toDecimalText = (value: number): string => roundTo2(value).toFixed(2)
const toNumber = (value: Prisma.Decimal): number => Number(value)

const shouldConvertToCto = async (
  tx: TxClient,
  companyId: string,
  employeeId: string,
  isOvertimeEligible: boolean
): Promise<boolean> => {
  if (!isOvertimeEligible) {
    return true
  }

  const directReports = await tx.employee.count({
    where: {
      companyId,
      reportingManagerId: employeeId,
      deletedAt: null,
      isActive: true,
    },
  })

  return directReports > 0
}

export async function applyCtoCreditForApprovedOvertime(
  tx: TxClient,
  input: CtoConversionInput
): Promise<CtoConversionResult> {
  const overtimeHours = roundTo2(input.overtimeHours)
  if (overtimeHours < 1) {
    return { ok: false, error: "Overtime requests must be at least 1 hour." }
  }

  const shouldConvert = await shouldConvertToCto(tx, input.companyId, input.employeeId, input.isOvertimeEligible)
  if (!shouldConvert) {
    return { ok: true, converted: false }
  }

  const ctoLeaveType = await tx.leaveType.findFirst({
    where: {
      companyId: input.companyId,
      isCTO: true,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  })

  if (!ctoLeaveType) {
    return { ok: false, error: "CTO leave type is not configured for this company." }
  }

  const year = input.overtimeDate.getUTCFullYear()

  const leaveBalance = await tx.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: input.employeeId,
        leaveTypeId: ctoLeaveType.id,
        year,
      },
    },
    select: {
      id: true,
      creditsEarned: true,
      currentBalance: true,
      availableBalance: true,
    },
  })

  if (!leaveBalance) {
    return {
      ok: false,
      error: `No CTO leave balance found for ${year}. Initialize leave balances first.`,
    }
  }

  const nextCreditsEarned = roundTo2(toNumber(leaveBalance.creditsEarned) + overtimeHours)
  const nextCurrentBalance = roundTo2(toNumber(leaveBalance.currentBalance) + overtimeHours)
  const nextAvailableBalance = roundTo2(toNumber(leaveBalance.availableBalance) + overtimeHours)

  await tx.leaveBalance.update({
    where: { id: leaveBalance.id },
    data: {
      creditsEarned: toDecimalText(nextCreditsEarned),
      currentBalance: toDecimalText(nextCurrentBalance),
      availableBalance: toDecimalText(nextAvailableBalance),
    },
  })

  await tx.leaveBalanceTransaction.create({
    data: {
      leaveBalanceId: leaveBalance.id,
      transactionType: "ACCRUAL",
      amount: toDecimalText(overtimeHours),
      runningBalance: toDecimalText(nextCurrentBalance),
      referenceType: "OVERTIME_REQUEST",
      referenceId: input.overtimeRequestId,
      remarks: `CTO credit from overtime request ${input.requestNumber} (1:1 conversion)`,
      processedById: input.processedById,
    },
  })

  return { ok: true, converted: true }
}
