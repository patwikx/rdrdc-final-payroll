"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const archivePayrollYearInputSchema = z.object({
  companyId: z.string().uuid(),
  patternId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
})

type ArchivePayrollYearInput = z.infer<typeof archivePayrollYearInputSchema>

type ArchivePayrollYearActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

export async function archivePayrollYearAction(
  input: ArchivePayrollYearInput
): Promise<ArchivePayrollYearActionResult> {
  const parsed = archivePayrollYearInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid archive payload at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid archive payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to payroll settings." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const pattern = await tx.payPeriodPattern.findFirst({
        where: {
          id: payload.patternId,
          companyId: context.companyId,
        },
        select: { id: true, code: true, name: true },
      })

      if (!pattern) {
        return { ok: false as const, error: "Payroll policy pattern not found for this company." }
      }

      const periods = await tx.payPeriod.findMany({
        where: {
          patternId: payload.patternId,
          year: payload.year,
        },
        select: {
          id: true,
          statusCode: true,
        },
      })

      if (periods.length === 0) {
        return {
          ok: false as const,
          error: `No payroll period rows found for ${payload.year}. Generate the year first.`,
        }
      }

      const unlockedPeriods = periods.filter((period) => period.statusCode !== "LOCKED")

      if (unlockedPeriods.length === 0) {
        return { ok: true as const, message: `Payroll year ${payload.year} is already locked.` }
      }

      await tx.payPeriod.updateMany({
        where: {
          patternId: payload.patternId,
          year: payload.year,
          statusCode: { not: "LOCKED" },
        },
        data: {
          statusCode: "LOCKED",
          lockedAt: new Date(),
          lockedById: context.userId,
        },
      })

      await createAuditLog(
        {
          tableName: "PayPeriod",
          recordId: `${payload.patternId}:${payload.year}`,
          action: "UPDATE",
          userId: context.userId,
          reason: "PAYROLL_YEAR_LOCKED",
          changes: [
            { fieldName: "patternId", newValue: payload.patternId },
            { fieldName: "year", newValue: payload.year },
            { fieldName: "lockedRows", newValue: unlockedPeriods.length },
            { fieldName: "statusCode", newValue: "LOCKED" },
          ],
        },
        tx
      )

      return {
        ok: true as const,
        message: `Payroll year ${payload.year} archived. ${unlockedPeriods.length} rows locked.`,
      }
    })

    if (!result.ok) {
      return result
    }

    revalidatePath(`/${context.companyId}/settings/payroll`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to archive payroll year: ${message}` }
  }
}
