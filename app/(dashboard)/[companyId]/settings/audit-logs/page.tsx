import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { AuditLogsPage } from "@/modules/audit/components/audit-logs-page"
import { getAuditLogsViewModel } from "@/modules/audit/utils/get-audit-logs-view-model"

type AuditLogsRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    q?: string
    page?: string
    action?: string
    range?: string
    table?: string
  }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Audit Logs | ${company.companyName} | Final Payroll System`,
      description: `Review system audit trail for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Audit Logs | Final Payroll System",
      description: "Review system audit trail.",
    }
  }
}

export default async function AuditLogsRoutePage({ params, searchParams }: AuditLogsRouteProps) {
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
          <h1 className="text-lg font-semibold text-foreground">No Company Access</h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have an active company assignment yet. Please contact your administrator.
          </p>
        </main>
      )
    }
  }

  const page = Number(parsedSearch.page)
  const data = await getAuditLogsViewModel(company.companyId, {
    q: parsedSearch.q?.trim() ?? "",
    page: Number.isFinite(page) ? page : 1,
    action: parsedSearch.action,
    range: parsedSearch.range,
    table: parsedSearch.table,
  })

  return <AuditLogsPage data={data} />
}
