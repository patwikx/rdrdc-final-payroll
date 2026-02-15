import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { IconShieldCheck, IconBuildingOff } from "@tabler/icons-react"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { ApprovalQueuePage } from "@/modules/approvals/queue/components/approval-queue-page"
import { getApprovalQueueData } from "@/modules/approvals/queue/utils/get-approval-queue-data"

type ApprovalQueueRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    q?: string
    kind?: string
    page?: string
  }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Approval Queue | ${company.companyName} | Final Payroll System`,
      description: `Final HR validation queue for supervisor-approved leave and overtime requests in ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Approval Queue | Final Payroll System",
      description: "Final HR validation queue for supervisor-approved leave and overtime requests.",
    }
  }
}

export default async function ApprovalQueueRoutePage({ params, searchParams }: ApprovalQueueRouteProps) {
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
          <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconBuildingOff className="size-5" /> No Company Access</h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have an active company assignment yet. Please contact your administrator.
          </p>
        </main>
      )
    }
  }

  let data: Awaited<ReturnType<typeof getApprovalQueueData>> | null = null
  let loadError: string | undefined

  try {
    const page = Number(parsedSearch.page)
    data = await getApprovalQueueData(company.companyId, {
      query: parsedSearch.q?.trim() ?? "",
      kind: parsedSearch.kind === "LEAVE" || parsedSearch.kind === "OVERTIME" ? parsedSearch.kind : "ALL",
      page: Number.isFinite(page) ? page : 1,
    })
  } catch (error) {
    loadError =
      error instanceof Error && error.message === "ACCESS_DENIED"
        ? "You do not have permission to access the Approval Queue."
        : "Unable to load Approval Queue right now."
  }

  if (!data) {
    return (
      <main className="flex w-full flex-col gap-2 px-4 py-6 sm:px-6">
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconShieldCheck className="size-5" /> Approval Queue</h1>
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </main>
    )
  }

  return (
    <ApprovalQueuePage
      companyId={data.companyId}
      companyName={data.companyName}
      items={data.items}
      filters={data.filters}
      pagination={data.pagination}
      summary={data.summary}
    />
  )
}
