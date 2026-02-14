import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { db } from "@/lib/db"
import { LegacyMaterialRequestSyncPage } from "@/modules/settings/material-requests/components/legacy-material-request-sync-page"

type LegacyMaterialRequestSyncRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()
    return {
      title: `Legacy Material Request Sync | ${company.companyName} | Final Payroll System`,
      description: `Sync legacy material requests for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Legacy Material Request Sync | Final Payroll System",
      description: "Sync legacy material requests.",
    }
  }
}

export default async function LegacyMaterialRequestSyncRoutePage({ params }: LegacyMaterialRequestSyncRouteProps) {
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

  const departments = await db.department.findMany({
    where: {
      companyId: company.companyId,
      isActive: true,
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
    },
  })

  return (
    <LegacyMaterialRequestSyncPage
      companyId={company.companyId}
      companyName={company.companyName}
      departments={departments}
    />
  )
}
