import { redirect } from "next/navigation"
import { IconBuildingOff } from "@tabler/icons-react"

import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { UserAccessPage } from "@/modules/employees/user-access/components/user-access-page"
import { getUserAccessPreviewData } from "@/modules/employees/user-access/utils/get-user-access-preview-data"

type UserAccessRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    q?: string
    empPage?: string
    sysPage?: string
    empLink?: string
    sysLink?: string
  }>
}

export default async function UserAccessRoutePage({ params, searchParams }: UserAccessRouteProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}

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

  const employeePage = Number(parsedSearch.empPage)
  const systemUserPage = Number(parsedSearch.sysPage)

  const data = await getUserAccessPreviewData(company.companyId, {
    query: parsedSearch.q?.trim() ?? "",
    employeePage: Number.isFinite(employeePage) ? employeePage : 1,
    systemUserPage: Number.isFinite(systemUserPage) ? systemUserPage : 1,
    employeeLinkFilter:
      parsedSearch.empLink === "LINKED" || parsedSearch.empLink === "UNLINKED"
        ? parsedSearch.empLink
        : "ALL",
    systemLinkFilter:
      parsedSearch.sysLink === "LINKED" || parsedSearch.sysLink === "UNLINKED"
        ? parsedSearch.sysLink
        : "ALL",
  })

  return (
    <UserAccessPage
      companyId={company.companyId}
      companyName={company.companyName}
      rows={data.rows}
      availableUsers={data.availableUsers}
      systemUsers={data.systemUsers}
      query={data.query}
      employeeLinkFilter={data.employeeLinkFilter}
      systemLinkFilter={data.systemLinkFilter}
      employeePagination={data.employeePagination}
      systemUserPagination={data.systemUserPagination}
    />
  )
}
