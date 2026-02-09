import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { LeaveBalanceLayoutIterations } from "@/modules/leave/components/leave-balance-layout-iterations"

type LeaveBalancesRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ year?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Leave Balance | ${company.companyName} | Final Payroll System`,
      description: `Review leave balances for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Leave Balance | Final Payroll System",
      description: "Review leave balances.",
    }
  }
}

export default async function LeaveBalancesRoutePage({ params, searchParams }: LeaveBalancesRouteProps) {
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

  const currentYear = new Date().getFullYear()
  const yearFromQuery = Number(parsedSearch.year)
  const selectedYear = Number.isInteger(yearFromQuery) && yearFromQuery > 2000 ? yearFromQuery : currentYear
  const yearStart = new Date(`${selectedYear}-01-01T00:00:00.000Z`)
  const yearEnd = new Date(`${selectedYear}-12-31T23:59:59.999Z`)

  const [balanceRowsRaw, historyRowsRaw, yearRows] = await Promise.all([
    db.leaveBalance.findMany({
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
        employeeId: true,
        currentBalance: true,
        availableBalance: true,
        pendingRequests: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            photoUrl: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
        leaveType: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.leaveRequest.findMany({
      where: {
        employee: {
          companyId: company.companyId,
          deletedAt: null,
        },
        startDate: { lte: yearEnd },
        endDate: { gte: yearStart },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        employeeId: true,
        requestNumber: true,
        statusCode: true,
        numberOfDays: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        leaveType: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.leaveBalance.findMany({
      where: {
        employee: {
          companyId: company.companyId,
          deletedAt: null,
        },
      },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
      take: 8,
    }),
  ])

  const balanceRows = balanceRowsRaw.map((row) => ({
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
    employeeNumber: row.employee.employeeNumber,
    photoUrl: row.employee.photoUrl,
    departmentName: row.employee.department?.name ?? "Unassigned",
    leaveTypeName: row.leaveType.name,
    currentBalance: Number(row.currentBalance),
    availableBalance: Number(row.availableBalance),
    pendingRequests: Number(row.pendingRequests),
  }))

  const historyRows = historyRowsRaw.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    requestNumber: row.requestNumber,
    leaveTypeName: row.leaveType.name,
    statusCode: row.statusCode,
    numberOfDays: Number(row.numberOfDays),
    startDateIso: row.startDate.toISOString(),
    endDateIso: row.endDate.toISOString(),
    createdAtIso: row.createdAt.toISOString(),
  }))

  const years = Array.from(new Set([selectedYear, ...yearRows.map((row) => row.year)])).sort((a, b) => b - a)

  return (
    <LeaveBalanceLayoutIterations
      companyId={company.companyId}
      selectedYear={selectedYear}
      years={years}
      balanceRows={balanceRows}
      historyRows={historyRows}
    />
  )
}
