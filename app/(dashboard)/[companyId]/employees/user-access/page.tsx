import { redirect } from "next/navigation"
import { IconBuildingOff } from "@tabler/icons-react"

import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { UserAccessIterations } from "@/modules/employees/user-access/components/user-access-iterations"
import { getUserAccessPreviewData } from "@/modules/employees/user-access/utils/get-user-access-preview-data"

type UserAccessRouteProps = {
  params: Promise<{ companyId: string }>
}

export default async function UserAccessRoutePage({ params }: UserAccessRouteProps) {
  const { companyId } = await params

  let company: Awaited<ReturnType<typeof getActiveCompanyContext>> | null = null
  let noAccess = false

  try {
    company = await getActiveCompanyContext({ companyId })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      noAccess = true
    } else {
      throw error
    }
  }

  if (noAccess || !company) {
    try {
      const fallback = await getActiveCompanyContext()
      redirect(`/${fallback.companyId}/dashboard`)
    } catch {
      return (
        <main className="flex w-full flex-col gap-2 px-4 py-6 sm:px-6">
          <h1 className="inline-flex items-center gap-2 text-lg text-foreground"><IconBuildingOff className="size-5" /> No Company Access</h1>
          <p className="text-sm text-muted-foreground">Your account does not have an active company assignment yet.</p>
        </main>
      )
    }
  }

  const data = await getUserAccessPreviewData(company.companyId)

  return (
    <UserAccessIterations
      companyId={company.companyId}
      companyName={company.companyName}
      rows={data.rows}
      availableUsers={data.availableUsers}
      systemUsers={data.systemUsers}
    />
  )
}
