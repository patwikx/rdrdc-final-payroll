import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { LeaveBalanceSummaryReportClient } from "@/modules/leave/components/leave-balance-summary-report-client"

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

const normalizeLeaveType = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "")

const isMandatoryLeaveType = (value: string): boolean => {
  const key = normalizeLeaveType(value)
  return key.includes("mandatory") && key.includes("leave")
}

const isExcludedLeaveType = (value: string): boolean => {
  const key = normalizeLeaveType(value)
  if (key.includes("maternity")) return true
  if (key.includes("paternity")) return true
  if (key.includes("bereavement")) return true
  if (key.includes("emergency")) return true
  if (key.includes("compensatory") && key.includes("time") && key.includes("off")) return true
  if (key.includes("cto")) return true
  if (key.includes("leavewithoutpay")) return true
  if (key.includes("lwop")) return true
  return false
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

  const currentYear = new Date().getFullYear()
  const yearFromQuery = Number(parsedSearch.year)
  const selectedYear = Number.isInteger(yearFromQuery) && yearFromQuery > 2000 ? yearFromQuery : currentYear

  const balances = await db.leaveBalance.findMany({
    where: {
      year: selectedYear,
      employee: {
        companyId: company.companyId,
        deletedAt: null,
      },
    },
    orderBy: [
      { employee: { lastName: "asc" } },
      { employee: { firstName: "asc" } },
      { leaveType: { displayOrder: "asc" } },
    ],
    select: {
      openingBalance: true,
      currentBalance: true,
      creditsUsed: true,
      availableBalance: true,
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
          department: {
            select: {
              name: true,
            },
          },
        },
      },
      leaveType: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const included = balances.filter((row) => !isExcludedLeaveType(row.leaveType.name))

  const leaveTypeColumns = Array.from(
    new Map(
      included
        .sort((a, b) => a.leaveType.name.localeCompare(b.leaveType.name))
        .map((row) => [row.leaveType.id, row.leaveType.name])
    ).values()
  )

  if (!leaveTypeColumns.some((name) => isMandatoryLeaveType(name))) {
    leaveTypeColumns.push("Mandatory Leave")
  }

  const employeeMap = new Map<
    string,
    {
      employeeNumber: string
      employeeName: string
      departmentName: string
      leaveBalances: Record<string, number>
    }
  >()

  for (const row of included) {
    const key = row.employee.employeeNumber
    const current = employeeMap.get(key) ?? {
      employeeNumber: row.employee.employeeNumber,
      employeeName: `${row.employee.lastName}, ${row.employee.firstName}`,
      departmentName: row.employee.department?.name ?? "Unassigned",
      leaveBalances: {},
    }
    current.leaveBalances[row.leaveType.name] = Number(row.availableBalance)
    employeeMap.set(key, current)
  }

  return (
    <LeaveBalanceSummaryReportClient
      companyId={company.companyId}
      companyName={company.companyName}
      year={selectedYear}
      generatedAtLabel={toDateTimeLabel(new Date())}
      leaveTypeColumns={leaveTypeColumns}
      rows={Array.from(employeeMap.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName))}
    />
  )
}
