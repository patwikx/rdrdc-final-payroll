import { db } from "@/lib/db"
import { toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

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

const parseBoolean = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

export type EmploymentMilestoneScope = "all" | "upcoming-30" | "upcoming-60" | "upcoming-90" | "overdue"

const parseMilestoneScope = (value: string | undefined): EmploymentMilestoneScope => {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "upcoming-30") return "upcoming-30"
  if (normalized === "upcoming-60") return "upcoming-60"
  if (normalized === "upcoming-90") return "upcoming-90"
  if (normalized === "overdue") return "overdue"
  return "all"
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

const toDayDifference = (targetDate: Date, referenceDate: Date): number => {
  const targetMs = targetDate.getTime()
  const referenceMs = referenceDate.getTime()
  return Math.round((targetMs - referenceMs) / MS_PER_DAY)
}

type MilestonePoint = {
  label: string
  dateValue: string
  diffDays: number
}

const scopeMatches = (scope: EmploymentMilestoneScope, points: MilestonePoint[]): boolean => {
  if (scope === "all") return true
  if (scope === "overdue") return points.some((point) => point.diffDays < 0)

  const horizon = scope === "upcoming-30" ? 30 : scope === "upcoming-60" ? 60 : 90
  return points.some((point) => point.diffDays >= 0 && point.diffDays <= horizon)
}

const toScopeLabel = (scope: EmploymentMilestoneScope): string => {
  if (scope === "upcoming-30") return "Upcoming in 30 Days"
  if (scope === "upcoming-60") return "Upcoming in 60 Days"
  if (scope === "upcoming-90") return "Upcoming in 90 Days"
  if (scope === "overdue") return "Overdue Milestones"
  return "All Milestones"
}

export type EmploymentMilestonesRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  isActive: boolean
  hireDateValue: string
  probationEndDateValue: string | null
  regularizationDateValue: string | null
  contractEndDateValue: string | null
  separationDateValue: string | null
  lastWorkingDayValue: string | null
  nextMilestoneLabel: string | null
  nextMilestoneDateValue: string | null
  daysToNextMilestone: number | null
  overdueMilestonesLabel: string
}

