import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { HolidaySettingsPage } from "@/modules/settings/holidays/components/holiday-settings-page"
import { getHolidaysSettingsViewModel } from "@/modules/settings/holidays/utils/get-holidays-settings-view-model"

type HolidaySettingsRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ year?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Holiday Calendar | ${company.companyName} | Final Payroll System`,
      description: `Manage holiday entries for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Holiday Calendar | Final Payroll System",
      description: "Manage holiday entries.",
    }
  }
}

export default async function HolidaySettingsRoutePage({ params, searchParams }: HolidaySettingsRouteProps) {
  const { companyId } = await params
  const { year } = (await searchParams) ?? {}
  const requestedYear = year ? Number(year) : undefined

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

  const holidaySettings = await getHolidaysSettingsViewModel(company.companyId, requestedYear)

  return (
    <HolidaySettingsPage
      companyId={company.companyId}
      companyName={holidaySettings.companyName}
      selectedYear={holidaySettings.selectedYear}
      availableYears={holidaySettings.availableYears}
      holidays={holidaySettings.holidays}
    />
  )
}
