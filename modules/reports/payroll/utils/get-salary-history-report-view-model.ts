import { db } from "@/lib/db"
import { getPhYear, toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { reportQueryFilterSchema } from "@/modules/reports/payroll/schemas/report-filter-schemas"
import { normalizeReportDateRange } from "@/modules/reports/payroll/utils/report-time-utils"
import type {
  ReportPagination,
  SalaryHistoryReportRow,
  SalaryHistoryReportViewModel,
} from "@/modules/reports/payroll/types/report-view-models"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 5000

type SalaryHistoryReportFilterInput = {
  companyId: string
  startDate?: string
  endDate?: string
  employeeId?: string
  departmentId?: string
  page?: string | number
  pageSize?: string | number
  forExport?: boolean
}

type SalaryHistoryReportFilterState = {
  startDate: string
  endDate: string
  employeeId: string
  departmentId: string
  page: number
  pageSize: number
}

export type SalaryHistoryReportWorkspaceViewModel = SalaryHistoryReportViewModel & {
  pagination: ReportPagination
  filters: SalaryHistoryReportFilterState
  options: {
    employees: Array<{ id: string; label: string }>
    departments: Array<{ id: string; label: string }>
  }
  generatedAtLabel: string
  errorMessage: string | null
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

const clampPositiveInt = (value: string | number | undefined, fallback: number): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.floor(parsed))
}

