import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { LeaveCalendarPage } from "@/modules/attendance/leaves/components/leave-calendar-page"
import { getLeaveCalendarViewModel } from "@/modules/attendance/leaves/utils/get-leave-calendar-view-model"

type AttendanceSchedulesRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ month?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Leave Calendar | ${company.companyName} | Final Payroll System`,
      description: `Review submitted leave requests for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Leave Calendar | Final Payroll System",
      description: "Review submitted leave requests.",
    }
  }
}

export default async function AttendanceSchedulesRoutePage({ params, searchParams }: AttendanceSchedulesRouteProps) {
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

  let data: Awaited<ReturnType<typeof getLeaveCalendarViewModel>> | null = null
  let loadError: string | undefined

  try {
    data = await getLeaveCalendarViewModel(company.companyId, { month: parsedSearch.month })
  } catch (error) {
    loadError =
      error instanceof Error && error.message === "ACCESS_DENIED"
        ? "You do not have permission to access the Leave Calendar."
        : "Unable to load leave calendar right now."
  }

  return (
    <LeaveCalendarPage
      companyName={data?.companyName ?? company.companyName}
      selectedMonth={data?.selectedMonth ?? parsedSearch.month ?? ""}
      range={data?.range ?? { startDate: "", endDate: "" }}
      leaves={data?.leaves ?? []}
      leaveIdsByDate={data?.leaveIdsByDate ?? {}}
      loadError={loadError}
    />
  )
}
