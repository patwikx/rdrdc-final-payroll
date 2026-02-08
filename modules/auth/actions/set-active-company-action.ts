"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import {
  ActiveCompanyContextError,
  persistSelectedCompanyForUser,
} from "@/modules/auth/utils/active-company-context"
import { getSessionMembershipStatus } from "@/modules/auth/utils/session-membership"
import { db } from "@/lib/db"

const setActiveCompanySchema = z.object({
  companyId: z.string().uuid(),
})

export type SetActiveCompanyActionResult =
  | { ok: true; companyId: string }
  | { ok: false; error: string }

export async function setActiveCompanyAction(input: {
  companyId: string
}): Promise<SetActiveCompanyActionResult> {
  const parsedInput = setActiveCompanySchema.safeParse(input)

  if (!parsedInput.success) {
    return { ok: false, error: "Invalid company selection." }
  }

  const session = await auth()

  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized." }
  }

  const membershipStatus = await getSessionMembershipStatus(session.user.id)
  if (!membershipStatus.valid) {
    return { ok: false, error: "Session is no longer valid. Please sign in again." }
  }

  const previousSelectedCompany = await db.user.findUnique({
    where: { id: session.user.id },
    select: { selectedCompanyId: true },
  })

  try {
    await persistSelectedCompanyForUser({
      userId: session.user.id,
      companyId: parsedInput.data.companyId,
    })

    await createAuditLog({
      tableName: "User",
      recordId: session.user.id,
      action: "UPDATE",
      userId: session.user.id,
      reason: "ACTIVE_COMPANY_SWITCHED",
      changes: [
        {
          fieldName: "selectedCompanyId",
          oldValue: previousSelectedCompany?.selectedCompanyId ?? null,
          newValue: parsedInput.data.companyId,
        },
      ],
    })

    revalidatePath("/")

    return { ok: true, companyId: parsedInput.data.companyId }
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      return { ok: false, error: error.message }
    }

    return { ok: false, error: "Failed to update active company." }
  }
}
