import { db } from "@/lib/db"

export type SessionMembershipStatus =
  | {
      valid: true
      selectedCompanyId: string | null
      defaultCompanyId: string | null
      hasActiveCompanyAccess: boolean
    }
  | {
      valid: false
      reason: "USER_NOT_FOUND" | "USER_INACTIVE" | "NO_ACTIVE_COMPANY_ACCESS"
    }

export async function getSessionMembershipStatus(userId: string): Promise<SessionMembershipStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
      selectedCompanyId: true,
      companyAccess: {
        where: {
          isActive: true,
          company: {
            isActive: true,
          },
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: {
          companyId: true,
          isDefault: true,
        },
      },
    },
  })

  if (!user) {
    return { valid: false, reason: "USER_NOT_FOUND" }
  }

  if (!user.isActive) {
    return { valid: false, reason: "USER_INACTIVE" }
  }

  if (user.companyAccess.length === 0) {
    return { valid: false, reason: "NO_ACTIVE_COMPANY_ACCESS" }
  }

  const defaultCompanyId = user.companyAccess.find((access) => access.isDefault)?.companyId ?? user.companyAccess[0]?.companyId ?? null

  return {
    valid: true,
    selectedCompanyId: user.selectedCompanyId,
    defaultCompanyId,
    hasActiveCompanyAccess: true,
  }
}
