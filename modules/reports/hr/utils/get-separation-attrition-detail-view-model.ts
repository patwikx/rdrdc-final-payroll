import { db } from "@/lib/db"
import { getPhYear, parsePhDateInputToUtcDateOnly, toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { normalizeReportDateRange } from "@/modules/reports/payroll/utils/report-time-utils"

type SeparationAttritionDetailInput = {
  companyId: string
  startDate?: string
  endDate?: string
  departmentId?: string
  includeInactive?: string | boolean
  attritionScope?: string
}

export type SeparationAttritionScope = "all" | "voluntary" | "involuntary" | "other"

type AttritionType = "VOLUNTARY" | "INVOLUNTARY" | "OTHER"

export type SeparationAttritionDetailRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  isActive: boolean
  hireDateValue: string
  separationDateValue: string
  lastWorkingDayValue: string | null
  separationReasonCode: string | null
  separationReasonLabel: string
  attritionType: AttritionType
  tenureMonths: number
  tenureLabel: string
  serviceDays: number
}

export type SeparationAttritionDetailViewModel = {
  companyId: string
  companyName: string
  generatedAtLabel: string
  errorMessage: string | null
  filters: {
    startDate: string
    endDate: string
    departmentId: string
    includeInactive: boolean
    attritionScope: SeparationAttritionScope
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  summary: {
    totalSeparated: number
    voluntaryCount: number
    involuntaryCount: number
    otherCount: number
    activeHeadcount: number
    averageTenureMonths: number
    attritionRate: number
  }
  rows: SeparationAttritionDetailRow[]
}

const VOLUNTARY_REASON_CODES = new Set([
  "RESIGNATION_PERSONAL",
  "RESIGNATION_HEALTH",
  "RESIGNATION_CAREER",
  "RETIREMENT",
])

const INVOLUNTARY_REASON_CODES = new Set([
  "TERMINATION_PERFORMANCE",
  "TERMINATION_MISCONDUCT",
  "REDUNDANCY",
  "AWOL",
])

const SEPARATION_REASON_LABELS: Record<string, string> = {
  RESIGNATION_PERSONAL: "Resignation - Personal",
  RESIGNATION_HEALTH: "Resignation - Health",
  RESIGNATION_CAREER: "Resignation - Career",
  TERMINATION_PERFORMANCE: "Termination - Performance",
  TERMINATION_MISCONDUCT: "Termination - Misconduct",
  REDUNDANCY: "Redundancy",
  RETIREMENT: "Retirement",
  END_OF_CONTRACT: "End of Contract",
  AWOL: "AWOL",
  OTHER: "Other",
}

const parseBoolean = (value: string | boolean | undefined, fallback = false): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return fallback
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

const parseAttritionScope = (value: string | undefined): SeparationAttritionScope => {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "voluntary") return "voluntary"
  if (normalized === "involuntary") return "involuntary"
  if (normalized === "other") return "other"
  return "all"
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

const toAttritionType = (reasonCode: string | null): AttritionType => {
  if (!reasonCode) return "OTHER"
  if (VOLUNTARY_REASON_CODES.has(reasonCode)) return "VOLUNTARY"
  if (INVOLUNTARY_REASON_CODES.has(reasonCode)) return "INVOLUNTARY"
  return "OTHER"
}

const toReasonLabel = (reasonCode: string | null): string => {
  if (!reasonCode) return "Unspecified"
  return SEPARATION_REASON_LABELS[reasonCode] ?? reasonCode.replaceAll("_", " ")
}

const getTotalMonthsBetween = (startDate: Date, endDate: Date): number => {
  let months =
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (endDate.getUTCMonth() - startDate.getUTCMonth())
  if (endDate.getUTCDate() < startDate.getUTCDate()) months -= 1
  return Math.max(0, months)
}

const toTenureLabel = (months: number): string => {
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  return `${years}y ${remainingMonths}m`
}

const toServiceDays = (startDate: Date, endDate: Date): number => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY)
  return Math.max(0, days)
}

const roundToTwo = (value: number): number => Math.round(value * 100) / 100

const scopeMatches = (scope: SeparationAttritionScope, row: SeparationAttritionDetailRow): boolean => {
  if (scope === "all") return true
  if (scope === "voluntary") return row.attritionType === "VOLUNTARY"
  if (scope === "involuntary") return row.attritionType === "INVOLUNTARY"
  return row.attritionType === "OTHER"
}

