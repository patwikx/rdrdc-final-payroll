"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const deleteWorkScheduleInputSchema = z.object({
  companyId: z.string().uuid(),
  workScheduleId: z.string().uuid(),
})

type DeleteWorkScheduleInput = z.infer<typeof deleteWorkScheduleInputSchema>

type DeleteWorkScheduleResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

export async function deleteWorkScheduleAction(
  input: DeleteWorkScheduleInput
): Promise<DeleteWorkScheduleResult> {
  const parsed = deleteWorkScheduleInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid delete payload at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid delete payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to work schedules." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.workSchedule.findFirst({
        where: { id: payload.workScheduleId, companyId: context.companyId },
        select: { id: true, code: true, name: true },
      })

      if (!existing) {
        throw new Error("Work schedule not found.")
      }

      await tx.workSchedule.delete({ where: { id: existing.id } })

      await createAuditLog(
        {
          tableName: "WorkSchedule",
          recordId: existing.id,
          action: "DELETE",
          userId: context.userId,
          reason: "WORK_SCHEDULE_DELETED",
          changes: [
            { fieldName: "code", oldValue: existing.code },
            { fieldName: "name", oldValue: existing.name },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/attendance`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return { ok: true, message: "Work schedule deleted successfully." }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { ok: false, error: "This schedule is currently assigned and cannot be deleted." }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to delete work schedule: ${message}` }
  }
}
