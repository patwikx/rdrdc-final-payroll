import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { LegacyLeaveOvertimeSyncPage } from "@/modules/settings/leave-overtime/components/legacy-leave-overtime-sync-page"

type LegacyLeaveOvertimeSyncRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()
    return {
      title: `Legacy Leave/OT Sync | ${company.companyName} | Final Payroll System`,
      description: `Sync legacy leave and overtime data for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Legacy Leave/OT Sync | Final Payroll System",
      description: "Sync legacy leave and overtime data.",
    }
  }
}

export default async function LegacyLeaveOvertimeSyncRoutePage({ params }: LegacyLeaveOvertimeSyncRouteProps) {
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
          <h1 className="text-lg font-semibold text-foreground">No Company Access</h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have an active company assignment yet. Please contact your administrator.
          </p>
        </main>
      )
    }
  }

  return <LegacyLeaveOvertimeSyncPage companyId={company.companyId} companyName={company.companyName} />
}

