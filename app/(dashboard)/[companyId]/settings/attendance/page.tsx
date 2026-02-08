import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { AttendanceRulesPage } from "@/modules/settings/attendance/components/attendance-rules-page"
import { getAttendanceRulesViewModel } from "@/modules/settings/attendance/utils/get-attendance-rules"

type AttendanceRulesRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ scheduleId?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Work Schedules | ${company.companyName} | Final Payroll System`,
      description: `Manage work schedules for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Work Schedules | Final Payroll System",
      description: "Manage work schedules.",
    }
  }
}

export default async function AttendanceRulesRoutePage({ params, searchParams }: AttendanceRulesRouteProps) {
  const { companyId } = await params
  const { scheduleId } = (await searchParams) ?? {}

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

  const rules = await getAttendanceRulesViewModel(company.companyId, scheduleId)

  return (
    <AttendanceRulesPage
      companyName={rules.companyName}
      initialData={rules.form}
      schedules={rules.schedules}
    />
  )
}