export const separationAttritionScopeToLabel = (scope: SeparationAttritionScope): string => {
  if (scope === "voluntary") return "Voluntary Attrition"
  if (scope === "involuntary") return "Involuntary Attrition"
  if (scope === "other") return "Other / Unspecified"
  return "All Attrition Types"
}

export const getSeparationAttritionDetailCsvRows = (rows: SeparationAttritionDetailRow[]): string[][] => {
  return rows.map((row) => [
    row.employeeNumber,
    row.employeeName,
    row.departmentName ?? "UNASSIGNED",
    row.isActive ? "ACTIVE" : "INACTIVE",
    row.hireDateValue,
    row.separationDateValue,
    row.lastWorkingDayValue ?? "",
    row.separationReasonCode ?? "",
    row.separationReasonLabel,
    row.attritionType,
    row.tenureMonths.toString(),
    row.tenureLabel,
    row.serviceDays.toString(),
  ])
}

export async function getSeparationAttritionDetailViewModel(
  input: SeparationAttritionDetailInput
): Promise<SeparationAttritionDetailViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const includeInactive = parseBoolean(input.includeInactive, true)
  const attritionScope = parseAttritionScope(input.attritionScope)
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

  const separationDateRange =
    parsedStartDate && parsedEndDate
      ? {
          gte: parsedStartDate,
          lte: parsedEndDate,
        }
      : undefined

  const employeeWhere = {
    companyId: context.companyId,
    deletedAt: null as Date | null,
    separationDate: separationDateRange ? separationDateRange : { not: null as Date | null },
    ...(includeInactive ? {} : { isActive: true }),
    ...(departmentId ? { departmentId } : {}),
  }

  const [rows, departments, activeHeadcount] = await Promise.all([
    db.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        isActive: true,
        hireDate: true,
        separationDate: true,
        lastWorkingDay: true,
        separationReasonCode: true,
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ separationDate: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
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
    db.employee.count({
      where: {
        companyId: context.companyId,
        deletedAt: null,
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
      },
    }),
  ])

  const mappedRows = rows
    .filter((row): row is typeof row & { separationDate: Date } => row.separationDate !== null)
    .map((row) => {
      const attritionType = toAttritionType(row.separationReasonCode)
      const tenureMonths = getTotalMonthsBetween(row.hireDate, row.separationDate)
      const serviceDays = toServiceDays(row.hireDate, row.separationDate)

      return {
        employeeId: row.id,
        employeeNumber: row.employeeNumber,
        employeeName: `${row.lastName}, ${row.firstName}`,
        departmentName: row.department?.name ?? null,
        isActive: row.isActive,
        hireDateValue: toPhDateInputValue(row.hireDate),
        separationDateValue: toPhDateInputValue(row.separationDate),
        lastWorkingDayValue: row.lastWorkingDay ? toPhDateInputValue(row.lastWorkingDay) : null,
        separationReasonCode: row.separationReasonCode,
        separationReasonLabel: toReasonLabel(row.separationReasonCode),
        attritionType,
        tenureMonths,
        tenureLabel: toTenureLabel(tenureMonths),
        serviceDays,
      } satisfies SeparationAttritionDetailRow
    })

  const scopedRows = mappedRows.filter((row) => scopeMatches(attritionScope, row))
  const totalSeparated = scopedRows.length
  const voluntaryCount = scopedRows.filter((row) => row.attritionType === "VOLUNTARY").length
  const involuntaryCount = scopedRows.filter((row) => row.attritionType === "INVOLUNTARY").length
  const otherCount = scopedRows.filter((row) => row.attritionType === "OTHER").length
  const averageTenureMonths =
    totalSeparated === 0 ? 0 : roundToTwo(scopedRows.reduce((sum, row) => sum + row.tenureMonths, 0) / totalSeparated)
  const attritionDenominator = totalSeparated + activeHeadcount
  const attritionRate = attritionDenominator === 0 ? 0 : roundToTwo((totalSeparated / attritionDenominator) * 100)

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
      attritionScope,
    },
    options: {
      departments: departments.map((department) => ({
        id: department.id,
        label: `${department.name}${department.isActive ? "" : " (Inactive)"}`,
      })),
    },
    summary: {
      totalSeparated,
      voluntaryCount,
      involuntaryCount,
      otherCount,
      activeHeadcount,
      averageTenureMonths,
      attritionRate,
    },
    rows: scopedRows,
  }
}
