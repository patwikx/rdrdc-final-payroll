import type { Prisma } from "@prisma/client"

type TxClient = Prisma.TransactionClient

type LeaveTypeRecord = {
  id: string
  code: string
  name: string
  isPaid: boolean
  companyId: string | null
}

export type LeaveBalanceChargeDecision =
  | {
      ok: true
      chargeLeaveTypeId: string | null
      chargeLeaveTypeName: string | null
      sourceLeaveTypeName: string
    }
  | {
      ok: false
      error: string
    }

const EMERGENCY_LEAVE_NAMES = new Set(["EMERGENCY LEAVE"])
const EMERGENCY_LEAVE_CODES = new Set(["EL", "EMERGENCY_LEAVE", "EMERGENCYLEAVE", "EMERGENCY"])
const VACATION_LEAVE_NAMES = new Set(["VACATION LEAVE"])
const VACATION_LEAVE_CODES = new Set(["VL", "VACATION_LEAVE", "VACATIONLEAVE", "VACATION"])

const normalize = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, " ")
const normalizeCode = (value: string): string => value.trim().toUpperCase().replace(/[\s-]+/g, "_")

const isEmergencyLeaveType = (leaveType: Pick<LeaveTypeRecord, "name" | "code">): boolean => {
  return EMERGENCY_LEAVE_NAMES.has(normalize(leaveType.name)) || EMERGENCY_LEAVE_CODES.has(normalizeCode(leaveType.code))
}

const isVacationLeaveType = (leaveType: Pick<LeaveTypeRecord, "name" | "code">): boolean => {
  return VACATION_LEAVE_NAMES.has(normalize(leaveType.name)) || VACATION_LEAVE_CODES.has(normalizeCode(leaveType.code))
}

const pickVacationLeaveType = (
  leaveTypes: ReadonlyArray<LeaveTypeRecord>,
  companyId: string
): LeaveTypeRecord | null => {
  const vacationCandidates = leaveTypes.filter((leaveType) => isVacationLeaveType(leaveType))
  if (vacationCandidates.length === 0) return null

  const companyScoped = vacationCandidates.find((leaveType) => leaveType.companyId === companyId)
  if (companyScoped) return companyScoped

  return vacationCandidates.find((leaveType) => leaveType.companyId === null) ?? vacationCandidates[0] ?? null
}

export function resolveLeaveBalanceChargeDecision(params: {
  sourceLeaveType: Pick<LeaveTypeRecord, "id" | "name" | "code" | "isPaid">
  employeeCompanyId: string
  availableLeaveTypes: ReadonlyArray<LeaveTypeRecord>
}): LeaveBalanceChargeDecision {
  const sourceLeaveTypeName = params.sourceLeaveType.name

  if (isEmergencyLeaveType(params.sourceLeaveType)) {
    const vacationLeaveType = pickVacationLeaveType(params.availableLeaveTypes, params.employeeCompanyId)
    if (!vacationLeaveType) {
      return {
        ok: false,
        error: "Emergency Leave requires a configured Vacation Leave type in the company settings.",
      }
    }

    return {
      ok: true,
      chargeLeaveTypeId: vacationLeaveType.id,
      chargeLeaveTypeName: vacationLeaveType.name,
      sourceLeaveTypeName,
    }
  }

  if (!params.sourceLeaveType.isPaid) {
    return {
      ok: true,
      chargeLeaveTypeId: null,
      chargeLeaveTypeName: null,
      sourceLeaveTypeName,
    }
  }

  return {
    ok: true,
    chargeLeaveTypeId: params.sourceLeaveType.id,
    chargeLeaveTypeName: sourceLeaveTypeName,
    sourceLeaveTypeName,
  }
}

export async function resolveLeaveBalanceChargeDecisionForRequest(
  tx: TxClient,
  params: {
    employeeId: string
    leaveTypeId: string
  }
): Promise<LeaveBalanceChargeDecision> {
  const [sourceLeaveType, employee] = await Promise.all([
    tx.leaveType.findUnique({
      where: { id: params.leaveTypeId },
      select: {
        id: true,
        code: true,
        name: true,
        isPaid: true,
      },
    }),
    tx.employee.findUnique({
      where: { id: params.employeeId },
      select: { companyId: true },
    }),
  ])

  if (!sourceLeaveType) {
    return { ok: false, error: "Selected leave type is no longer available." }
  }

  if (!employee) {
    return { ok: false, error: "Employee profile was not found while processing leave balance." }
  }

  const availableLeaveTypes = await tx.leaveType.findMany({
    where: {
      OR: [{ companyId: employee.companyId }, { companyId: null }],
    },
    select: {
      id: true,
      code: true,
      name: true,
      isPaid: true,
      companyId: true,
    },
  })

  return resolveLeaveBalanceChargeDecision({
    sourceLeaveType,
    employeeCompanyId: employee.companyId,
    availableLeaveTypes,
  })
}
