"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const payrollPeriodRowInputSchema = z.object({
  id: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100),
  periodNumber: z.coerce.number().int().min(1).max(366),
  periodHalf: z.enum(["FIRST", "SECOND"]),
  cutoffStartDate: z.string().date(),
  cutoffEndDate: z.string().date(),
  paymentDate: z.string().date(),
  statusCode: z.enum(["OPEN", "PROCESSING", "CLOSED", "LOCKED"]),
  workingDays: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }

    return value
  }, z.coerce.number().int().min(0).max(31).optional()),
})

const savePayrollPeriodRowsInputSchema = z.object({
  companyId: z.string().uuid(),
  patternId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  periodRows: z.array(payrollPeriodRowInputSchema).min(1),
})

type SavePayrollPeriodRowsInput = z.infer<typeof savePayrollPeriodRowsInputSchema>

type SavePayrollPeriodRowsActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const parsePhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

export async function savePayrollPeriodRowsAction(
  input: SavePayrollPeriodRowsInput
): Promise<SavePayrollPeriodRowsActionResult> {
  const parsed = savePayrollPeriodRowsInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid period rows payload at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid payroll period rows payload.",
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

  if (payload.periodRows.some((row) => row.year !== payload.year)) {
    return { ok: false, error: "All period rows must match the selected year." }
  }

  try {
    await db.$transaction(async (tx) => {
      const pattern = await tx.payPeriodPattern.findFirst({
        where: {
          id: payload.patternId,
          companyId: context.companyId,
        },
        select: { id: true },
      })

      if (!pattern) {
        throw new Error("Payroll policy pattern not found for this company.")
      }

      for (const row of payload.periodRows) {
        const rowWhere = row.id
          ? { id: row.id }
          : {
              patternId_year_periodNumber: {
                patternId: pattern.id,
                year: row.year,
                periodNumber: row.periodNumber,
              },
            }

        await tx.payPeriod.upsert({
          where: rowWhere,
          update: {
            patternId: pattern.id,
            year: row.year,
            periodNumber: row.periodNumber,
            periodHalf: row.periodHalf,
            cutoffStartDate: parsePhDate(row.cutoffStartDate),
            cutoffEndDate: parsePhDate(row.cutoffEndDate),
            paymentDate: parsePhDate(row.paymentDate),
            statusCode: row.statusCode,
            workingDays: row.workingDays ?? null,
            lockedAt: row.statusCode === "LOCKED" ? new Date() : null,
            lockedById: row.statusCode === "LOCKED" ? context.userId : null,
          },
          create: {
            patternId: pattern.id,
            year: row.year,
            periodNumber: row.periodNumber,
            periodHalf: row.periodHalf,
            cutoffStartDate: parsePhDate(row.cutoffStartDate),
            cutoffEndDate: parsePhDate(row.cutoffEndDate),
            paymentDate: parsePhDate(row.paymentDate),
            statusCode: row.statusCode,
            workingDays: row.workingDays ?? null,
            lockedAt: row.statusCode === "LOCKED" ? new Date() : null,
            lockedById: row.statusCode === "LOCKED" ? context.userId : null,
          },
        })
      }

      await createAuditLog(
        {
          tableName: "PayPeriod",
          recordId: `${pattern.id}:${payload.year}`,
          action: "UPDATE",
          userId: context.userId,
          reason: "PAYROLL_PERIOD_ROWS_UPDATED",
          changes: [
            { fieldName: "year", newValue: payload.year },
            { fieldName: "rows.count", newValue: payload.periodRows.length },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/payroll`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return { ok: true, message: `Pay period rows for ${payload.year} saved successfully.` }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to save pay period rows: ${message}` }
  }
}
