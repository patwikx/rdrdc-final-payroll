import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getSetupState } from "@/modules/setup/utils/setup-state"

export default async function PostLoginRoutePage() {
  const setupState = await getSetupState()
  if (!setupState.isInitialized) {
    redirect("/setup")
  }

  const session = await auth()
  if (!session?.user) {
    redirect("/login?reason=invalid-session")
  }

  const companyId = session.user.selectedCompanyId ?? session.user.defaultCompanyId
  if (!companyId) {
    redirect("/logout?reason=invalid-session")
  }

  const role = session.user.companyRole ?? session.user.role ?? "COMPANY_ADMIN"
  const destination = role === "EMPLOYEE" ? `/${companyId}/employee-portal` : `/${companyId}/dashboard`
  redirect(destination)
}
