import { auth } from "@/auth"
import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
  getUserCompanyOptions,
} from "@/modules/auth/utils/active-company-context"

import { CompanySwitcher } from "./company-switcher"

export async function CompanySwitcherField() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  let activeCompany: Awaited<ReturnType<typeof getActiveCompanyContext>>
  let options: Awaited<ReturnType<typeof getUserCompanyOptions>>

  try {
    ;[activeCompany, options] = await Promise.all([
      getActiveCompanyContext(),
      getUserCompanyOptions(session.user.id),
    ])
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      return null
    }

    throw error
  }

  if (options.length <= 1) {
    return null
  }

  return <CompanySwitcher options={options} activeCompanyId={activeCompany.companyId} />
}
