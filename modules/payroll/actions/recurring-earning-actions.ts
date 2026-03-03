"use server"

import { revalidatePath } from "next/cache"
import { type CompanyRole } from "@prisma/client"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly } from "@/lib/ph-time"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess } from "@/modules/auth/utils/authorization-policy"
import {
  createEarningTypeInputSchema,
  createRecurringEarningInputSchema,
  updateEarningTypeInputSchema,
  updateRecurringEarningStatusInputSchema,
  type CreateEarningTypeInput,
  type CreateRecurringEarningInput,
  type UpdateEarningTypeInput,
  type UpdateRecurringEarningStatusInput,
} from "@/modules/payroll/schemas/recurring-earning-schema"
import { isDisallowedRecurringEarningType } from "@/modules/payroll/utils/recurring-earning-eligibility"

type ActionResult = { ok: true; message: string } | { ok: false; error: string }
type UpsertEarningTypeResult =
  | { ok: true; message: string; earningTypeId: string }
  | { ok: false; error: string }

const toDecimalText = (value: number): string => value.toFixed(2)

const toPhDateOnlyUtc = (value: string): Date => {
  const parsed = parsePhDateInputToUtcDateOnly(value)
  if (parsed) return parsed

  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

const ensurePayrollAccess = async (companyId: string) => {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "payroll")) {
    return { ok: false as const, error: "You do not have payroll access." }
  }

  return { ok: true as const, context }
}

const revalidateRecurringEarnings = (companyId: string) => {
  revalidatePath(`/${companyId}/payroll/recurring-earnings`)
}

const resolveTaxableOverride = (taxTreatment: "DEFAULT" | "TAXABLE" | "NON_TAXABLE"): boolean | null => {
  if (taxTreatment === "DEFAULT") return null
  if (taxTreatment === "TAXABLE") return true
  return false
}

const findOverlappingActiveRecurringEarning = async (input: {
  employeeId: string
  earningTypeId: string
  effectiveFrom: Date
  effectiveTo: Date | null
  excludeId?: string
}) => {
  return db.employeeEarning.findFirst({
    where: {
      employeeId: input.employeeId,
      earningTypeId: input.earningTypeId,
      isActive: true,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      effectiveFrom: { lte: input.effectiveTo ?? new Date(Date.UTC(9999, 11, 31)) },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.effectiveFrom } }],
    },
    select: { id: true },
  })
}

const validateRecurringEarningTypeEligibility = (input: { code: string; name: string; isIncludedInGross: boolean }) => {
  if (isDisallowedRecurringEarningType(input.code, input.name)) {
    return {
      ok: false as const,
      error:
        "This earning type is intended for variable/auto-calculated payroll lines and is not allowed as recurring earning.",
    }
  }

  if (!input.isIncludedInGross) {
    return { ok: false as const, error: "Recurring earning type must be included in gross pay." }
  }

  return { ok: true as const }
}

