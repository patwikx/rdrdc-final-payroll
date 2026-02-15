import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { IconBuildingOff, IconUserScan } from "@tabler/icons-react"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { DtrClientPage } from "@/modules/attendance/dtr/components/dtr-client"
import { getDtrPageData } from "@/modules/attendance/dtr/utils/get-dtr-page-data"

type DailyTimeRecordRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ startDate?: string; endDate?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Daily Time Record | ${company.companyName} | Final Payroll System`,
      description: `Review daily attendance logs for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Daily Time Record | Final Payroll System",
      description: "Review daily attendance logs.",
    }
  }
}

export default async function DailyTimeRecordRoutePage({ params, searchParams }: DailyTimeRecordRouteProps) {
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

  let data: Awaited<ReturnType<typeof getDtrPageData>> | null = null
  let loadError: string | undefined

  try {
    data = await getDtrPageData(company.companyId, {
      startDate: parsedSearch.startDate,
      endDate: parsedSearch.endDate,
    })
  } catch (error) {
    loadError =
      error instanceof Error && error.message === "ACCESS_DENIED"
        ? "You do not have permission to access Daily Time Record."
        : "Unable to load Daily Time Record right now."
  }

  if (!data) {
    return (
      <main className="flex w-full flex-col gap-2 px-4 py-6 sm:px-6">
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconUserScan className="size-5" /> Daily Time Record</h1>
        <p className="text-sm text-muted-foreground">{loadError ?? "Unable to load Daily Time Record."}</p>
      </main>
    )
  }

  return <DtrClientPage companyId={data.companyId} logs={data.logs} stats={data.stats} workbenchData={data.workbenchData} leaveOverlays={data.leaveOverlays} filters={data.filters} />
}
