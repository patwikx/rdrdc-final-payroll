"use server"

import { revalidatePath } from "next/cache"
import { RecurringDeductionType, type CompanyRole } from "@prisma/client"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly } from "@/lib/ph-time"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess } from "@/modules/auth/utils/authorization-policy"
import {
  createDeductionTypeInputSchema,
  createRecurringDeductionInputSchema,
  updateRecurringDeductionStatusInputSchema,
  type CreateDeductionTypeInput,
  type CreateRecurringDeductionInput,
  type UpdateRecurringDeductionStatusInput,
} from "@/modules/payroll/schemas/recurring-deduction-schema"

type ActionResult = { ok: true; message: string } | { ok: false; error: string }
type CreateDeductionTypeResult =
  | { ok: true; message: string; deductionTypeId: string }
  | { ok: false; error: string }

const toDecimalText = (value: number): string => value.toFixed(2)

const toPhDateOnlyUtc = (value: string): Date => {
  const parsed = parsePhDateInputToUtcDateOnly(value)
  if (parsed) {
    return parsed
  }

  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

const mapDeductionTypeToRecurringCategory = (code: string, name: string): RecurringDeductionType => {
  const haystack = `${code} ${name}`.toUpperCase()
  if (haystack.includes("UNION")) return RecurringDeductionType.UNION_DUES
  if (haystack.includes("COOP")) return RecurringDeductionType.COOP_SHARES
  if (haystack.includes("INSURANCE")) return RecurringDeductionType.INSURANCE
  if (haystack.includes("HMO")) return RecurringDeductionType.HMO
  if (haystack.includes("GARNISH")) return RecurringDeductionType.GARNISHMENT
  return RecurringDeductionType.SAVINGS
}

const ensurePayrollAccess = async (companyId: string) => {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "payroll")) {
    return { ok: false as const, error: "You do not have payroll access." }
  }
  return { ok: true as const, context }
}

const revalidateRecurringDeductions = (companyId: string) => {
  revalidatePath(`/${companyId}/payroll/recurring-deductions`)
}

export async function createRecurringDeductionAction(input: CreateRecurringDeductionInput): Promise<ActionResult> {
  const parsed = createRecurringDeductionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid recurring deduction payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
      isActive: true,
    },
    select: { id: true },
  })
  if (!employee) {
    return { ok: false, error: "Employee not found for active company." }
  }

  const deductionType = await db.deductionType.findFirst({
    where: {
      id: payload.deductionTypeId,
      isActive: true,
      OR: [{ companyId: context.companyId }, { companyId: null }],
    },
    select: { id: true, code: true, name: true },
  })

  if (!deductionType) {
    return { ok: false, error: "Deduction type is not available for this company." }
  }

  const deductionTypeCode = mapDeductionTypeToRecurringCategory(deductionType.code, deductionType.name)

  try {
    if (payload.recurringDeductionId) {
      const existing = await db.recurringDeduction.findFirst({
        where: {
          id: payload.recurringDeductionId,
          employee: { companyId: context.companyId },
        },
        select: {
          id: true,
          employeeId: true,
          deductionTypeId: true,
          amount: true,
          frequency: true,
          isPercentage: true,
          percentageRate: true,
          effectiveFrom: true,
          effectiveTo: true,
          description: true,
          remarks: true,
        },
      })

      if (!existing) {
        return { ok: false, error: "Recurring deduction not found for update." }
      }

      await db.recurringDeduction.update({
        where: { id: existing.id },
        data: {
          employeeId: payload.employeeId,
          deductionTypeId: payload.deductionTypeId,
          deductionTypeCode,
          description: payload.description?.trim() || null,
          amount: toDecimalText(payload.amount),
          isPercentage: payload.isPercentage,
          percentageRate: payload.isPercentage && payload.percentageRate !== undefined ? payload.percentageRate.toFixed(4) : null,
          frequency: payload.frequency,
          effectiveFrom: toPhDateOnlyUtc(payload.effectiveFrom),
          effectiveTo: payload.effectiveTo ? toPhDateOnlyUtc(payload.effectiveTo) : null,
          remarks: payload.remarks?.trim() || null,
        },
      })

      await createAuditLog({
        tableName: "RecurringDeduction",
        recordId: existing.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "UPDATE_RECURRING_DEDUCTION",
        changes: [
          { fieldName: "employeeId", oldValue: existing.employeeId, newValue: payload.employeeId },
          { fieldName: "deductionTypeId", oldValue: existing.deductionTypeId, newValue: payload.deductionTypeId },
          { fieldName: "amount", oldValue: Number(existing.amount), newValue: payload.amount },
          { fieldName: "frequency", oldValue: existing.frequency, newValue: payload.frequency },
        ],
      })

      revalidateRecurringDeductions(context.companyId)
      return { ok: true, message: "Recurring deduction updated successfully." }
    }

    const created = await db.recurringDeduction.create({
      data: {
        employeeId: payload.employeeId,
        deductionTypeId: payload.deductionTypeId,
        deductionTypeCode,
        description: payload.description?.trim() || null,
        amount: toDecimalText(payload.amount),
        isPercentage: payload.isPercentage,
        percentageRate: payload.isPercentage && payload.percentageRate !== undefined ? payload.percentageRate.toFixed(4) : null,
        frequency: payload.frequency,
        effectiveFrom: toPhDateOnlyUtc(payload.effectiveFrom),
        effectiveTo: payload.effectiveTo ? toPhDateOnlyUtc(payload.effectiveTo) : null,
        remarks: payload.remarks?.trim() || null,
      },
      select: { id: true },
    })

    await createAuditLog({
      tableName: "RecurringDeduction",
      recordId: created.id,
      action: "CREATE",
      userId: context.userId,
      reason: "CREATE_RECURRING_DEDUCTION",
      changes: [
        { fieldName: "employeeId", newValue: payload.employeeId },
        { fieldName: "deductionTypeId", newValue: payload.deductionTypeId },
        { fieldName: "deductionTypeCode", newValue: deductionTypeCode },
        { fieldName: "amount", newValue: payload.amount },
        { fieldName: "frequency", newValue: payload.frequency },
      ],
    })

    revalidateRecurringDeductions(context.companyId)
    return { ok: true, message: "Recurring deduction created successfully." }
  } catch (error) {
    console.error("[createRecurringDeductionAction] Failed to create recurring deduction", {
      companyId: context.companyId,
      employeeId: payload.employeeId,
      deductionTypeId: payload.deductionTypeId,
      error,
    })
    return { ok: false, error: "Failed to create recurring deduction." }
  }
}

