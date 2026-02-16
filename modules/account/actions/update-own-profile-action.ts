"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import {
  updateOwnProfileInputSchema,
  type UpdateOwnProfileInput,
} from "@/modules/account/schemas/account-settings-schema"

type UpdateOwnProfileActionResult = { ok: true; message: string } | { ok: false; error: string }

export async function updateOwnProfileAction(
  input: UpdateOwnProfileInput
): Promise<UpdateOwnProfileActionResult> {
  const parsed = updateOwnProfileInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile update payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const existing = await db.user.findUnique({
    where: { id: context.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
    },
  })

  if (!existing || !existing.isActive) {
    return { ok: false, error: "Active user account not found." }
  }

  const normalizedEmail = payload.email.trim()
  const firstName = payload.firstName.trim()
  const lastName = payload.lastName.trim()

  const emailChanged = existing.email !== normalizedEmail
  if (emailChanged) {
    const emailInUse = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (emailInUse && emailInUse.id !== context.userId) {
      return { ok: false, error: "Email address is already used by another account." }
    }
  }

  const changes: Array<{ fieldName: string; oldValue?: unknown; newValue?: unknown }> = []

  if (existing.firstName !== firstName) {
    changes.push({ fieldName: "firstName", oldValue: existing.firstName, newValue: firstName })
  }

  if (existing.lastName !== lastName) {
    changes.push({ fieldName: "lastName", oldValue: existing.lastName, newValue: lastName })
  }

  if (emailChanged) {
    changes.push({ fieldName: "email", oldValue: existing.email, newValue: normalizedEmail })
  }

  if (changes.length === 0) {
    return { ok: true, message: "Your account profile is already up to date." }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: context.userId },
        data: {
          firstName,
          lastName,
          email: normalizedEmail,
        },
      })

      await createAuditLog(
        {
          tableName: "User",
          recordId: context.userId,
          action: "UPDATE",
          userId: context.userId,
          reason: "SELF_ACCOUNT_PROFILE_UPDATED",
          changes,
        },
        tx
      )
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Email address is already used by another account." }
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update account profile.",
    }
  }

  revalidatePath(`/${context.companyId}/account`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return { ok: true, message: "Account profile updated successfully." }
}