export async function createRecurringEarningAction(input: CreateRecurringEarningInput): Promise<ActionResult> {
  const parsed = createRecurringEarningInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid recurring earning payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const [employee, earningType] = await Promise.all([
    db.employee.findFirst({
      where: {
        id: payload.employeeId,
        companyId: context.companyId,
        isActive: true,
      },
      select: { id: true },
    }),
    db.earningType.findFirst({
      where: {
        id: payload.earningTypeId,
        isActive: true,
        OR: [{ companyId: context.companyId }, { companyId: null }],
      },
      select: { id: true, code: true, name: true, isIncludedInGross: true },
    }),
  ])

  if (!employee) {
    return { ok: false, error: "Employee not found for active company." }
  }

  if (!earningType) {
    return { ok: false, error: "Earning type is not available for this company." }
  }

  const eligibility = validateRecurringEarningTypeEligibility(earningType)
  if (!eligibility.ok) {
    return { ok: false, error: eligibility.error }
  }

  const effectiveFrom = toPhDateOnlyUtc(payload.effectiveFrom)
  const effectiveTo = payload.effectiveTo ? toPhDateOnlyUtc(payload.effectiveTo) : null

  const overlap = await findOverlappingActiveRecurringEarning({
    employeeId: payload.employeeId,
    earningTypeId: payload.earningTypeId,
    effectiveFrom,
    effectiveTo,
    excludeId: payload.recurringEarningId,
  })

  if (overlap) {
    return { ok: false, error: "An overlapping active recurring earning already exists for this employee and earning type." }
  }

  try {
    if (payload.recurringEarningId) {
      const existing = await db.employeeEarning.findFirst({
        where: {
          id: payload.recurringEarningId,
          employee: { companyId: context.companyId },
        },
        select: {
          id: true,
          employeeId: true,
          earningTypeId: true,
          amount: true,
          frequency: true,
          isTaxableOverride: true,
          effectiveFrom: true,
          effectiveTo: true,
          remarks: true,
        },
      })

      if (!existing) {
        return { ok: false, error: "Recurring earning not found for update." }
      }

      await db.employeeEarning.update({
        where: { id: existing.id },
        data: {
          employeeId: payload.employeeId,
          earningTypeId: payload.earningTypeId,
          amount: toDecimalText(payload.amount),
          frequency: payload.frequency,
          isTaxableOverride: resolveTaxableOverride(payload.taxTreatment),
          effectiveFrom,
          effectiveTo,
          remarks: payload.remarks?.trim() || null,
        },
      })

      await createAuditLog({
        tableName: "EmployeeEarning",
        recordId: existing.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "UPDATE_RECURRING_EARNING",
        changes: [
          { fieldName: "employeeId", oldValue: existing.employeeId, newValue: payload.employeeId },
          { fieldName: "earningTypeId", oldValue: existing.earningTypeId, newValue: payload.earningTypeId },
          { fieldName: "amount", oldValue: Number(existing.amount), newValue: payload.amount },
          { fieldName: "frequency", oldValue: existing.frequency, newValue: payload.frequency },
        ],
      })

      revalidateRecurringEarnings(context.companyId)
      return { ok: true, message: "Recurring earning updated successfully." }
    }

    const created = await db.employeeEarning.create({
      data: {
        employeeId: payload.employeeId,
        earningTypeId: payload.earningTypeId,
        amount: toDecimalText(payload.amount),
        frequency: payload.frequency,
        isTaxableOverride: resolveTaxableOverride(payload.taxTreatment),
        effectiveFrom,
        effectiveTo,
        remarks: payload.remarks?.trim() || null,
      },
      select: { id: true },
    })

    await createAuditLog({
      tableName: "EmployeeEarning",
      recordId: created.id,
      action: "CREATE",
      userId: context.userId,
      reason: "CREATE_RECURRING_EARNING",
      changes: [
        { fieldName: "employeeId", newValue: payload.employeeId },
        { fieldName: "earningTypeId", newValue: payload.earningTypeId },
        { fieldName: "amount", newValue: payload.amount },
        { fieldName: "frequency", newValue: payload.frequency },
      ],
    })

    revalidateRecurringEarnings(context.companyId)
    return { ok: true, message: "Recurring earning created successfully." }
  } catch (error) {
    console.error("[createRecurringEarningAction] Failed to upsert recurring earning", {
      companyId: context.companyId,
      employeeId: payload.employeeId,
      earningTypeId: payload.earningTypeId,
      error,
    })
    return { ok: false, error: "Failed to save recurring earning." }
  }
}

export async function updateRecurringEarningStatusAction(input: UpdateRecurringEarningStatusInput): Promise<ActionResult> {
  const parsed = updateRecurringEarningStatusInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid recurring earning status payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const existing = await db.employeeEarning.findFirst({
    where: {
      id: payload.recurringEarningId,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      employeeId: true,
      earningTypeId: true,
      effectiveFrom: true,
      effectiveTo: true,
      isActive: true,
    },
  })

  if (!existing) {
    return { ok: false, error: "Recurring earning not found." }
  }

  const nextIsActive = payload.statusCode === "ACTIVE"
  if (existing.isActive === nextIsActive) {
    return { ok: true, message: "Recurring earning status is already up to date." }
  }

  if (nextIsActive) {
    const overlap = await findOverlappingActiveRecurringEarning({
      employeeId: existing.employeeId,
      earningTypeId: existing.earningTypeId,
      effectiveFrom: existing.effectiveFrom,
      effectiveTo: existing.effectiveTo,
      excludeId: existing.id,
    })
    if (overlap) {
      return {
        ok: false,
        error: "Cannot activate recurring earning because it overlaps another active record for the same employee and earning type.",
      }
    }
  }

  try {
    await db.employeeEarning.update({
      where: { id: existing.id },
      data: { isActive: nextIsActive },
    })

    await createAuditLog({
      tableName: "EmployeeEarning",
      recordId: existing.id,
      action: "UPDATE",
      userId: context.userId,
      reason: "UPDATE_RECURRING_EARNING_STATUS",
      changes: [{ fieldName: "isActive", oldValue: existing.isActive, newValue: nextIsActive }],
    })

    revalidateRecurringEarnings(context.companyId)
    return { ok: true, message: "Recurring earning status updated." }
  } catch (error) {
    console.error("[updateRecurringEarningStatusAction] Failed to update recurring earning status", {
      companyId: context.companyId,
      recurringEarningId: payload.recurringEarningId,
      statusCode: payload.statusCode,
      error,
    })
    return { ok: false, error: "Failed to update recurring earning status." }
  }
}

