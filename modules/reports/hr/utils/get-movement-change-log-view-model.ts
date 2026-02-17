import { getPhYear, parsePhDateInputToUtcDateOnly, toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { normalizeReportDateRange } from "@/modules/reports/payroll/utils/report-time-utils"

type MovementCategory = "all" | "status" | "position" | "rank" | "salary"

type MovementChangeLogInput = {
  companyId: string
  startDate?: string
  endDate?: string
  departmentId?: string
  includeInactive?: string | boolean
  movementCategory?: string
}

export type MovementChangeLogRow = {
  eventId: string
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  isActive: boolean
  effectiveDateValue: string
  createdAtIso: string
  category: "STATUS" | "POSITION" | "RANK" | "SALARY"
  movementLabel: string
  previousValue: string
  newValue: string
  reason: string | null
  remarks: string | null
}

export type MovementChangeLogViewModel = {
  companyId: string
  companyName: string
  generatedAtLabel: string
  errorMessage: string | null
  filters: {
    startDate: string
    endDate: string
    departmentId: string
    includeInactive: boolean
    movementCategory: MovementCategory
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  summary: {
    totalEvents: number
    employeesImpacted: number
    statusEvents: number
    organizationEvents: number
    salaryEvents: number
  }
  rows: MovementChangeLogRow[]
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

const parseBoolean = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

const parseMovementCategory = (value: string | undefined): MovementCategory => {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "status") return "status"
  if (normalized === "position") return "position"
  if (normalized === "rank") return "rank"
  if (normalized === "salary") return "salary"
  return "all"
}

const humanizeCode = (value: string): string => {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toPhp = (value: number | null): string => {
  if (value === null) return "Unassigned"
  return `PHP ${moneyFormatter.format(value)}`
}

const toNumber = (value: { toString(): string } | null | undefined): number | null => {
  if (!value) return null
  return Number(value.toString())
}

const toOrganizationValue = (input: {
  positionName: string | null | undefined
  departmentName: string | null | undefined
  branchName: string | null | undefined
}): string => {
  const parts = [
    input.positionName ? `Position: ${input.positionName}` : null,
    input.departmentName ? `Department: ${input.departmentName}` : null,
    input.branchName ? `Branch: ${input.branchName}` : null,
  ].filter((part): part is string => part !== null)

  return parts.length > 0 ? parts.join(" | ") : "Unassigned"
}

export const movementCategoryToLabel = (value: MovementCategory): string => {
  if (value === "status") return "Status Changes"
  if (value === "position") return "Position Changes"
  if (value === "rank") return "Rank Changes"
  if (value === "salary") return "Salary Changes"
  return "All Categories"
}

export const getMovementChangeLogCsvRows = (rows: MovementChangeLogRow[]): string[][] => {
  return rows.map((row) => [
    row.effectiveDateValue,
    row.employeeNumber,
    row.employeeName,
    row.departmentName ?? "UNASSIGNED",
    row.isActive ? "ACTIVE" : "INACTIVE",
    row.category,
    row.movementLabel,
    row.previousValue,
    row.newValue,
    row.reason ?? "",
    row.remarks ?? "",
    row.createdAtIso,
  ])
}

export async function getMovementChangeLogViewModel(
  input: MovementChangeLogInput
): Promise<MovementChangeLogViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const includeInactive = parseBoolean(input.includeInactive)
  const movementCategory = parseMovementCategory(input.movementCategory)
  const departmentId = (input.departmentId ?? "").trim()

  const todayPh = toPhDateOnlyUtc()
  const defaultStartDate = `${getPhYear(todayPh)}-01-01`
  const defaultEndDate = toPhDateInputValue(todayPh)

  const normalizedRange = normalizeReportDateRange({
    startDate: input.startDate ?? defaultStartDate,
    endDate: input.endDate ?? defaultEndDate,
  })

  const rangeErrorMessage = normalizedRange.ok ? null : normalizedRange.error
  const startDate = normalizedRange.ok && normalizedRange.startDateValue ? normalizedRange.startDateValue : defaultStartDate
  const endDate = normalizedRange.ok && normalizedRange.endDateValue ? normalizedRange.endDateValue : defaultEndDate

  const parsedStartDate =
    (normalizedRange.ok ? normalizedRange.startUtcDateOnly : null) ?? parsePhDateInputToUtcDateOnly(defaultStartDate)
  const parsedEndDate =
    (normalizedRange.ok ? normalizedRange.endUtcDateOnly : null) ?? parsePhDateInputToUtcDateOnly(defaultEndDate)

  const effectiveDateRange =
    parsedStartDate && parsedEndDate
      ? {
          gte: parsedStartDate,
          lte: parsedEndDate,
        }
      : undefined

  const employeeWhere = {
    companyId: context.companyId,
    deletedAt: null as Date | null,
    ...(includeInactive ? {} : { isActive: true }),
    ...(departmentId ? { departmentId } : {}),
  }

  const [departments, statusHistory, positionHistory, rankHistory, salaryHistory] = await Promise.all([
    db.department.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    db.employeeStatusHistory.findMany({
      where: {
        employee: employeeWhere,
        ...(effectiveDateRange ? { effectiveDate: effectiveDateRange } : {}),
      },
      select: {
        id: true,
        effectiveDate: true,
        reason: true,
        remarks: true,
        createdAt: true,
        previousStatus: { select: { name: true } },
        newStatus: { select: { name: true } },
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            isActive: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    }),
    db.employeePositionHistory.findMany({
      where: {
        employee: employeeWhere,
        ...(effectiveDateRange ? { effectiveDate: effectiveDateRange } : {}),
      },
      select: {
        id: true,
        movementType: true,
        effectiveDate: true,
        reason: true,
        remarks: true,
        createdAt: true,
        previousPosition: { select: { name: true } },
        newPosition: { select: { name: true } },
        previousDepartment: { select: { name: true } },
        newDepartment: { select: { name: true } },
        previousBranch: { select: { name: true } },
        newBranch: { select: { name: true } },
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            isActive: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    }),
    db.employeeRankHistory.findMany({
      where: {
        employee: employeeWhere,
        ...(effectiveDateRange ? { effectiveDate: effectiveDateRange } : {}),
      },
      select: {
        id: true,
        movementType: true,
        effectiveDate: true,
        reason: true,
        remarks: true,
        createdAt: true,
        previousRank: { select: { name: true } },
        newRank: { select: { name: true } },
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            isActive: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    }),
    db.employeeSalaryHistory.findMany({
      where: {
        employee: employeeWhere,
        ...(effectiveDateRange ? { effectiveDate: effectiveDateRange } : {}),
      },
      select: {
        id: true,
        adjustmentTypeCode: true,
        previousSalary: true,
        newSalary: true,
        effectiveDate: true,
        reason: true,
        remarks: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            isActive: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    }),
  ])

  const statusRows: MovementChangeLogRow[] = statusHistory.map((item) => ({
    eventId: `status:${item.id}`,
    employeeId: item.employee.id,
    employeeNumber: item.employee.employeeNumber,
    employeeName: `${item.employee.lastName}, ${item.employee.firstName}`,
    departmentName: item.employee.department?.name ?? null,
    isActive: item.employee.isActive,
    effectiveDateValue: toPhDateInputValue(item.effectiveDate),
    createdAtIso: item.createdAt.toISOString(),
    category: "STATUS",
    movementLabel: "Status Change",
    previousValue: item.previousStatus?.name ?? "Unassigned",
    newValue: item.newStatus?.name ?? "Unassigned",
    reason: item.reason,
    remarks: item.remarks,
  }))

  const positionRows: MovementChangeLogRow[] = positionHistory.map((item) => ({
    eventId: `position:${item.id}`,
    employeeId: item.employee.id,
    employeeNumber: item.employee.employeeNumber,
    employeeName: `${item.employee.lastName}, ${item.employee.firstName}`,
    departmentName: item.employee.department?.name ?? null,
    isActive: item.employee.isActive,
    effectiveDateValue: toPhDateInputValue(item.effectiveDate),
    createdAtIso: item.createdAt.toISOString(),
    category: "POSITION",
    movementLabel: `${humanizeCode(item.movementType)}`,
    previousValue: toOrganizationValue({
      positionName: item.previousPosition?.name,
      departmentName: item.previousDepartment?.name,
      branchName: item.previousBranch?.name,
    }),
    newValue: toOrganizationValue({
      positionName: item.newPosition?.name,
      departmentName: item.newDepartment?.name,
      branchName: item.newBranch?.name,
    }),
    reason: item.reason,
    remarks: item.remarks,
  }))

  const rankRows: MovementChangeLogRow[] = rankHistory.map((item) => ({
    eventId: `rank:${item.id}`,
    employeeId: item.employee.id,
    employeeNumber: item.employee.employeeNumber,
    employeeName: `${item.employee.lastName}, ${item.employee.firstName}`,
    departmentName: item.employee.department?.name ?? null,
    isActive: item.employee.isActive,
    effectiveDateValue: toPhDateInputValue(item.effectiveDate),
    createdAtIso: item.createdAt.toISOString(),
    category: "RANK",
    movementLabel: `${humanizeCode(item.movementType)}`,
    previousValue: item.previousRank?.name ?? "Unassigned",
    newValue: item.newRank?.name ?? "Unassigned",
    reason: item.reason,
    remarks: item.remarks,
  }))

  const salaryRows: MovementChangeLogRow[] = salaryHistory.map((item) => {
    const adjustmentType = item.adjustmentTypeCode ? humanizeCode(item.adjustmentTypeCode) : "Adjustment"
    return {
      eventId: `salary:${item.id}`,
      employeeId: item.employee.id,
      employeeNumber: item.employee.employeeNumber,
      employeeName: `${item.employee.lastName}, ${item.employee.firstName}`,
      departmentName: item.employee.department?.name ?? null,
      isActive: item.employee.isActive,
      effectiveDateValue: toPhDateInputValue(item.effectiveDate),
      createdAtIso: item.createdAt.toISOString(),
      category: "SALARY",
      movementLabel: `${adjustmentType} Salary`,
      previousValue: toPhp(toNumber(item.previousSalary)),
      newValue: toPhp(toNumber(item.newSalary)),
      reason: item.reason,
      remarks: item.remarks,
    }
  })

  const allRows = [...statusRows, ...positionRows, ...rankRows, ...salaryRows]
  const scopedRows = allRows
    .filter((row) => {
      if (movementCategory === "all") return true
      if (movementCategory === "status") return row.category === "STATUS"
      if (movementCategory === "position") return row.category === "POSITION"
      if (movementCategory === "rank") return row.category === "RANK"
      return row.category === "SALARY"
    })
    .sort((a, b) => {
      if (a.effectiveDateValue !== b.effectiveDateValue) {
        return b.effectiveDateValue.localeCompare(a.effectiveDateValue)
      }
      if (a.createdAtIso !== b.createdAtIso) {
        return b.createdAtIso.localeCompare(a.createdAtIso)
      }
      return a.employeeName.localeCompare(b.employeeName)
    })

  const employeesImpacted = new Set(scopedRows.map((row) => row.employeeId)).size
  const statusEvents = scopedRows.filter((row) => row.category === "STATUS").length
  const organizationEvents = scopedRows.filter((row) => row.category === "POSITION" || row.category === "RANK").length
  const salaryEvents = scopedRows.filter((row) => row.category === "SALARY").length

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    generatedAtLabel: toDateTimeLabel(new Date()),
    errorMessage: rangeErrorMessage,
    filters: {
      startDate,
      endDate,
      departmentId,
      includeInactive,
      movementCategory,
    },
    options: {
      departments: departments.map((department) => ({
        id: department.id,
        label: `${department.name}${department.isActive ? "" : " (Inactive)"}`,
      })),
    },
    summary: {
      totalEvents: scopedRows.length,
      employeesImpacted,
      statusEvents,
      organizationEvents,
      salaryEvents,
    },
    rows: scopedRows,
  }
}
