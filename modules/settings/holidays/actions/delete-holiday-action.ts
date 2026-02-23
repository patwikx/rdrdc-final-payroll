"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  deleteHolidayInputSchema,
  type DeleteHolidayInput,
} from "@/modules/settings/holidays/schemas/holiday-settings-schema"

type DeleteHolidayActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

export async function deleteHolidayAction(input: DeleteHolidayInput): Promise<DeleteHolidayActionResult> {
  const parsed = deleteHolidayInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid delete request at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid delete payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to holiday settings." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.holiday.findUnique({
        where: { id: payload.holidayId },
        select: {
          id: true,
          companyId: true,
          name: true,
          holidayDate: true,
          holidayTypeCode: true,
          payMultiplier: true,
          applicability: true,
          region: true,
          isActive: true,
        },
      })

      if (!existing || existing.companyId !== context.companyId) {
        throw new Error("Only company-owned holidays can be deleted.")
      }

      await tx.holiday.delete({
        where: { id: existing.id },
      })

      await createAuditLog(
        {
          tableName: "Holiday",
          recordId: existing.id,
          action: "DELETE",
          userId: context.userId,
          reason: "HOLIDAY_DELETED",
          changes: [
            { fieldName: "name", oldValue: existing.name },
            { fieldName: "holidayDate", oldValue: existing.holidayDate },
            { fieldName: "holidayTypeCode", oldValue: existing.holidayTypeCode },
            { fieldName: "payMultiplier", oldValue: existing.payMultiplier },
            { fieldName: "applicability", oldValue: existing.applicability },
            { fieldName: "region", oldValue: existing.region },
            { fieldName: "isActive", oldValue: existing.isActive },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/holidays`)
    revalidatePath(`/${context.companyId}/employee-portal`)

    return { ok: true, message: "Holiday deleted successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to delete holiday: ${message}` }
  }
}
