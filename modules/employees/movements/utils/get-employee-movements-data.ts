import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

type Option = {
  id: string
  label: string
}

type HistoryRow = {
  id: string
  employee: string
  movement: string
  effectiveDate: string
  details: string
}

const formatDate = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

export type EmployeeMovementsViewModel = {
  companyId: string
  companyName: string
  options: {
    employees: Option[]
    statuses: Option[]
    positions: Option[]
    departments: Option[]
    branches: Option[]
    ranks: Option[]
    schedules: Option[]
  }
  recentHistory: {
    status: HistoryRow[]
    position: HistoryRow[]
    rank: HistoryRow[]
    salary: HistoryRow[]
    schedule: HistoryRow[]
  }
}

export async function getEmployeeMovementsViewModel(companyId: string): Promise<EmployeeMovementsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const [employees, statuses, positions, departments, branches, ranks, schedules, statusHistory, positionHistory, rankHistory, salaryHistory, scheduleHistory] =
    await Promise.all([
      db.employee.findMany({
        where: { companyId: context.companyId, deletedAt: null },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      }),
      db.employmentStatus.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
      db.position.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
      db.department.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
      db.branch.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
      db.rank.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
      db.workSchedule.findMany({ where: { OR: [{ companyId: context.companyId }, { companyId: null }], isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.employeeStatusHistory.findMany({
        where: { employee: { companyId: context.companyId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          effectiveDate: true,
          employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
          newStatus: { select: { name: true } },
          reason: true,
        },
      }),
      db.employeePositionHistory.findMany({
        where: { employee: { companyId: context.companyId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          effectiveDate: true,
          movementType: true,
          employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
          newPosition: { select: { name: true } },
        },
      }),
      db.employeeRankHistory.findMany({
        where: { employee: { companyId: context.companyId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          effectiveDate: true,
          movementType: true,
          employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
          newRank: { select: { name: true } },
        },
      }),
      db.employeeSalaryHistory.findMany({
        where: { employee: { companyId: context.companyId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          effectiveDate: true,
          newSalary: true,
          employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
          adjustmentTypeCode: true,
        },
      }),
      db.employeeScheduleHistory.findMany({
        where: { employee: { companyId: context.companyId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          effectiveDate: true,
          employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
          newScheduleId: true,
          reason: true,
        },
      }),
    ])

  const employeeLabel = (item: { employeeNumber: string; firstName: string; lastName: string }): string =>
    `${item.employeeNumber} • ${item.lastName}, ${item.firstName}`

  const scheduleNameMap = new Map(schedules.map((item) => [item.id, item.name]))

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    options: {
      employees: employees.map((item) => ({ id: item.id, label: employeeLabel(item) })),
      statuses: statuses.map((item) => ({ id: item.id, label: item.name })),
      positions: positions.map((item) => ({ id: item.id, label: item.name })),
      departments: departments.map((item) => ({ id: item.id, label: item.name })),
      branches: branches.map((item) => ({ id: item.id, label: item.name })),
      ranks: ranks.map((item) => ({ id: item.id, label: item.name })),
      schedules: schedules.map((item) => ({ id: item.id, label: item.name })),
    },
    recentHistory: {
      status: statusHistory.map((item) => ({
        id: item.id,
        employee: employeeLabel(item.employee),
        movement: `Status -> ${item.newStatus?.name ?? "Unassigned"}`,
        effectiveDate: formatDate(item.effectiveDate),
        details: item.reason ?? "-",
      })),
      position: positionHistory.map((item) => ({
        id: item.id,
        employee: employeeLabel(item.employee),
        movement: `${item.movementType} -> ${item.newPosition?.name ?? "Unassigned"}`,
        effectiveDate: formatDate(item.effectiveDate),
        details: "-",
      })),
      rank: rankHistory.map((item) => ({
        id: item.id,
        employee: employeeLabel(item.employee),
        movement: `${item.movementType} -> ${item.newRank?.name ?? "Unassigned"}`,
        effectiveDate: formatDate(item.effectiveDate),
        details: "-",
      })),
      salary: salaryHistory.map((item) => ({
        id: item.id,
        employee: employeeLabel(item.employee),
        movement: `Salary -> PHP ${Number(item.newSalary).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        effectiveDate: formatDate(item.effectiveDate),
        details: item.adjustmentTypeCode ?? "-",
      })),
      schedule: scheduleHistory.map((item) => ({
        id: item.id,
        employee: employeeLabel(item.employee),
        movement: `Schedule -> ${scheduleNameMap.get(item.newScheduleId) ?? item.newScheduleId}`,
        effectiveDate: formatDate(item.effectiveDate),
        details: item.reason ?? "-",
      })),
    },
  }
}
