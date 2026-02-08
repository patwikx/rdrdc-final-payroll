"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  payrollPoliciesInputSchema,
  type PayrollPoliciesInput,
} from "@/modules/settings/payroll/schemas/payroll-policies-schema"

type UpdatePayrollPoliciesActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  return value
}

const parsePhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}


export async function updatePayrollPoliciesAction(
  input: PayrollPoliciesInput
): Promise<UpdatePayrollPoliciesActionResult> {
  const parsed = payrollPoliciesInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid payroll policy at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid payroll policies payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to payroll settings." }
  }

  try {
    await db.$transaction(async (tx) => {
      const upsertTarget = payload.patternId
        ? { id: payload.patternId }
        : { companyId_code: { companyId: context.companyId, code: payload.code } }

      const record = await tx.payPeriodPattern.upsert({
        where: upsertTarget,
        update: {
          companyId: context.companyId,
          code: payload.code,
          name: payload.name,
          description: toNullable(payload.description),
          payFrequencyCode: payload.payFrequencyCode,
          periodsPerYear: payload.periodsPerYear,
          statutoryDeductionSchedule: payload.statutoryDeductionSchedule,
          paymentDayOffset: payload.paymentDayOffset,
          effectiveFrom: parsePhDate(payload.effectiveFrom),
          effectiveTo: payload.effectiveTo ? parsePhDate(payload.effectiveTo) : null,
          isActive: payload.isActive,
        },
        create: {
          companyId: context.companyId,
          code: payload.code,
          name: payload.name,
          description: toNullable(payload.description),
          payFrequencyCode: payload.payFrequencyCode,
          periodsPerYear: payload.periodsPerYear,
          statutoryDeductionSchedule: payload.statutoryDeductionSchedule,
          paymentDayOffset: payload.paymentDayOffset,
          effectiveFrom: parsePhDate(payload.effectiveFrom),
          effectiveTo: payload.effectiveTo ? parsePhDate(payload.effectiveTo) : null,
          isActive: payload.isActive,
        },
      })

      for (const row of payload.periodRows) {
        const rowWhere = row.id
          ? { id: row.id }
          : {
              patternId_year_periodNumber: {
                patternId: record.id,
                year: row.year,
                periodNumber: row.periodNumber,
              },
            }

        await tx.payPeriod.upsert({
          where: rowWhere,
          update: {
            patternId: record.id,
            year: row.year,
            periodNumber: row.periodNumber,
            periodHalf: row.periodHalf,
            cutoffStartDate: parsePhDate(row.cutoffStartDate),
            cutoffEndDate: parsePhDate(row.cutoffEndDate),
            paymentDate: parsePhDate(row.paymentDate),
            statusCode: row.statusCode,
            workingDays: row.workingDays ?? null,
          },
          create: {
            patternId: record.id,
            year: row.year,
            periodNumber: row.periodNumber,
            periodHalf: row.periodHalf,
            cutoffStartDate: parsePhDate(row.cutoffStartDate),
            cutoffEndDate: parsePhDate(row.cutoffEndDate),
            paymentDate: parsePhDate(row.paymentDate),
            statusCode: row.statusCode,
            workingDays: row.workingDays ?? null,
          },
        })
      }

      await createAuditLog(
        {
          tableName: "PayPeriodPattern",
          recordId: record.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "PAYROLL_POLICIES_UPDATED",
          changes: [
            { fieldName: "code", newValue: payload.code },
            { fieldName: "name", newValue: payload.name },
            { fieldName: "payFrequencyCode", newValue: payload.payFrequencyCode },
            { fieldName: "statutoryDeductionSchedule", newValue: payload.statutoryDeductionSchedule },
            { fieldName: "isActive", newValue: payload.isActive },
            { fieldName: "periodRows.count", newValue: payload.periodRows.length },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/payroll`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return { ok: true, message: "Payroll policies updated successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to update payroll policies: ${message}` }
  }
}