export async function updateRecurringDeductionStatusAction(input: UpdateRecurringDeductionStatusInput): Promise<ActionResult> {
  const parsed = updateRecurringDeductionStatusInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid recurring deduction status payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const recurring = await db.recurringDeduction.findFirst({
    where: {
      id: payload.recurringDeductionId,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      statusCode: true,
    },
  })

  if (!recurring) {
    return { ok: false, error: "Recurring deduction not found." }
  }

  if (recurring.statusCode === payload.statusCode) {
    return { ok: true, message: "Recurring deduction status is already up to date." }
  }

  try {
    await db.recurringDeduction.update({
      where: { id: recurring.id },
      data: { statusCode: payload.statusCode },
    })

    await createAuditLog({
      tableName: "RecurringDeduction",
      recordId: recurring.id,
      action: "UPDATE",
      userId: context.userId,
      reason: "UPDATE_RECURRING_DEDUCTION_STATUS",
      changes: [{ fieldName: "statusCode", oldValue: recurring.statusCode, newValue: payload.statusCode }],
    })

    revalidateRecurringDeductions(context.companyId)
    return { ok: true, message: "Recurring deduction status updated." }
  } catch (error) {
    console.error("[updateRecurringDeductionStatusAction] Failed to update recurring deduction status", {
      companyId: context.companyId,
      recurringDeductionId: payload.recurringDeductionId,
      statusCode: payload.statusCode,
      error,
    })
    return { ok: false, error: "Failed to update recurring deduction status." }
  }
}

export async function createDeductionTypeAction(input: CreateDeductionTypeInput): Promise<CreateDeductionTypeResult> {
  const parsed = createDeductionTypeInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid deduction type payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const duplicate = await db.deductionType.findFirst({
    where: {
      companyId: context.companyId,
      code: payload.code,
    },
    select: { id: true },
  })

  if (duplicate) {
    return { ok: false, error: "Deduction type code already exists for this company." }
  }

  try {
    const created = await db.deductionType.create({
      data: {
        companyId: context.companyId,
        code: payload.code,
        name: payload.name,
        description: payload.description?.trim() || null,
        isMandatory: false,
        isPreTax: payload.isPreTax,
        payPeriodApplicability: payload.payPeriodApplicability,
        percentageBase: "GROSS",
      },
      select: { id: true },
    })

    await createAuditLog({
      tableName: "DeductionType",
      recordId: created.id,
      action: "CREATE",
      userId: context.userId,
      reason: "CREATE_DEDUCTION_TYPE",
      changes: [
        { fieldName: "code", newValue: payload.code },
        { fieldName: "name", newValue: payload.name },
        { fieldName: "isPreTax", newValue: payload.isPreTax },
      ],
    })

    revalidateRecurringDeductions(context.companyId)
    return { ok: true, message: "Deduction type created successfully.", deductionTypeId: created.id }
  } catch (error) {
    console.error("[createDeductionTypeAction] Failed to create deduction type", {
      companyId: context.companyId,
      code: payload.code,
      name: payload.name,
      error,
    })
    return { ok: false, error: "Failed to create deduction type." }
  }
}