export async function createEarningTypeAction(input: CreateEarningTypeInput): Promise<UpsertEarningTypeResult> {
  const parsed = createEarningTypeInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid earning type payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  if (isDisallowedRecurringEarningType(payload.code, payload.name)) {
    return {
      ok: false,
      error: "This code/name is reserved for variable payroll lines and cannot be created as recurring earning type.",
    }
  }

  const duplicate = await db.earningType.findFirst({
    where: {
      companyId: context.companyId,
      code: payload.code,
    },
    select: { id: true },
  })
  if (duplicate) {
    return { ok: false, error: "Earning type code already exists for this company." }
  }

  try {
    const created = await db.earningType.create({
      data: {
        companyId: context.companyId,
        code: payload.code,
        name: payload.name,
        description: payload.description?.trim() || null,
        isTaxable: payload.isTaxable,
        isIncludedInGross: true,
        isIncludedIn13thMonth: payload.isIncludedIn13thMonth,
        frequencyCode: payload.frequencyCode,
        calculationMethodCode: "FIXED_AMOUNT",
        requiresApproval: false,
      },
      select: { id: true },
    })

    await createAuditLog({
      tableName: "EarningType",
      recordId: created.id,
      action: "CREATE",
      userId: context.userId,
      reason: "CREATE_EARNING_TYPE",
      changes: [
        { fieldName: "code", newValue: payload.code },
        { fieldName: "name", newValue: payload.name },
        { fieldName: "isTaxable", newValue: payload.isTaxable },
      ],
    })

    revalidateRecurringEarnings(context.companyId)
    return { ok: true, message: "Earning type created successfully.", earningTypeId: created.id }
  } catch (error) {
    console.error("[createEarningTypeAction] Failed to create earning type", {
      companyId: context.companyId,
      code: payload.code,
      name: payload.name,
      error,
    })
    return { ok: false, error: "Failed to create earning type." }
  }
}

export async function updateEarningTypeAction(input: UpdateEarningTypeInput): Promise<UpsertEarningTypeResult> {
  const parsed = updateEarningTypeInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid earning type payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  if (isDisallowedRecurringEarningType(payload.code, payload.name)) {
    return {
      ok: false,
      error: "This code/name is reserved for variable payroll lines and cannot be used as recurring earning type.",
    }
  }

  const existing = await db.earningType.findFirst({
    where: {
      id: payload.earningTypeId,
      companyId: context.companyId,
    },
    select: {
      id: true,
      code: true,
      name: true,
      isTaxable: true,
      isIncludedIn13thMonth: true,
      frequencyCode: true,
    },
  })
  if (!existing) {
    return { ok: false, error: "Earning type not found or cannot be edited." }
  }

  const duplicate = await db.earningType.findFirst({
    where: {
      companyId: context.companyId,
      code: payload.code,
      id: { not: payload.earningTypeId },
    },
    select: { id: true },
  })
  if (duplicate) {
    return { ok: false, error: "Earning type code already exists for this company." }
  }

  try {
    await db.earningType.update({
      where: { id: existing.id },
      data: {
        code: payload.code,
        name: payload.name,
        description: payload.description?.trim() || null,
        isTaxable: payload.isTaxable,
        isIncludedInGross: true,
        isIncludedIn13thMonth: payload.isIncludedIn13thMonth,
        frequencyCode: payload.frequencyCode,
      },
    })

    await createAuditLog({
      tableName: "EarningType",
      recordId: existing.id,
      action: "UPDATE",
      userId: context.userId,
      reason: "UPDATE_EARNING_TYPE",
      changes: [
        { fieldName: "code", oldValue: existing.code, newValue: payload.code },
        { fieldName: "name", oldValue: existing.name, newValue: payload.name },
        { fieldName: "isTaxable", oldValue: existing.isTaxable, newValue: payload.isTaxable },
        {
          fieldName: "isIncludedIn13thMonth",
          oldValue: existing.isIncludedIn13thMonth,
          newValue: payload.isIncludedIn13thMonth,
        },
        { fieldName: "frequencyCode", oldValue: existing.frequencyCode, newValue: payload.frequencyCode },
      ],
    })

    revalidateRecurringEarnings(context.companyId)
    return { ok: true, message: "Earning type updated successfully.", earningTypeId: existing.id }
  } catch (error) {
    console.error("[updateEarningTypeAction] Failed to update earning type", {
      companyId: context.companyId,
      earningTypeId: existing.id,
      code: payload.code,
      error,
    })
    return { ok: false, error: "Failed to update earning type." }
  }
}
