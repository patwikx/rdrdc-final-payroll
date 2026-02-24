import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { LegacyMaterialRequestCleanupPage } from "@/modules/settings/material-requests/components/legacy-material-request-cleanup-page"
import {
  getLegacyMaterialRequestCleanupRows,
  getLegacyMaterialRequestCleanupSummary,
} from "@/modules/settings/material-requests/utils/get-legacy-material-request-cleanup-summary"

type LegacyMaterialRequestCleanupRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()
    return {
      title: `Legacy Material Request Cleanup | ${company.companyName} | Final Payroll System`,
      description: `Delete legacy-tagged material requests for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Legacy Material Request Cleanup | Final Payroll System",
      description: "Delete legacy-tagged material requests.",
    }
  }
}

export default async function LegacyMaterialRequestCleanupRoutePage({
  params,
}: LegacyMaterialRequestCleanupRouteProps) {
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

  if (!hasModuleAccess(company.companyRole as CompanyRole, "settings")) {
    redirect(`/${company.companyId}/dashboard`)
  }

  const [summary, rows] = await Promise.all([
    getLegacyMaterialRequestCleanupSummary({
      companyId: company.companyId,
    }),
    getLegacyMaterialRequestCleanupRows({
      companyId: company.companyId,
    }),
  ])

  return (
    <LegacyMaterialRequestCleanupPage
      companyId={company.companyId}
      companyName={company.companyName}
      summary={{
        totalLegacyRequests: summary.totalLegacyRequests,
        requestsWithLegacyRecordId: summary.requestsWithLegacyRecordId,
        requestsWithLegacySourceSystem: summary.requestsWithLegacySourceSystem,
        firstCreatedAt: summary.firstCreatedAt ? summary.firstCreatedAt.toISOString() : null,
        lastCreatedAt: summary.lastCreatedAt ? summary.lastCreatedAt.toISOString() : null,
      }}
      rows={rows.map((row) => ({
        id: row.id,
        requestNumber: row.requestNumber,
        legacySourceSystem: row.legacySourceSystem,
        legacyRecordId: row.legacyRecordId,
        status: row.status,
        requesterName: row.requesterName,
        requesterEmployeeNumber: row.requesterEmployeeNumber,
        departmentCode: row.departmentCode,
        departmentName: row.departmentName,
        datePrepared: row.datePrepared.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))}
    />
  )
}
