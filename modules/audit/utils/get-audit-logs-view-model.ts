import { AuditAction, type AuditLog, type User } from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const PAGE_SIZE = 10
const MAX_AUDIT_LOG_SCAN = 3000

const ACTION_FILTER_VALUES = ["ALL", "CREATE", "UPDATE", "DELETE", "RESTORE"] as const
const RANGE_FILTER_VALUES = ["24H", "7D", "30D", "ALL"] as const

type ActionFilter = (typeof ACTION_FILTER_VALUES)[number]
type RangeFilter = (typeof RANGE_FILTER_VALUES)[number]

type AuditLogWithUser = AuditLog & {
  user: (Pick<User, "id" | "username" | "firstName" | "lastName"> & { companyAccess: Array<{ id: string }> }) | null
}

const STRICT_TABLE_NAMES = new Set<string>([
  "Company",
  "DailyTimeRecord",
  "DeductionType",
  "Department",
  "Employee",
  "EmployeeBeneficiary",
  "EmployeeDependent",
  "EmployeeEducation",
  "EmployeeMedicalAttachment",
  "EmployeeMedicalRecord",
  "EmployeePositionHistory",
  "EmployeePreviousEmployment",
  "EmployeeRankHistory",
  "EmployeeSalaryHistory",
  "EmployeeStatusHistory",
  "EmployeeTraining",
  "EmploymentClass",
  "EmploymentStatus",
  "EmploymentType",
  "LeaveBalance",
  "LeaveRequest",
  "LeaveType",
  "OvertimeRequest",
  "PayPeriod",
  "PayPeriodPattern",
  "PayrollRun",
  "Payslip",
  "Position",
  "Rank",
  "RecurringDeduction",
  "User",
  "WorkSchedule",
  "Branch",
  "Division",
])

const ACTOR_SCOPED_TABLE_NAMES = new Set<string>([
  "EmploymentSetup",
  "LeaveTypePolicy",
  "OnboardingSelectEntity",
  "OrganizationEntity",
  "OrganizationSetup",
  "OvertimeRate",
  "SystemConfig",
  "TaxTable",
])

export type AuditLogsQuery = {
  q?: string
  page?: number
  action?: string
  range?: string
  table?: string
}

export type AuditLogsViewModel = {
  companyId: string
  companyName: string
  query: string
  actionFilter: ActionFilter
  rangeFilter: RangeFilter
  tableFilter: string | null
  availableTables: string[]
  summary: {
    totalVisible: number
    createCount: number
    updateCount: number
    deleteCount: number
    restoreCount: number
  }
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  rows: Array<{
    id: string
    tableName: string
    recordId: string
    action: AuditAction
    fieldName: string | null
    oldValue: string | null
    newValue: string | null
    reason: string | null
    ipAddress: string | null
    userAgent: string | null
    actorName: string
    actorUsername: string | null
    createdAtLabel: string
    createdAtIso: string
  }>
}

const normalizePage = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return 1
  const parsed = Math.floor(value as number)
  return parsed > 0 ? parsed : 1
}

const normalizeActionFilter = (value: string | undefined): ActionFilter => {
  if (value && ACTION_FILTER_VALUES.includes(value as ActionFilter)) {
    return value as ActionFilter
  }
  return "ALL"
}

const normalizeRangeFilter = (value: string | undefined): RangeFilter => {
  if (value && RANGE_FILTER_VALUES.includes(value as RangeFilter)) {
    return value as RangeFilter
  }
  return "30D"
}

const toDateTimeLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toActorName = (log: AuditLogWithUser): string => {
  const firstName = log.user?.firstName?.trim() ?? ""
  const lastName = log.user?.lastName?.trim() ?? ""
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim()
  }
  if (log.user?.username) return log.user.username
  return "SYSTEM"
}

const toCutoffDate = (rangeFilter: RangeFilter): Date | null => {
  if (rangeFilter === "ALL") return null

  const now = Date.now()
  if (rangeFilter === "24H") {
    return new Date(now - 24 * 60 * 60 * 1000)
  }
  if (rangeFilter === "7D") {
    return new Date(now - 7 * 24 * 60 * 60 * 1000)
  }
  return new Date(now - 30 * 24 * 60 * 60 * 1000)
}

