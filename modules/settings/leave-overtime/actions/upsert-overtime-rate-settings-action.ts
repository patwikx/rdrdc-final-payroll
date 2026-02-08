"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  upsertOvertimeRateSettingsInputSchema,
  type UpsertOvertimeRateSettingsInput,
} from "@/modules/settings/leave-overtime/schemas/leave-ot-policy-settings-schema"

type UpsertOvertimeRateSettingsActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const parseDateInput = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

const toDecimalText = (value: number): string => {
  return value.toFixed(2)
}

export async function upsertOvertimeRateSettingsAction(
  input: UpsertOvertimeRateSettingsInput
): Promise<UpsertOvertimeRateSettingsActionResult> {
  const parsed = upsertOvertimeRateSettingsInputSchema.safeParse(input)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: issue
        ? `Invalid overtime policy payload at ${issue.path.join(".")}: ${issue.message}`
        : "Invalid overtime policy payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to overtime policy settings." }
  }

  const effectiveFrom = parseDateInput(payload.effectiveFrom)

  try {
    await db.$transaction(async (tx) => {
      const overtimeRate = payload.overtimeRateId
        ? await tx.overtimeRate.update({
            where: { id: payload.overtimeRateId },
            data: {
              overtimeTypeCode: payload.overtimeTypeCode,
              description: payload.description?.trim() || null,
              rateMultiplier: toDecimalText(payload.rateMultiplier),
              isActive: payload.isActive,
              effectiveFrom,
            },
            select: { id: true },
          })
        : await tx.overtimeRate.create({
            data: {
              overtimeTypeCode: payload.overtimeTypeCode,
              description: payload.description?.trim() || null,
              rateMultiplier: toDecimalText(payload.rateMultiplier),
              isActive: payload.isActive,
              effectiveFrom,
            },
            select: { id: true },
          })

      await createAuditLog(
        {
          tableName: "OvertimeRate",
          recordId: overtimeRate.id,
          action: payload.overtimeRateId ? "UPDATE" : "CREATE",
          userId: context.userId,
          reason: "UPSERT_OVERTIME_RATE_SETTINGS",
          changes: [
            { fieldName: "overtimeTypeCode", newValue: payload.overtimeTypeCode },
            { fieldName: "rateMultiplier", newValue: payload.rateMultiplier },
            { fieldName: "isActive", newValue: payload.isActive },
            { fieldName: "effectiveFrom", newValue: payload.effectiveFrom },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/leave-overtime`)

    return { ok: true, message: "Overtime policy saved successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to save overtime policy: ${message}` }
  }
}