export type EmploymentMilestonesViewModel = {
  companyId: string
  companyName: string
  asOfDateValue: string
  generatedAtLabel: string
  filters: {
    departmentId: string
    includeInactive: boolean
    milestoneScope: EmploymentMilestoneScope
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  summary: {
    totalEmployees: number
    dueTodayCount: number
    upcoming30Count: number
    overdueCount: number
    withoutMilestoneCount: number
  }
  rows: EmploymentMilestonesRow[]
}

type EmploymentMilestonesInput = {
  companyId: string
  departmentId?: string
  includeInactive?: string | boolean
  milestoneScope?: string
}

const mapRows = (
  rows: Array<{
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    isActive: boolean
    hireDate: Date
    probationEndDate: Date | null
    regularizationDate: Date | null
    contractEndDate: Date | null
    separationDate: Date | null
    lastWorkingDay: Date | null
    department: { name: string } | null
  }>,
  asOfDate: Date
): EmploymentMilestonesRow[] => {
  return rows
    .map((row) => {
      const points: MilestonePoint[] = []
      const maybePush = (label: string, value: Date | null): void => {
        if (!value) return
        points.push({
          label,
          dateValue: toPhDateInputValue(value),
          diffDays: toDayDifference(value, asOfDate),
        })
      }

      maybePush("Probation End", row.probationEndDate)
      maybePush("Regularization", row.regularizationDate)
      maybePush("Contract End", row.contractEndDate)
      maybePush("Separation Date", row.separationDate)
      maybePush("Last Working Day", row.lastWorkingDay)

      const upcomingPoints = points.filter((point) => point.diffDays >= 0).sort((a, b) => a.diffDays - b.diffDays)
      const overduePoints = points.filter((point) => point.diffDays < 0).sort((a, b) => b.diffDays - a.diffDays)
      const nextMilestone = upcomingPoints[0] ?? null

      return {
        employeeId: row.id,
        employeeNumber: row.employeeNumber,
        employeeName: `${row.lastName}, ${row.firstName}`,
        departmentName: row.department?.name ?? null,
        isActive: row.isActive,
        hireDateValue: toPhDateInputValue(row.hireDate),
        probationEndDateValue: row.probationEndDate ? toPhDateInputValue(row.probationEndDate) : null,
        regularizationDateValue: row.regularizationDate ? toPhDateInputValue(row.regularizationDate) : null,
        contractEndDateValue: row.contractEndDate ? toPhDateInputValue(row.contractEndDate) : null,
        separationDateValue: row.separationDate ? toPhDateInputValue(row.separationDate) : null,
        lastWorkingDayValue: row.lastWorkingDay ? toPhDateInputValue(row.lastWorkingDay) : null,
        nextMilestoneLabel: nextMilestone?.label ?? null,
        nextMilestoneDateValue: nextMilestone?.dateValue ?? null,
        daysToNextMilestone: nextMilestone?.diffDays ?? null,
        overdueMilestonesLabel:
          overduePoints.length > 0
            ? overduePoints.map((point) => `${point.label} (${Math.abs(point.diffDays)}d overdue)`).join(", ")
            : "-",
      }
    })
    .sort((a, b) => {
      const aDays = a.daysToNextMilestone
      const bDays = b.daysToNextMilestone
      if (aDays === null && bDays !== null) return 1
      if (aDays !== null && bDays === null) return -1
      if (aDays !== null && bDays !== null && aDays !== bDays) return aDays - bDays
      return a.employeeName.localeCompare(b.employeeName)
    })
}

export const getEmploymentMilestonesCsvRows = (rows: EmploymentMilestonesRow[]): string[][] => {
  return rows.map((row) => [
    row.employeeNumber,
    row.employeeName,
    row.departmentName ?? "UNASSIGNED",
    row.isActive ? "ACTIVE" : "INACTIVE",
    row.hireDateValue,
    row.probationEndDateValue ?? "",
    row.regularizationDateValue ?? "",
    row.contractEndDateValue ?? "",
    row.separationDateValue ?? "",
    row.lastWorkingDayValue ?? "",
    row.nextMilestoneLabel ?? "",
    row.nextMilestoneDateValue ?? "",
    row.daysToNextMilestone === null ? "" : String(row.daysToNextMilestone),
    row.overdueMilestonesLabel === "-" ? "" : row.overdueMilestonesLabel,
  ])
}

export async function getEmploymentMilestonesViewModel(
  input: EmploymentMilestonesInput
): Promise<EmploymentMilestonesViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const departmentId = (input.departmentId ?? "").trim()
  const includeInactive = parseBoolean(input.includeInactive)
  const milestoneScope = parseMilestoneScope(input.milestoneScope)
  const asOfDate = toPhDateOnlyUtc()

  const [employees, departments] = await Promise.all([
    db.employee.findMany({
      where: {
        companyId: context.companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        isActive: true,
        hireDate: true,
        probationEndDate: true,
        regularizationDate: true,
        contractEndDate: true,
        separationDate: true,
        lastWorkingDay: true,
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { employeeNumber: "asc" }],
    }),
    db.department.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ])

  const mappedRows = mapRows(employees, asOfDate)
  const scopedRows = mappedRows.filter((row) => {
    const points: MilestonePoint[] = [
      row.probationEndDateValue
        ? {
            label: "Probation End",
            dateValue: row.probationEndDateValue,
            diffDays: toDayDifference(new Date(`${row.probationEndDateValue}T00:00:00.000Z`), asOfDate),
          }
        : null,
      row.regularizationDateValue
        ? {
            label: "Regularization",
            dateValue: row.regularizationDateValue,
            diffDays: toDayDifference(new Date(`${row.regularizationDateValue}T00:00:00.000Z`), asOfDate),
          }
        : null,
      row.contractEndDateValue
        ? {
            label: "Contract End",
            dateValue: row.contractEndDateValue,
            diffDays: toDayDifference(new Date(`${row.contractEndDateValue}T00:00:00.000Z`), asOfDate),
          }
        : null,
      row.separationDateValue
        ? {
            label: "Separation Date",
            dateValue: row.separationDateValue,
            diffDays: toDayDifference(new Date(`${row.separationDateValue}T00:00:00.000Z`), asOfDate),
          }
        : null,
      row.lastWorkingDayValue
        ? {
            label: "Last Working Day",
            dateValue: row.lastWorkingDayValue,
            diffDays: toDayDifference(new Date(`${row.lastWorkingDayValue}T00:00:00.000Z`), asOfDate),
          }
        : null,
    ].filter((item): item is MilestonePoint => item !== null)

    return scopeMatches(milestoneScope, points)
  })

  const dueTodayCount = scopedRows.filter((row) => row.daysToNextMilestone === 0).length
  const upcoming30Count = scopedRows.filter(
    (row) => row.daysToNextMilestone !== null && row.daysToNextMilestone >= 0 && row.daysToNextMilestone <= 30
  ).length
  const overdueCount = scopedRows.filter((row) => row.overdueMilestonesLabel !== "-").length
  const withoutMilestoneCount = scopedRows.filter(
    (row) =>
      !row.probationEndDateValue &&
      !row.regularizationDateValue &&
      !row.contractEndDateValue &&
      !row.separationDateValue &&
      !row.lastWorkingDayValue
  ).length

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    asOfDateValue: toPhDateInputValue(asOfDate),
    generatedAtLabel: toDateTimeLabel(new Date()),
    filters: {
      departmentId,
      includeInactive,
      milestoneScope,
    },
    options: {
      departments: departments.map((department) => ({
        id: department.id,
        label: `${department.name}${department.isActive ? "" : " (Inactive)"}`,
      })),
    },
    summary: {
      totalEmployees: scopedRows.length,
      dueTodayCount,
      upcoming30Count,
      overdueCount,
      withoutMilestoneCount,
    },
    rows: scopedRows,
  }
}

export const employmentMilestoneScopeToLabel = toScopeLabel
