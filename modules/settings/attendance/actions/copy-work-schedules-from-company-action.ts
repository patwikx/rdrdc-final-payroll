"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const copyWorkSchedulesFromCompanyInputSchema = z
  .object({
    companyId: z.string().uuid(),
    sourceCompanyId: z.string().uuid(),
  })
  .refine((value) => value.companyId !== value.sourceCompanyId, {
    message: "Source company must be different from the target company.",
    path: ["sourceCompanyId"],
  })

type CopyWorkSchedulesFromCompanyInput = z.infer<typeof copyWorkSchedulesFromCompanyInputSchema>

type CopyWorkSchedulesFromCompanyActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const toNullable = <T,>(value: T | null | undefined): T | null => {
  if (value === undefined || value === null) {
    return null
  }

  return value
}

const normalizeCode = (value: string): string => value.trim()

const toNullableJsonInput = (
  value: Prisma.JsonValue
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput => {
  if (value === null) {
    return Prisma.DbNull
  }

  return value as Prisma.InputJsonValue
}

export async function copyWorkSchedulesFromCompanyAction(
  input: CopyWorkSchedulesFromCompanyInput
): Promise<CopyWorkSchedulesFromCompanyActionResult> {
  const parsed = copyWorkSchedulesFromCompanyInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid copy payload at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid copy payload.",
    }
  }

  const payload = parsed.data
  const targetContext = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(targetContext.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to attendance settings." }
  }

  if (targetContext.companyId !== payload.companyId) {
    return { ok: false, error: "Target company context mismatch." }
  }

  const sourceContext = await getActiveCompanyContext({ companyId: payload.sourceCompanyId })

  if (!hasModuleAccess(sourceContext.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to source company settings." }
  }

  if (sourceContext.companyId !== payload.sourceCompanyId) {
    return { ok: false, error: "Source company context mismatch." }
  }

  try {
    const summary = await db.$transaction(async (tx) => {
      const sourceRows = await tx.workSchedule.findMany({
        where: {
          companyId: sourceContext.companyId,
        },
        select: {
          code: true,
          name: true,
          description: true,
          scheduleTypeCode: true,
          workStartTime: true,
          workEndTime: true,
          breakStartTime: true,
          breakEndTime: true,
          breakDurationMins: true,
          gracePeriodMins: true,
          requiredHoursPerDay: true,
          restDays: true,
          dayOverrides: true,
          flexibleStartTime: true,
          flexibleEndTime: true,
          coreHoursStart: true,
          coreHoursEnd: true,
          effectiveFrom: true,
          effectiveTo: true,
          isActive: true,
        },
        orderBy: [{ createdAt: "asc" }],
      })

      if (sourceRows.length === 0) {
        return { copied: 0, created: 0, updated: 0 }
      }

      const sourceCodes = sourceRows.map((row) => normalizeCode(row.code))
      const existingTargetRows = await tx.workSchedule.findMany({
        where: {
          companyId: targetContext.companyId,
          code: {
            in: sourceCodes,
          },
        },
        select: {
          id: true,
          code: true,
        },
      })

      const existingByCode = new Map(existingTargetRows.map((row) => [normalizeCode(row.code), row.id]))

      let created = 0
      let updated = 0

      for (const sourceRow of sourceRows) {
        const safeCode = normalizeCode(sourceRow.code)
        const existingId = existingByCode.get(safeCode)

        if (existingId) {
          await tx.workSchedule.update({
            where: { id: existingId },
            data: {
              code: safeCode,
              name: sourceRow.name,
              description: toNullable(sourceRow.description),
              scheduleTypeCode: sourceRow.scheduleTypeCode,
              workStartTime: sourceRow.workStartTime,
              workEndTime: sourceRow.workEndTime,
              breakStartTime: toNullable(sourceRow.breakStartTime),
              breakEndTime: toNullable(sourceRow.breakEndTime),
              breakDurationMins: sourceRow.breakDurationMins,
              gracePeriodMins: sourceRow.gracePeriodMins,
              requiredHoursPerDay: sourceRow.requiredHoursPerDay,
              restDays: toNullableJsonInput(sourceRow.restDays),
              dayOverrides: toNullableJsonInput(sourceRow.dayOverrides),
              flexibleStartTime: toNullable(sourceRow.flexibleStartTime),
              flexibleEndTime: toNullable(sourceRow.flexibleEndTime),
              coreHoursStart: toNullable(sourceRow.coreHoursStart),
              coreHoursEnd: toNullable(sourceRow.coreHoursEnd),
              effectiveFrom: toNullable(sourceRow.effectiveFrom),
              effectiveTo: toNullable(sourceRow.effectiveTo),
              isActive: sourceRow.isActive,
            },
          })
          updated += 1
          continue
        }

        await tx.workSchedule.create({
          data: {
            companyId: targetContext.companyId,
            code: safeCode,
            name: sourceRow.name,
            description: toNullable(sourceRow.description),
            scheduleTypeCode: sourceRow.scheduleTypeCode,
            workStartTime: sourceRow.workStartTime,
            workEndTime: sourceRow.workEndTime,
            breakStartTime: toNullable(sourceRow.breakStartTime),
            breakEndTime: toNullable(sourceRow.breakEndTime),
            breakDurationMins: sourceRow.breakDurationMins,
            gracePeriodMins: sourceRow.gracePeriodMins,
            requiredHoursPerDay: sourceRow.requiredHoursPerDay,
            restDays: toNullableJsonInput(sourceRow.restDays),
            dayOverrides: toNullableJsonInput(sourceRow.dayOverrides),
            flexibleStartTime: toNullable(sourceRow.flexibleStartTime),
            flexibleEndTime: toNullable(sourceRow.flexibleEndTime),
            coreHoursStart: toNullable(sourceRow.coreHoursStart),
            coreHoursEnd: toNullable(sourceRow.coreHoursEnd),
            effectiveFrom: toNullable(sourceRow.effectiveFrom),
            effectiveTo: toNullable(sourceRow.effectiveTo),
            isActive: sourceRow.isActive,
          },
        })
        created += 1
      }

      await createAuditLog(
        {
          tableName: "WorkSchedule",
          recordId: `${targetContext.companyId}:${sourceContext.companyId}`,
          action: "CREATE",
          userId: targetContext.userId,
          reason: "WORK_SCHEDULES_COPIED_FROM_COMPANY",
          changes: [
            { fieldName: "sourceCompanyId", newValue: sourceContext.companyId },
            { fieldName: "targetCompanyId", newValue: targetContext.companyId },
            { fieldName: "copiedCount", newValue: sourceRows.length },
            { fieldName: "createdCount", newValue: created },
            { fieldName: "updatedCount", newValue: updated },
          ],
        },
        tx
      )

      return { copied: sourceRows.length, created, updated }
    })

    revalidatePath(`/${targetContext.companyId}/settings/attendance`)

    if (summary.copied === 0) {
      return { ok: true, message: `No work schedules found in ${sourceContext.companyName} to copy.` }
    }

    return {
      ok: true,
      message: `Copied ${summary.copied} work schedule(s) from ${sourceContext.companyName}. ${summary.created} created, ${summary.updated} updated.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to copy work schedules: ${message}` }
  }
}
