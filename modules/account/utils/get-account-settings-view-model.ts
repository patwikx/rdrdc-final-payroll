import type { ActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { db } from "@/lib/db"

export type AccountSettingsViewModel = {
  companyId: string
  companyName: string
  user: {
    id: string
    firstName: string
    lastName: string
    username: string
  }
}

export async function getAccountSettingsViewModel(
  context: ActiveCompanyContext
): Promise<AccountSettingsViewModel | null> {
  const user = await db.user.findUnique({
    where: { id: context.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      isActive: true,
    },
  })

  if (!user || !user.isActive) {
    return null
  }

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
    },
  }
}
