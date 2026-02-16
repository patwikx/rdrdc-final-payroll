"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import {
  changeOwnPasswordInputSchema,
  type ChangeOwnPasswordInput,
} from "@/modules/account/schemas/account-settings-schema"

type ChangeOwnPasswordActionResult = { ok: true; message: string } | { ok: false; error: string }

export async function changeOwnPasswordAction(
  input: ChangeOwnPasswordInput
): Promise<ChangeOwnPasswordActionResult> {
  const parsed = changeOwnPasswordInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password update payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const existing = await db.user.findUnique({
    where: { id: context.userId },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
    },
  })

  if (!existing || !existing.isActive) {
    return { ok: false, error: "Active user account not found." }
  }

  const currentPasswordValid = await bcrypt.compare(payload.currentPassword, existing.passwordHash)
  if (!currentPasswordValid) {
    return { ok: false, error: "Current password is incorrect." }
  }

  const newPasswordHash = await bcrypt.hash(payload.newPassword, 12)

  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: context.userId },
        data: {
          passwordHash: newPasswordHash,
        },
      })

      await createAuditLog(
        {
          tableName: "User",
          recordId: context.userId,
          action: "UPDATE",
          userId: context.userId,
          reason: "SELF_ACCOUNT_PASSWORD_UPDATED",
          changes: [{ fieldName: "passwordHash", oldValue: "REDACTED", newValue: "REDACTED" }],
        },
        tx
      )
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update password.",
    }
  }

  revalidatePath(`/${context.companyId}/account`)

  return { ok: true, message: "Password updated successfully." }
}
