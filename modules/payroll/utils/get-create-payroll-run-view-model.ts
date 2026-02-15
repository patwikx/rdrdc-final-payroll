import { PayrollRunType } from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

type NonTrialRunType = Exclude<PayrollRunType, "TRIAL_RUN">

export type CreatePayrollRunViewModel = {
  companyId: string
  companyName: string
  payPeriods: Array<{ id: string; label: string }>
  defaultPayPeriodId: string
  runTypes: Array<{ code: NonTrialRunType; label: string }>
  departments: Array<{ id: string; name: string }>
  branches: Array<{ id: string; name: string }>
  employees: Array<{ id: string; employeeNumber: string; fullName: string }>
}

const runTypeOptions: Array<{ code: NonTrialRunType; label: string }> = [
  { code: PayrollRunType.REGULAR, label: "Regular" },
  { code: PayrollRunType.THIRTEENTH_MONTH, label: "13th Month" },
  { code: PayrollRunType.MID_YEAR_BONUS, label: "Mid-Year Bonus" },
  { code: PayrollRunType.SPECIAL, label: "Special" },
]

export async function getCreatePayrollRunViewModel(companyId: string): Promise<CreatePayrollRunViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const [periods, departments, branches, employees] = await Promise.all([
    db.payPeriod.findMany({
      where: {
        statusCode: "OPEN",
        pattern: { companyId: context.companyId },
      },
      select: {
        id: true,
        year: true,
        periodNumber: true,
        periodHalf: true,
        cutoffStartDate: true,
        cutoffEndDate: true,
      },
      orderBy: [{ cutoffStartDate: "asc" }],
    }),
    db.department.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
    db.branch.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
    db.employee.findMany({
      where: {
        companyId: context.companyId,
        isActive: true,
        deletedAt: null,
        employeeNumber: { not: "admin" },
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ])

  const defaultPayPeriodId = periods[0]?.id ?? ""

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    payPeriods: periods.map((period) => ({
      id: period.id,
      label: `${period.year}-${String(period.periodNumber).padStart(2, "0")} (${period.periodHalf}) | ${toDateLabel(period.cutoffStartDate)} - ${toDateLabel(period.cutoffEndDate)}`,
    })),
    defaultPayPeriodId,
    runTypes: runTypeOptions,
    departments,
    branches,
    employees: employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      fullName: `${employee.lastName}, ${employee.firstName}`,
    })),
  }
}
