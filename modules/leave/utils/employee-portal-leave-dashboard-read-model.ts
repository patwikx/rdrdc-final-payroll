import { db } from "@/lib/db"
import type { EmployeePortalLeaveDashboardReadModel } from "@/modules/leave/types/employee-portal-leave-types"

const LEAVE_BALANCE_CARD_TYPES = new Set([
  "vacation leave",
  "sick leave",
  "compensatory time off",
  "compensary time off",
  "cto",
])

export async function getEmployeePortalLeaveDashboardReadModel(params: {
  companyId: string
  employeeId: string
  year: number
}): Promise<EmployeePortalLeaveDashboardReadModel> {
  const [leaveBalances, pendingLeaveRequests] = await Promise.all([
    db.leaveBalance.findMany({
      where: {
        employeeId: params.employeeId,
        year: params.year,
        employee: {
          companyId: params.companyId,
        },
      },
      select: {
        id: true,
        availableBalance: true,
        leaveType: { select: { name: true } },
      },
      orderBy: { leaveType: { name: "asc" } },
    }),
    db.leaveRequest.count({
      where: {
        employeeId: params.employeeId,
        statusCode: "PENDING",
        employee: {
          companyId: params.companyId,
        },
      },
    }),
  ])

  const filteredBalances = leaveBalances
    .filter((balance) => LEAVE_BALANCE_CARD_TYPES.has(balance.leaveType.name.trim().toLowerCase()))
    .map((balance) => ({
      id: balance.id,
      leaveTypeName: balance.leaveType.name,
      availableBalance: Number(balance.availableBalance),
    }))

  return {
    pendingLeaveRequests,
    leaveBalances: filteredBalances,
  }
}