const pushScopedIds = (map: Map<string, string[]>, tableName: string, recordId: string): void => {
  const existing = map.get(tableName)
  if (existing) {
    existing.push(recordId)
    return
  }
  map.set(tableName, [recordId])
}

const listToSet = <T extends { id: string }>(rows: T[]): Set<string> => {
  return new Set(rows.map((row) => row.id))
}

const resolveScopedRecordIds = async (tableName: string, recordIds: string[], companyId: string): Promise<Set<string>> => {
  const uniqueIds = Array.from(new Set(recordIds))
  if (uniqueIds.length === 0) {
    return new Set<string>()
  }

  if (tableName === "Company") {
    return new Set(uniqueIds.filter((id) => id === companyId))
  }

  if (tableName === "User") {
    const rows = await db.user.findMany({
      where: {
        id: { in: uniqueIds },
        companyAccess: {
          some: {
            companyId,
            isActive: true,
          },
        },
      },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "PayrollRun") {
    const rows = await db.payrollRun.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "PayPeriod") {
    const rows = await db.payPeriod.findMany({
      where: { id: { in: uniqueIds }, pattern: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "PayPeriodPattern") {
    const rows = await db.payPeriodPattern.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "Employee") {
    const rows = await db.employee.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "Department") {
    const rows = await db.department.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "Position") {
    const rows = await db.position.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "Branch") {
    const rows = await db.branch.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "Division") {
    const rows = await db.division.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "Rank") {
    const rows = await db.rank.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmploymentStatus") {
    const rows = await db.employmentStatus.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmploymentType") {
    const rows = await db.employmentType.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmploymentClass") {
    const rows = await db.employmentClass.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "WorkSchedule") {
    const rows = await db.workSchedule.findMany({
      where: {
        id: { in: uniqueIds },
        OR: [{ companyId }, { companyId: null }],
      },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "LeaveType") {
    const rows = await db.leaveType.findMany({
      where: {
        id: { in: uniqueIds },
        OR: [{ companyId }, { companyId: null }],
      },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "DeductionType") {
    const rows = await db.deductionType.findMany({
      where: {
        id: { in: uniqueIds },
        OR: [{ companyId }, { companyId: null }],
      },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "LeaveBalance") {
    const rows = await db.leaveBalance.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "LeaveRequest") {
    const rows = await db.leaveRequest.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "OvertimeRequest") {
    const rows = await db.overtimeRequest.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "DailyTimeRecord") {
    const rows = await db.dailyTimeRecord.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "RecurringDeduction") {
    const rows = await db.recurringDeduction.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "Payslip") {
    const rows = await db.payslip.findMany({
      where: { id: { in: uniqueIds }, payrollRun: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeeMedicalRecord") {
    const rows = await db.employeeMedicalRecord.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeeMedicalAttachment") {
    const rows = await db.employeeMedicalAttachment.findMany({
      where: { id: { in: uniqueIds }, medicalRecord: { employee: { companyId } } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeeTraining") {
    const rows = await db.employeeTraining.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeeDependent") {
    const rows = await db.employeeDependent.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeeBeneficiary") {
    const rows = await db.employeeBeneficiary.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeeEducation") {
    const rows = await db.employeeEducation.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeeSalaryHistory") {
    const rows = await db.employeeSalaryHistory.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeePositionHistory") {
    const rows = await db.employeePositionHistory.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeeStatusHistory") {
    const rows = await db.employeeStatusHistory.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeeRankHistory") {
    const rows = await db.employeeRankHistory.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  if (tableName === "EmployeePreviousEmployment") {
    const rows = await db.employeePreviousEmployment.findMany({
      where: { id: { in: uniqueIds }, employee: { companyId } },
      select: { id: true },
    })
    return listToSet(rows)
  }

  return new Set<string>()
}

const scopeLogsToCompany = async (logs: AuditLogWithUser[], companyId: string): Promise<AuditLogWithUser[]> => {
  const tableToIds = new Map<string, string[]>()
  for (const log of logs) {
    if (!STRICT_TABLE_NAMES.has(log.tableName)) continue
    pushScopedIds(tableToIds, log.tableName, log.recordId)
  }

  const resolvedEntries = await Promise.all(
    Array.from(tableToIds.entries()).map(async ([tableName, ids]) => {
      const allowed = await resolveScopedRecordIds(tableName, ids, companyId)
      return [tableName, allowed] as const
    })
  )
  const allowedByTable = new Map<string, Set<string>>(resolvedEntries)

  return logs.filter((log) => {
    if (STRICT_TABLE_NAMES.has(log.tableName)) {
      return allowedByTable.get(log.tableName)?.has(log.recordId) ?? false
    }

    if (ACTOR_SCOPED_TABLE_NAMES.has(log.tableName)) {
      return Boolean(log.user?.companyAccess.length)
    }

    return false
  })
}

const matchesQuery = (log: AuditLogWithUser, query: string): boolean => {
  if (!query) return true

  const text = [
    log.tableName,
    log.recordId,
    log.fieldName ?? "",
    log.reason ?? "",
    log.oldValue ?? "",
    log.newValue ?? "",
    log.ipAddress ?? "",
    log.userAgent ?? "",
    log.user?.username ?? "",
    log.user?.firstName ?? "",
    log.user?.lastName ?? "",
  ]
    .join(" ")
    .toLowerCase()

  return text.includes(query)
}

const countByAction = (logs: AuditLogWithUser[], action: AuditAction): number => {
  return logs.reduce((count, row) => (row.action === action ? count + 1 : count), 0)
}

export async function getAuditLogsViewModel(
  companyId: string,
  options: AuditLogsQuery = {}
): Promise<AuditLogsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const actionFilter = normalizeActionFilter(options.action)
  const rangeFilter = normalizeRangeFilter(options.range)
  const tableFilter = options.table?.trim() || null
  const query = options.q?.trim().toLowerCase() ?? ""
  const page = normalizePage(options.page)

  const baseRows = await db.auditLog.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: MAX_AUDIT_LOG_SCAN,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          companyAccess: {
            where: {
              companyId: context.companyId,
              isActive: true,
            },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  })

  const companyScopedRows = await scopeLogsToCompany(baseRows, context.companyId)
  const availableTables = Array.from(new Set(companyScopedRows.map((row) => row.tableName))).sort((a, b) =>
    a.localeCompare(b)
  )
  const cutoffDate = toCutoffDate(rangeFilter)

  const filteredRows = companyScopedRows.filter((row) => {
    if (cutoffDate && row.createdAt < cutoffDate) return false
    if (actionFilter !== "ALL" && row.action !== actionFilter) return false
    if (tableFilter && row.tableName !== tableFilter) return false
    return matchesQuery(row, query)
  })

  const totalItems = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * PAGE_SIZE
  const pageRows = filteredRows.slice(offset, offset + PAGE_SIZE)

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    query: options.q?.trim() ?? "",
    actionFilter,
    rangeFilter,
    tableFilter,
    availableTables,
    summary: {
      totalVisible: totalItems,
      createCount: countByAction(filteredRows, "CREATE"),
      updateCount: countByAction(filteredRows, "UPDATE"),
      deleteCount: countByAction(filteredRows, "DELETE"),
      restoreCount: countByAction(filteredRows, "RESTORE"),
    },
    pagination: {
      page: safePage,
      pageSize: PAGE_SIZE,
      totalItems,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    },
    rows: pageRows.map((row) => ({
      id: row.id,
      tableName: row.tableName,
      recordId: row.recordId,
      action: row.action,
      fieldName: row.fieldName,
      oldValue: row.oldValue,
      newValue: row.newValue,
      reason: row.reason,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      actorName: toActorName(row),
      actorUsername: row.user?.username ?? null,
      createdAtLabel: toDateTimeLabel(row.createdAt),
      createdAtIso: row.createdAt.toISOString(),
    })),
  }
}
