import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { LeaveBalanceSummaryReportClient } from "@/modules/leave/components/leave-balance-summary-report-client"
import { getLeaveBalanceSummaryReportData, resolveLeaveYear } from "@/modules/leave/utils/leave-domain"

type LeaveBalanceReportPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ year?: string }>
}

const toDateTimeLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

export default async function LeaveBalanceReportPage({ params, searchParams }: LeaveBalanceReportPageProps) {
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
      redirect("/login")
    }
  }

  const yearFromQuery = Number(parsedSearch.year)
  const selectedYear = resolveLeaveYear(Number.isFinite(yearFromQuery) ? yearFromQuery : undefined)
  const { leaveTypeColumns, rows } = await getLeaveBalanceSummaryReportData({
    companyId: company.companyId,
    year: selectedYear,
  })

  return (
    <LeaveBalanceSummaryReportClient
      companyId={company.companyId}
      companyName={company.companyName}
      year={selectedYear}
      generatedAtLabel={toDateTimeLabel(new Date())}
      leaveTypeColumns={leaveTypeColumns}
      rows={rows}
    />
  )
}
