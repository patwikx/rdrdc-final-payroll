"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const copyRanksFromCompanyInputSchema = z
  .object({
    companyId: z.string().uuid(),
    sourceCompanyId: z.string().uuid(),
    selectedSourceRankIds: z.array(z.string().uuid()).min(1, "Select at least one rank to copy."),
  })
  .refine((value) => value.companyId !== value.sourceCompanyId, {
    message: "Source company must be different from the target company.",
    path: ["sourceCompanyId"],
  })

type CopyRanksFromCompanyInput = z.infer<typeof copyRanksFromCompanyInputSchema>

type CopyRanksFromCompanyActionResult =
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

export async function copyRanksFromCompanyAction(
  input: CopyRanksFromCompanyInput
): Promise<CopyRanksFromCompanyActionResult> {
  const parsed = copyRanksFromCompanyInputSchema.safeParse(input)

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
  const selectedSourceRankIds = Array.from(new Set(payload.selectedSourceRankIds))

  if (selectedSourceRankIds.length === 0) {
    return { ok: false, error: "Select at least one rank to copy." }
  }

  const targetContext = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(targetContext.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to organization settings." }
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
      const sourceRows = await tx.rank.findMany({
        where: {
          companyId: sourceContext.companyId,
          id: {
            in: selectedSourceRankIds,
          },
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          level: true,
          category: true,
          parent: {
            select: {
              code: true,
            },
          },
          salaryGradeMin: true,
          salaryGradeMax: true,
          displayOrder: true,
          isActive: true,
        },
        orderBy: [{ level: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
      })

      if (sourceRows.length !== selectedSourceRankIds.length) {
        throw new Error("Some selected ranks are no longer available in the source company.")
      }

      if (sourceRows.length === 0) {
        return { copied: 0, created: 0, updated: 0 }
      }

      const sourceCodes = sourceRows.map((row) => normalizeCode(row.code))
      const sourceParentCodes = sourceRows
        .map((row) => row.parent?.code)
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeCode(value))

      const lookupCodes = Array.from(new Set([...sourceCodes, ...sourceParentCodes]))

      const existingTargetRows = await tx.rank.findMany({
        where: {
          companyId: targetContext.companyId,
          code: { in: lookupCodes },
        },
        select: {
          id: true,
          code: true,
        },
      })

      const existingByCode = new Map(existingTargetRows.map((row) => [normalizeCode(row.code), row.id]))
      const upsertedByCode = new Map<string, string>()

      let created = 0
      let updated = 0

      for (const sourceRow of sourceRows) {
        const safeCode = normalizeCode(sourceRow.code)
        const existingId = existingByCode.get(safeCode)

        if (existingId) {
          await tx.rank.update({
            where: { id: existingId },
            data: {
              code: safeCode,
              name: sourceRow.name,
              description: toNullable(sourceRow.description),
              level: sourceRow.level,
              category: toNullable(sourceRow.category),
              parentId: null,
              salaryGradeMin: toDecimalText(sourceRow.salaryGradeMin),
              salaryGradeMax: toDecimalText(sourceRow.salaryGradeMax),
              displayOrder: sourceRow.displayOrder,
              isActive: sourceRow.isActive,
              updatedById: targetContext.userId,
            },
          })
          upsertedByCode.set(safeCode, existingId)
          updated += 1
          continue
        }

        const createdRow = await tx.rank.create({
          data: {
            companyId: targetContext.companyId,
            code: safeCode,
            name: sourceRow.name,
            description: toNullable(sourceRow.description),
            level: sourceRow.level,
            category: toNullable(sourceRow.category),
            parentId: null,
            salaryGradeMin: toDecimalText(sourceRow.salaryGradeMin),
            salaryGradeMax: toDecimalText(sourceRow.salaryGradeMax),
            displayOrder: sourceRow.displayOrder,
            isActive: sourceRow.isActive,
            createdById: targetContext.userId,
            updatedById: targetContext.userId,
          },
          select: {
            id: true,
          },
        })

        upsertedByCode.set(safeCode, createdRow.id)
        created += 1
      }

      for (const sourceRow of sourceRows) {
        const safeCode = normalizeCode(sourceRow.code)
        const currentId = upsertedByCode.get(safeCode)

        if (!currentId) {
          continue
        }

        const sourceParentCode = sourceRow.parent?.code ? normalizeCode(sourceRow.parent.code) : null
        const mappedParentId =
          sourceParentCode && sourceParentCode !== safeCode
            ? upsertedByCode.get(sourceParentCode) ?? existingByCode.get(sourceParentCode) ?? null
            : null

        await tx.rank.update({
          where: { id: currentId },
          data: {
            parentId: mappedParentId,
            updatedById: targetContext.userId,
          },
        })
      }

      await createAuditLog(
        {
          tableName: "Rank",
          recordId: `${targetContext.companyId}:${sourceContext.companyId}`,
          action: "CREATE",
          userId: targetContext.userId,
          reason: "RANKS_COPIED_FROM_COMPANY",
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

    revalidatePath(`/${targetContext.companyId}/settings/organization`)
    revalidatePath(`/${targetContext.companyId}/settings/organization/ranks`)

    if (summary.copied === 0) {
      return { ok: true, message: `No ranks found in ${sourceContext.companyName} to copy.` }
    }

    return {
      ok: true,
      message: `Copied ${summary.copied} rank(s) from ${sourceContext.companyName}. ${summary.created} created, ${summary.updated} updated.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to copy ranks: ${message}` }
  }
}