const toCurrencyText = (value: number | null): string => {
  if (value === null) return "-"
  return `PHP ${new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
}

const formatAdjustmentType = (value: string | null): string => {
  if (!value) return "-"
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const mapSalaryHistoryRows = (
  rows: Array<{
    id: string
    employeeId: string
    effectiveDate: Date
    previousSalary: { toString(): string } | null
    newSalary: { toString(): string }
    adjustmentTypeCode: string | null
    reason: string | null
    remarks: string | null
    createdAt: Date
    employee: {
      employeeNumber: string
      firstName: string
      lastName: string
      department: { name: string } | null
    }
  }>
): SalaryHistoryReportRow[] => {
  return rows.map((row) => {
    const previousSalaryAmount = row.previousSalary ? Number(row.previousSalary.toString()) : null
    const newSalaryAmount = Number(row.newSalary.toString())

    return {
      salaryHistoryId: row.id,
      employeeId: row.employeeId,
      employeeNumber: row.employee.employeeNumber,
      employeeName: `${row.employee.lastName}, ${row.employee.firstName}`,
      departmentName: row.employee.department?.name ?? null,
      effectiveDateValue: toPhDateInputValue(row.effectiveDate),
      previousSalaryAmount,
      newSalaryAmount,
      deltaAmount: previousSalaryAmount === null ? null : newSalaryAmount - previousSalaryAmount,
      adjustmentTypeCode: row.adjustmentTypeCode,
      reason: row.reason,
      remarks: row.remarks,
      createdAtIso: row.createdAt.toISOString(),
    }
  })
}

const mapEmployeeOptions = (
  employees: Array<{
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    isActive: boolean
  }>
): Array<{ id: string; label: string }> => {
  return employees.map((employee) => ({
    id: employee.id,
    label: `${employee.employeeNumber} • ${employee.lastName}, ${employee.firstName}${employee.isActive ? "" : " (Inactive)"}`,
  }))
}

const mapDepartmentOptions = (
  departments: Array<{
    id: string
    name: string
    isActive: boolean
  }>
): Array<{ id: string; label: string }> => {
  return departments.map((department) => ({
    id: department.id,
    label: `${department.name}${department.isActive ? "" : " (Inactive)"}`,
  }))
}

const mapPagination = (page: number, pageSize: number, totalItems: number): ReportPagination => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  return {
    page: Math.min(page, totalPages),
    pageSize,
    totalItems,
    totalPages,
  }
}

export const getSalaryHistoryReportCsvRows = (rows: SalaryHistoryReportRow[]): string[][] => {
  return rows.map((row) => [
    row.employeeNumber,
    row.employeeName,
    row.departmentName ?? "UNASSIGNED",
    row.effectiveDateValue,
    toCurrencyText(row.previousSalaryAmount),
    toCurrencyText(row.newSalaryAmount),
    toCurrencyText(row.deltaAmount),
    formatAdjustmentType(row.adjustmentTypeCode),
    row.reason ?? "",
    row.remarks ?? "",
  ])
}

export async function getSalaryHistoryReportWorkspaceViewModel(
  input: SalaryHistoryReportFilterInput
): Promise<SalaryHistoryReportWorkspaceViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const todayPh = toPhDateOnlyUtc()
  const defaultStartDate = `${getPhYear(todayPh)}-01-01`
  const defaultEndDate = toPhDateInputValue(todayPh)

  const filterParse = reportQueryFilterSchema.safeParse({
    companyId: context.companyId,
    includeTrialRuns: false,
    topN: 10,
    startDate: input.startDate,
    endDate: input.endDate,
  })

  const initialStartDate = filterParse.success ? filterParse.data.startDate ?? defaultStartDate : defaultStartDate
  const initialEndDate = filterParse.success ? filterParse.data.endDate ?? defaultEndDate : defaultEndDate
  const range = normalizeReportDateRange({
    startDate: initialStartDate,
    endDate: initialEndDate,
  })

  const rangeErrorMessage = range.ok ? null : range.error
  const startDate = range.ok && range.startDateValue ? range.startDateValue : defaultStartDate
  const endDate = range.ok && range.endDateValue ? range.endDateValue : defaultEndDate
  const parsedStartUtcDateOnly = range.ok ? range.startUtcDateOnly : null
  const parsedEndUtcDateOnly = range.ok ? range.endUtcDateOnly : null

  const employeeId = (input.employeeId ?? "").trim()
  const departmentId = (input.departmentId ?? "").trim()
  const requestedPage = clampPositiveInt(input.page, 1)
  const requestedPageSize = Math.min(clampPositiveInt(input.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
  const pageSize = input.forExport ? MAX_PAGE_SIZE : requestedPageSize

  const where = {
    employee: {
      companyId: context.companyId,
      ...(departmentId ? { departmentId } : {}),
    },
    ...(employeeId ? { employeeId } : {}),
    ...(parsedStartUtcDateOnly && parsedEndUtcDateOnly
      ? {
          effectiveDate: {
            gte: parsedStartUtcDateOnly,
            lte: parsedEndUtcDateOnly,
          },
        }
      : {}),
  }

  const [employees, departments, totalItems] = await Promise.all([
    db.employee.findMany({
      where: {
        companyId: context.companyId,
        deletedAt: null,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    }),
    db.department.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    }),
    db.employeeSalaryHistory.count({ where }),
  ])

  const pagination = mapPagination(input.forExport ? 1 : requestedPage, pageSize, totalItems)
  const rows = await db.employeeSalaryHistory.findMany({
    where,
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    ...(input.forExport
      ? {}
      : {
          skip: (pagination.page - 1) * pagination.pageSize,
          take: pagination.pageSize,
        }),
    select: {
      id: true,
      employeeId: true,
      effectiveDate: true,
      previousSalary: true,
      newSalary: true,
      adjustmentTypeCode: true,
      reason: true,
      remarks: true,
      createdAt: true,
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
    },
  })

  const mappedRows = mapSalaryHistoryRows(rows)
  return {
    companyId: context.companyId,
    companyName: context.companyName,
    rows: mappedRows,
    pagination,
    filters: {
      startDate,
      endDate,
      employeeId,
      departmentId,
      page: pagination.page,
      pageSize: pagination.pageSize,
    },
    options: {
      employees: mapEmployeeOptions(employees),
      departments: mapDepartmentOptions(departments),
    },
    generatedAtLabel: toDateTimeLabel(new Date()),
    errorMessage: rangeErrorMessage,
  }
}
