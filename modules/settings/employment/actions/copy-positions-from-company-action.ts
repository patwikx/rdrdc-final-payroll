"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const copyPositionsFromCompanyInputSchema = z
  .object({
    companyId: z.string().uuid(),
    sourceCompanyId: z.string().uuid(),
    selectedSourcePositionIds: z.array(z.string().uuid()).min(1, "Select at least one position to copy."),
  })
  .refine((value) => value.companyId !== value.sourceCompanyId, {
    message: "Source company must be different from the target company.",
    path: ["sourceCompanyId"],
  })

type CopyPositionsFromCompanyInput = z.infer<typeof copyPositionsFromCompanyInputSchema>

type CopyPositionsFromCompanyActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const toNullable = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  return value
}

const toDecimalText = (value: { toString(): string } | null): string | null => {
  if (!value) {
    return null
  }

  return Number(value.toString()).toFixed(2)
}

const normalizeCode = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, "_")

export async function copyPositionsFromCompanyAction(
  input: CopyPositionsFromCompanyInput
): Promise<CopyPositionsFromCompanyActionResult> {
  const parsed = copyPositionsFromCompanyInputSchema.safeParse(input)

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
  const selectedSourcePositionIds = Array.from(new Set(payload.selectedSourcePositionIds))

  if (selectedSourcePositionIds.length === 0) {
    return { ok: false, error: "Select at least one position to copy." }
  }

  const targetContext = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(targetContext.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to employment settings." }
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
      const sourceRows = await tx.position.findMany({
        where: {
          companyId: sourceContext.companyId,
          id: {
            in: selectedSourcePositionIds,
          },
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          level: true,
          jobFamily: true,
          jobGrade: true,
          salaryGradeMin: true,
          salaryGradeMax: true,
          minExperienceYears: true,
          educationRequired: true,
          displayOrder: true,
          isActive: true,
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      })

      if (sourceRows.length !== selectedSourcePositionIds.length) {
        throw new Error("Some selected positions are no longer available in the source company.")
      }

      if (sourceRows.length === 0) {
        return { copied: 0, created: 0, updated: 0 }
      }

      const sourceCodes = sourceRows.map((row) => normalizeCode(row.code))
      const existingTargetRows = await tx.position.findMany({
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
          await tx.position.update({
            where: { id: existingId },
            data: {
              code: safeCode,
              name: sourceRow.name,
              description: toNullable(sourceRow.description),
              level: sourceRow.level,
              jobFamily: toNullable(sourceRow.jobFamily),
              jobGrade: toNullable(sourceRow.jobGrade),
              salaryGradeMin: toDecimalText(sourceRow.salaryGradeMin),
              salaryGradeMax: toDecimalText(sourceRow.salaryGradeMax),
              minExperienceYears: sourceRow.minExperienceYears,
              educationRequired: toNullable(sourceRow.educationRequired),
              displayOrder: sourceRow.displayOrder,
              isActive: sourceRow.isActive,
              updatedById: targetContext.userId,
            },
          })
          updated += 1
          continue
        }

        await tx.position.create({
          data: {
            companyId: targetContext.companyId,
            code: safeCode,
            name: sourceRow.name,
            description: toNullable(sourceRow.description),
            level: sourceRow.level,
            jobFamily: toNullable(sourceRow.jobFamily),
            jobGrade: toNullable(sourceRow.jobGrade),
            salaryGradeMin: toDecimalText(sourceRow.salaryGradeMin),
            salaryGradeMax: toDecimalText(sourceRow.salaryGradeMax),
            minExperienceYears: sourceRow.minExperienceYears,
            educationRequired: toNullable(sourceRow.educationRequired),
            displayOrder: sourceRow.displayOrder,
            isActive: sourceRow.isActive,
            createdById: targetContext.userId,
            updatedById: targetContext.userId,
          },
        })
        created += 1
      }

      await createAuditLog(
        {
          tableName: "Position",
          recordId: `${targetContext.companyId}:${sourceContext.companyId}`,
          action: "CREATE",
          userId: targetContext.userId,
          reason: "POSITIONS_COPIED_FROM_COMPANY",
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

    revalidatePath(`/${targetContext.companyId}/settings/employment`)

    if (summary.copied === 0) {
      return { ok: true, message: `No positions found in ${sourceContext.companyName} to copy.` }
    }

    return {
      ok: true,
      message: `Copied ${summary.copied} position(s) from ${sourceContext.companyName}. ${summary.created} created, ${summary.updated} updated.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to copy positions: ${message}` }
  }
}
