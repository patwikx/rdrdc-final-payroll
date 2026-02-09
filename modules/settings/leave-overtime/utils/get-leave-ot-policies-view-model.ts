import { OvertimeTypeCode } from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

export type LeaveOtPoliciesViewModel = {
  companyId: string
  companyName: string
  leaveTypes: Array<{
    id: string
    code: string
    name: string
    description: string | null
    isPaid: boolean
    isCarriedOver: boolean
    maxCarryOverDays: number | null
    allowHalfDay: boolean
    requiresApproval: boolean
    statusApplicability: string
    isActive: boolean
    primaryPolicy: {
      id: string
      employmentStatusId: string
      annualEntitlement: number
      accrualMethodCode: string
      prorationMethodCode: string
      effectiveFrom: string
    } | null
  }>
  employmentStatuses: Array<{
    id: string
    code: string
    name: string
    isActive: boolean
  }>
  overtimeRates: Array<{
    id: string
    overtimeTypeCode: OvertimeTypeCode
    description: string | null
    rateMultiplier: number
    isActive: boolean
    effectiveFrom: string
  }>
}

const toPhDateInputValue = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toNumber = (value: { toString(): string } | null): number | null => {
  if (!value) return null
  return Number(value.toString())
}

export async function getLeaveOtPoliciesViewModel(companyId: string): Promise<LeaveOtPoliciesViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const [leaveTypes, employmentStatuses, overtimeRatesRaw] = await Promise.all([
    db.leaveType.findMany({
      where: {
        companyId: context.companyId,
      },
      orderBy: [{ isActive: "desc" }, { displayOrder: "asc" }, { code: "asc" }],
      include: {
        policies: {
          where: { isActive: true },
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            employmentStatusId: true,
            annualEntitlement: true,
            accrualMethodCode: true,
            prorationMethodCode: true,
            effectiveFrom: true,
          },
        },
      },
    }),
    db.employmentStatus.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    }),
    db.overtimeRate.findMany({
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        overtimeTypeCode: true,
        description: true,
        rateMultiplier: true,
        isActive: true,
        effectiveFrom: true,
      },
    }),
  ])

  const overtimeRateByType = new Map<OvertimeTypeCode, (typeof overtimeRatesRaw)[number]>()
  for (const row of overtimeRatesRaw) {
    if (!overtimeRateByType.has(row.overtimeTypeCode)) {
      overtimeRateByType.set(row.overtimeTypeCode, row)
    }
  }

  const overtimeRates = Array.from(overtimeRateByType.values()).sort((a, b) =>
    a.overtimeTypeCode.localeCompare(b.overtimeTypeCode)
  )

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    leaveTypes: leaveTypes.map((leaveType) => {
      const primaryPolicy = leaveType.policies[0] ?? null

      return {
        id: leaveType.id,
        code: leaveType.code,
        name: leaveType.name,
        description: leaveType.description,
        isPaid: leaveType.isPaid,
        isCarriedOver: leaveType.isCarriedOver,
        maxCarryOverDays: toNumber(leaveType.maxCarryOverDays),
        allowHalfDay: leaveType.allowHalfDay,
        requiresApproval: leaveType.requiresApproval,
        statusApplicability: leaveType.statusApplicability,
        isActive: leaveType.isActive,
        primaryPolicy: primaryPolicy
          ? {
              id: primaryPolicy.id,
              employmentStatusId: primaryPolicy.employmentStatusId,
              annualEntitlement: Number(primaryPolicy.annualEntitlement),
              accrualMethodCode: primaryPolicy.accrualMethodCode,
              prorationMethodCode: primaryPolicy.prorationMethodCode,
              effectiveFrom: toPhDateInputValue(primaryPolicy.effectiveFrom),
            }
          : null,
      }
    }),
    employmentStatuses,
    overtimeRates: overtimeRates.map((item) => ({
      id: item.id,
      overtimeTypeCode: item.overtimeTypeCode,
      description: item.description,
      rateMultiplier: Number(item.rateMultiplier),
      isActive: item.isActive,
      effectiveFrom: toPhDateInputValue(item.effectiveFrom),
    })),
  }
}
