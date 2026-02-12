import { RequestStatus } from "@prisma/client"

import { db } from "@/lib/db"

type SyncDomain = "leave" | "overtime" | "balance"

type LegacyRow = Record<string, unknown>

type EmployeeLite = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  reportingManagerId: string | null
}

export type LegacySyncUnmatchedRow = {
  domain: SyncDomain
  reason: string
  legacyRecordId: string
  employeeNumber: string
  firstName: string
  lastName: string
  leaveTypeCode?: string
  leaveTypeName?: string
}

export type LegacySyncSkippedRow = {
  domain: SyncDomain
  reason: string
  legacyRecordId: string
  status?: string
}

export type LegacySyncErrorRow = {
  domain: SyncDomain
  message: string
}

export type LegacySyncSummary = {
  fetched: {
    leaveRequests: number
    overtimeRequests: number
    leaveBalances: number
  }
  processed: {
    leaveRequests: number
    overtimeRequests: number
    leaveBalances: number
    leaveTypesCreated: number
  }
  unmatchedCount: number
  skippedCount: number
  errorCount: number
}

export type LegacySyncExecutionResult = {
  summary: LegacySyncSummary
  unmatched: LegacySyncUnmatchedRow[]
  skipped: LegacySyncSkippedRow[]
  errors: LegacySyncErrorRow[]
}

export type ExecuteLegacySyncInput = {
  companyId: string
  baseUrl: string
  legacyScopeId?: string
  apiToken?: string
  leaveEndpoint: string
  overtimeEndpoint: string
  balanceEndpoint: string
  timeoutMs: number
  dryRun: boolean
}

const STATUS_MAP: Record<string, RequestStatus> = {
  PENDING_MANAGER: RequestStatus.PENDING,
  PENDING_HR: RequestStatus.SUPERVISOR_APPROVED,
  APPROVED: RequestStatus.APPROVED,
  REJECTED: RequestStatus.REJECTED,
  CANCELLED: RequestStatus.CANCELLED,
}

const normalizeText = (value: string | null | undefined): string => {
  if (!value) return ""
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

const safeString = (value: unknown): string => {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

const safeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const readPath = (obj: LegacyRow | null, dotPath: string): unknown => {
  if (!obj) return null
  let cursor: unknown = obj

  for (const part of dotPath.split(".")) {
    if (typeof cursor !== "object" || cursor === null) return null
    if (!(part in cursor)) return null
    cursor = (cursor as Record<string, unknown>)[part]
  }

  return cursor
}

const pickPath = (obj: LegacyRow | null, paths: string[]): unknown => {
  for (const candidate of paths) {
    const value = readPath(obj, candidate)
    if (value !== null && value !== undefined && value !== "") {
      return value
    }
  }
  return null
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const toUtcDateOnly = (value: Date): Date => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

const toUtcTimeOnlyFromDate = (value: Date): Date => {
  return new Date(
    Date.UTC(
      1970,
      0,
      1,
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds()
    )
  )
}

const parseTimeStringToUtcTime = (value: unknown): Date | null => {
  const text = safeString(value)
  const matched = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text)
  if (!matched) return null

  const hour = Number(matched[1])
  const minute = Number(matched[2])
  const second = Number(matched[3] ?? "0")
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null
  }

  return new Date(Date.UTC(1970, 0, 1, hour, minute, second, 0))
}

const splitName = (value: unknown): { firstName: string; lastName: string } => {
  const raw = safeString(value)
  if (!raw) return { firstName: "", lastName: "" }

  if (raw.includes(",")) {
    const [lastPart, firstPart] = raw.split(",").map((item) => item.trim())
    return {
      firstName: firstPart ?? "",
      lastName: lastPart ?? "",
    }
  }

  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" }
  }

  return {
    firstName: parts[0] ?? "",
    lastName: parts[parts.length - 1] ?? "",
  }
}

const nameKey = (firstName: string, lastName: string): string => {
  return `${normalizeText(firstName)}|${normalizeText(lastName)}`
}

const slugify = (value: string): string => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase()

  return normalized || "LEGACY_TYPE"
}

const canonicalizeLeaveTypeName = (value: string): string => {
  const base = normalizeText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!base) return ""

  const withoutLeaveWord = base
    .replace(/\bleave\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const aliasMap: Record<string, string> = {
    bereavement: "bereavement",
    emergency: "emergency",
    maternity: "maternity",
    paternity: "paternity",
    mandatory: "mandatory",
    sick: "sick",
    vacation: "vacation",
    cto: "cto",
    "compensary time off": "cto",
    "compensatory time off": "cto",
    unpaid: "without pay",
    lwop: "without pay",
    "without pay": "without pay",
    "leave without pay": "without pay",
  }

  const canonical = aliasMap[withoutLeaveWord] ?? withoutLeaveWord
  return canonical
}

const statusFromLegacy = (value: unknown): RequestStatus | null => {
  const normalized = safeString(value).toUpperCase()
  return STATUS_MAP[normalized] ?? null
}

const unwrapRows = (payload: unknown): LegacyRow[] => {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is LegacyRow => typeof row === "object" && row !== null) as LegacyRow[]
  }

  if (!payload || typeof payload !== "object") {
    return []
  }

  const wrapper = payload as Record<string, unknown>
  const keys = ["data", "items", "rows", "records"]
  for (const key of keys) {
    const candidate = wrapper[key]
    if (Array.isArray(candidate)) {
      return candidate.filter((row): row is LegacyRow => typeof row === "object" && row !== null) as LegacyRow[]
    }
  }

  return []
}

const fetchWithTimeout = async (
  url: string,
  options: { method: "GET"; headers: Record<string, string> },
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const fetchRows = async (input: {
  baseUrl: string
  endpoint: string
  companyId: string
  legacyScopeId?: string
  apiToken?: string
  timeoutMs: number
}): Promise<LegacyRow[]> => {
  const url = new URL(input.endpoint, input.baseUrl)
  url.searchParams.set("companyId", input.companyId)
  if (input.legacyScopeId) {
    url.searchParams.set("businessUnitId", input.legacyScopeId)
  }

  const headers: Record<string, string> = { Accept: "application/json" }
  if (input.apiToken) {
    headers.Authorization = `Bearer ${input.apiToken}`
  }

  const response = await fetchWithTimeout(url.toString(), { method: "GET", headers }, input.timeoutMs)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Legacy API failed ${response.status} ${response.statusText} on ${url.pathname}: ${body.slice(0, 240)}`
    )
  }

  const payload = (await response.json()) as unknown
  return unwrapRows(payload)
}

const extractEmployeeIdentity = (row: LegacyRow): { employeeNumber: string; firstName: string; lastName: string } => {
  const employeeNumber = safeString(
    pickPath(row, [
      "employeeNumber",
      "employeeId",
      "user.employeeId",
      "employee.employeeNumber",
      "employee.employeeId",
    ])
  )

  const firstName = safeString(pickPath(row, ["firstName", "user.firstName", "employee.firstName"]))
  const lastName = safeString(pickPath(row, ["lastName", "user.lastName", "employee.lastName"]))

  if (firstName && lastName) {
    return { employeeNumber, firstName, lastName }
  }

  const parsed = splitName(pickPath(row, ["employeeName", "user.name", "employee.name", "name"]))
  return {
    employeeNumber,
    firstName: firstName || parsed.firstName,
    lastName: lastName || parsed.lastName,
  }
}

const extractApproverIdentity = (
  row: LegacyRow,
  prefix: "manager" | "hr"
): { employeeNumber: string; firstName: string; lastName: string } => {
  const employeeNumber = safeString(
    pickPath(row, [
      `${prefix}EmployeeNumber`,
      `${prefix}EmployeeId`,
      `${prefix}.employeeNumber`,
      `${prefix}.employeeId`,
    ])
  )
  const firstName = safeString(pickPath(row, [`${prefix}FirstName`, `${prefix}.firstName`]))
  const lastName = safeString(pickPath(row, [`${prefix}LastName`, `${prefix}.lastName`]))
  if (firstName && lastName) {
    return { employeeNumber, firstName, lastName }
  }

  const parsed = splitName(pickPath(row, [`${prefix}Name`, `${prefix}.name`]))
  return {
    employeeNumber,
    firstName: firstName || parsed.firstName,
    lastName: lastName || parsed.lastName,
  }
}

const extractLeaveTypeIdentity = (row: LegacyRow): { code: string; name: string } => {
  const code = safeString(pickPath(row, ["leaveTypeCode", "leaveType.code", "leaveTypeId"]))
  const name = safeString(pickPath(row, ["leaveTypeName", "leaveType.name", "leaveType"]))
  return { code, name }
}

const legacyRequestNumber = (kind: "LR" | "OT", row: LegacyRow): string | null => {
  const legacyId = safeString(pickPath(row, ["id", "legacyId"]))
  if (legacyId) return `LEGACY-${kind}-${legacyId}`

  const fallback = safeString(pickPath(row, ["requestNumber"]))
  if (!fallback) return null
  return `LEGACY-${kind}-${fallback}`
}

const legacyRecordId = (row: LegacyRow): string => {
  return safeString(pickPath(row, ["id", "legacyId", "requestNumber"])) || "UNKNOWN"
}

const computeInclusiveDays = (startDate: Date, endDate: Date): number => {
  const start = toUtcDateOnly(startDate)
  const end = toUtcDateOnly(endDate)
  const diffMs = end.getTime() - start.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
}

const buildEmployeeResolver = async (companyId: string) => {
  const employees = await db.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      reportingManagerId: true,
    },
  })

  const byEmployeeNumber = new Map<string, EmployeeLite>()
  const byName = new Map<string, EmployeeLite[]>()

  for (const employee of employees) {
    const lite: EmployeeLite = {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      reportingManagerId: employee.reportingManagerId,
    }

    const employeeNumberKey = normalizeText(employee.employeeNumber)
    if (employeeNumberKey) {
      byEmployeeNumber.set(employeeNumberKey, lite)
    }

    const fullNameKey = nameKey(employee.firstName, employee.lastName)
    const existing = byName.get(fullNameKey) ?? []
    existing.push(lite)
    byName.set(fullNameKey, existing)
  }

  const resolve = (identity: { employeeNumber: string; firstName: string; lastName: string }) => {
    const employeeNumberKey = normalizeText(identity.employeeNumber)
    if (employeeNumberKey) {
      const directMatch = byEmployeeNumber.get(employeeNumberKey)
      if (directMatch) {
        return {
          matched: directMatch,
          reason: null as string | null,
        }
      }
    }

    const firstName = normalizeText(identity.firstName)
    const lastName = normalizeText(identity.lastName)
    if (firstName && lastName) {
      const candidates = byName.get(`${firstName}|${lastName}`) ?? []
      if (candidates.length === 1) {
        return {
          matched: candidates[0],
          reason: null as string | null,
        }
      }
      if (candidates.length > 1) {
        return {
          matched: null,
          reason: "AMBIGUOUS_NAME_MATCH",
        }
      }
    }

    return {
      matched: null,
      reason: "NO_EMPLOYEE_MATCH",
    }
  }

  return { resolve, employeeCount: employees.length }
}

const buildLeaveTypeResolver = async (companyId: string, dryRun: boolean) => {
  const leaveTypes = await db.leaveType.findMany({
    where: {
      OR: [{ companyId }, { companyId: null }],
      isActive: true,
    },
    select: {
      id: true,
      companyId: true,
      code: true,
      name: true,
    },
  })

  const byCode = new Map<string, { id: string; companyId: string | null; code: string; name: string }>()
  const byName = new Map<string, { id: string; companyId: string | null; code: string; name: string }>()
  const byCanonicalName = new Map<string, Array<{ id: string; companyId: string | null; code: string; name: string }>>()
  const byLegacyCode = new Map<string, { id: string; companyId: string | null; code: string; name: string }>()

  for (const leaveType of leaveTypes) {
    byCode.set(normalizeText(leaveType.code), leaveType)
    byName.set(normalizeText(leaveType.name), leaveType)

    const canonical = canonicalizeLeaveTypeName(leaveType.name)
    if (canonical) {
      const existing = byCanonicalName.get(canonical) ?? []
      existing.push(leaveType)
      byCanonicalName.set(canonical, existing)
    }
  }

  let createdCount = 0

  const pickPreferredLeaveType = (
    candidates: Array<{ id: string; companyId: string | null; code: string; name: string }>
  ) => {
    if (candidates.length === 0) return null
    const companyScoped = candidates.find((item) => item.companyId === companyId)
    return companyScoped ?? candidates[0]
  }

  const resolve = async (identity: { code: string; name: string }) => {
    const codeKey = normalizeText(identity.code)
    const nameKeyValue = normalizeText(identity.name)
    const canonicalNameKey = canonicalizeLeaveTypeName(identity.name)

    if (codeKey && byCode.has(codeKey)) return byCode.get(codeKey) ?? null
    if (nameKeyValue && byName.has(nameKeyValue)) return byName.get(nameKeyValue) ?? null
    if (canonicalNameKey && byCanonicalName.has(canonicalNameKey)) {
      const candidate = pickPreferredLeaveType(byCanonicalName.get(canonicalNameKey) ?? [])
      if (candidate) return candidate
    }
    if (identity.code && byLegacyCode.has(identity.code)) return byLegacyCode.get(identity.code) ?? null

    if (dryRun) {
      return null
    }

    const baseCode = `LEGACY_${slugify(identity.code || identity.name || "TYPE")}`
    const name = safeString(identity.name) || safeString(identity.code) || "Legacy Leave Type"
    let created:
      | {
          id: string
          companyId: string | null
          code: string
          name: string
        }
      | null = null

    for (let suffix = 0; suffix < 30; suffix += 1) {
      const candidateCode = suffix === 0 ? baseCode : `${baseCode}_${suffix}`
      try {
        created = await db.leaveType.create({
          data: {
            companyId,
            code: candidateCode,
            name,
            description: "Imported from legacy leave system",
            isPaid: true,
            allowHalfDay: true,
            isActive: true,
            requiresApproval: true,
          },
          select: {
            id: true,
            companyId: true,
            code: true,
            name: true,
          },
        })
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.includes("Unique constraint")) {
          throw error
        }
      }
    }

    if (!created) {
      return null
    }

    createdCount += 1
    byCode.set(normalizeText(created.code), created)
    byName.set(normalizeText(created.name), created)
    const canonical = canonicalizeLeaveTypeName(created.name)
    if (canonical) {
      const existing = byCanonicalName.get(canonical) ?? []
      existing.push(created)
      byCanonicalName.set(canonical, existing)
    }
    if (identity.code) {
      byLegacyCode.set(identity.code, created)
    }
    return created
  }

  return {
    resolve,
    getCreatedCount: (): number => createdCount,
  }
}

const mapLeaveStatus = (input: {
  status: unknown
  managerActionAt: Date | null
  managerComments: string | null
  hrActionAt: Date | null
  hrComments: string | null
  supervisorApproverId: string | null
  hrApproverId: string | null
}) => {
  const statusCode = statusFromLegacy(input.status)
  if (!statusCode) return null

  const mapped = {
    statusCode,
    supervisorApproverId: input.supervisorApproverId,
    supervisorApprovedAt: null as Date | null,
    supervisorApprovalRemarks: null as string | null,
    hrApproverId: input.hrApproverId,
    hrApprovedAt: null as Date | null,
    hrApprovalRemarks: null as string | null,
    hrRejectedAt: null as Date | null,
    hrRejectionReason: null as string | null,
    approverId: null as string | null,
    approvedAt: null as Date | null,
    approvalRemarks: null as string | null,
    rejectedAt: null as Date | null,
    rejectionReason: null as string | null,
    cancelledAt: null as Date | null,
    cancellationReason: null as string | null,
  }

  if (statusCode === RequestStatus.SUPERVISOR_APPROVED || statusCode === RequestStatus.APPROVED) {
    mapped.supervisorApprovedAt = input.managerActionAt
    mapped.supervisorApprovalRemarks = input.managerComments
    mapped.approverId = input.supervisorApproverId
    mapped.approvedAt = input.managerActionAt
    mapped.approvalRemarks = input.managerComments
  }

  if (statusCode === RequestStatus.APPROVED) {
    mapped.hrApprovedAt = input.hrActionAt
    mapped.hrApprovalRemarks = input.hrComments
    if (input.hrApproverId) mapped.approverId = input.hrApproverId
    if (input.hrActionAt) mapped.approvedAt = input.hrActionAt
    if (input.hrComments) mapped.approvalRemarks = input.hrComments
  }

  if (statusCode === RequestStatus.REJECTED) {
    if (input.hrActionAt || input.hrComments) {
      mapped.hrRejectedAt = input.hrActionAt
      mapped.hrRejectionReason = input.hrComments || "Rejected in legacy system"
      mapped.rejectedAt = input.hrActionAt
      mapped.rejectionReason = input.hrComments || "Rejected in legacy system"
      if (input.hrApproverId) mapped.approverId = input.hrApproverId
      mapped.supervisorApprovedAt = input.managerActionAt
      mapped.supervisorApprovalRemarks = input.managerComments
    } else {
      mapped.rejectedAt = input.managerActionAt
      mapped.rejectionReason = input.managerComments || "Rejected in legacy system"
      mapped.approverId = input.supervisorApproverId
    }
  }

  if (statusCode === RequestStatus.CANCELLED) {
    mapped.cancelledAt = input.hrActionAt ?? input.managerActionAt
    mapped.cancellationReason = input.hrComments || input.managerComments || "Cancelled in legacy system"
  }

  return mapped
}

const mapOvertimeStatus = (input: {
  status: unknown
  managerActionAt: Date | null
  managerComments: string | null
  hrActionAt: Date | null
  hrComments: string | null
  supervisorApproverId: string | null
  hrApproverId: string | null
}) => {
  const statusCode = statusFromLegacy(input.status)
  if (!statusCode) return null

  const mapped = {
    statusCode,
    supervisorApproverId: input.supervisorApproverId,
    supervisorApprovedAt: null as Date | null,
    supervisorApprovalRemarks: null as string | null,
    hrApproverId: input.hrApproverId,
    hrApprovedAt: null as Date | null,
    hrApprovalRemarks: null as string | null,
    hrRejectedAt: null as Date | null,
    hrRejectionReason: null as string | null,
    approverId: null as string | null,
    approvedAt: null as Date | null,
    approvalRemarks: null as string | null,
    rejectedAt: null as Date | null,
    rejectionReason: null as string | null,
  }

  if (statusCode === RequestStatus.SUPERVISOR_APPROVED || statusCode === RequestStatus.APPROVED) {
    mapped.supervisorApprovedAt = input.managerActionAt
    mapped.supervisorApprovalRemarks = input.managerComments
    mapped.approverId = input.supervisorApproverId
    mapped.approvedAt = input.managerActionAt
    mapped.approvalRemarks = input.managerComments
  }

  if (statusCode === RequestStatus.APPROVED) {
    mapped.hrApprovedAt = input.hrActionAt
    mapped.hrApprovalRemarks = input.hrComments
    if (input.hrApproverId) mapped.approverId = input.hrApproverId
    if (input.hrActionAt) mapped.approvedAt = input.hrActionAt
    if (input.hrComments) mapped.approvalRemarks = input.hrComments
  }

  if (statusCode === RequestStatus.REJECTED) {
    if (input.hrActionAt || input.hrComments) {
      mapped.hrRejectedAt = input.hrActionAt
      mapped.hrRejectionReason = input.hrComments || "Rejected in legacy system"
      mapped.rejectedAt = input.hrActionAt
      mapped.rejectionReason = input.hrComments || "Rejected in legacy system"
      if (input.hrApproverId) mapped.approverId = input.hrApproverId
      mapped.supervisorApprovedAt = input.managerActionAt
      mapped.supervisorApprovalRemarks = input.managerComments
    } else {
      mapped.rejectedAt = input.managerActionAt
      mapped.rejectionReason = input.managerComments || "Rejected in legacy system"
      mapped.approverId = input.supervisorApproverId
    }
  }

  return mapped
}

export async function executeLegacyLeaveOvertimeSync(input: ExecuteLegacySyncInput): Promise<LegacySyncExecutionResult> {
  const employeeResolver = await buildEmployeeResolver(input.companyId)
  const leaveTypeResolver = await buildLeaveTypeResolver(input.companyId, input.dryRun)

  const [legacyLeaves, legacyOvertime] = await Promise.all([
    fetchRows({
      baseUrl: input.baseUrl,
      endpoint: input.leaveEndpoint,
      companyId: input.companyId,
      legacyScopeId: input.legacyScopeId,
      apiToken: input.apiToken,
      timeoutMs: input.timeoutMs,
    }),
    fetchRows({
      baseUrl: input.baseUrl,
      endpoint: input.overtimeEndpoint,
      companyId: input.companyId,
      legacyScopeId: input.legacyScopeId,
      apiToken: input.apiToken,
      timeoutMs: input.timeoutMs,
    }),
  ])

  const unmatched: LegacySyncUnmatchedRow[] = []
  const skipped: LegacySyncSkippedRow[] = []
  const errors: LegacySyncErrorRow[] = []

  const processed = {
    leaveRequests: 0,
    overtimeRequests: 0,
    leaveBalances: 0,
    leaveTypesCreated: 0,
  }

  for (const row of legacyLeaves) {
    try {
      const recordId = legacyRecordId(row)
      const requestNumber = legacyRequestNumber("LR", row)
      if (!requestNumber) {
        skipped.push({ domain: "leave", reason: "MISSING_LEGACY_ID_OR_REQUEST_NUMBER", legacyRecordId: recordId })
        continue
      }

      const employeeIdentity = extractEmployeeIdentity(row)
      const employeeMatch = employeeResolver.resolve(employeeIdentity)
      if (!employeeMatch.matched) {
        unmatched.push({
          domain: "leave",
          reason: employeeMatch.reason ?? "NO_EMPLOYEE_MATCH",
          legacyRecordId: recordId,
          employeeNumber: employeeIdentity.employeeNumber,
          firstName: employeeIdentity.firstName,
          lastName: employeeIdentity.lastName,
        })
        continue
      }

      const leaveTypeIdentity = extractLeaveTypeIdentity(row)
      const leaveType = await leaveTypeResolver.resolve(leaveTypeIdentity)
      if (!leaveType) {
        unmatched.push({
          domain: "leave",
          reason: "LEAVE_TYPE_NOT_FOUND_OR_CREATE_FAILED",
          legacyRecordId: recordId,
          employeeNumber: employeeIdentity.employeeNumber,
          firstName: employeeIdentity.firstName,
          lastName: employeeIdentity.lastName,
          leaveTypeCode: leaveTypeIdentity.code,
          leaveTypeName: leaveTypeIdentity.name,
        })
        continue
      }

      const startDateRaw = toDate(pickPath(row, ["startDate"]))
      const endDateRaw = toDate(pickPath(row, ["endDate"]))
      if (!startDateRaw || !endDateRaw) {
        skipped.push({ domain: "leave", reason: "INVALID_START_OR_END_DATE", legacyRecordId: recordId })
        continue
      }

      const startDate = toUtcDateOnly(startDateRaw)
      const endDate = toUtcDateOnly(endDateRaw)
      if (endDate.getTime() < startDate.getTime()) {
        skipped.push({ domain: "leave", reason: "END_DATE_BEFORE_START_DATE", legacyRecordId: recordId })
        continue
      }

      const session = safeString(pickPath(row, ["session"])).toUpperCase()
      const inferredDays = session === "MORNING" || session === "AFTERNOON"
        ? computeInclusiveDays(startDate, endDate) * 0.5
        : computeInclusiveDays(startDate, endDate)
      const providedDays = safeNumber(pickPath(row, ["numberOfDays", "days"]))
      const numberOfDays = providedDays && providedDays > 0 ? providedDays : inferredDays
      if (!Number.isFinite(numberOfDays) || numberOfDays <= 0) {
        skipped.push({ domain: "leave", reason: "INVALID_NUMBER_OF_DAYS", legacyRecordId: recordId })
        continue
      }

      const managerIdentity = extractApproverIdentity(row, "manager")
      const hrIdentity = extractApproverIdentity(row, "hr")
      const managerApprover = managerIdentity.employeeNumber || managerIdentity.firstName || managerIdentity.lastName
        ? employeeResolver.resolve(managerIdentity).matched
        : null
      const hrApprover = hrIdentity.employeeNumber || hrIdentity.firstName || hrIdentity.lastName
        ? employeeResolver.resolve(hrIdentity).matched
        : null

      const managerActionAt = toDate(pickPath(row, ["managerActionAt"]))
      const hrActionAt = toDate(pickPath(row, ["hrActionAt"]))
      const managerComments = safeString(pickPath(row, ["managerComments"])) || null
      const hrComments = safeString(pickPath(row, ["hrComments"])) || null
      const mappedStatus = mapLeaveStatus({
        status: pickPath(row, ["status"]),
        managerActionAt,
        managerComments,
        hrActionAt,
        hrComments,
        supervisorApproverId: managerApprover?.id ?? employeeMatch.matched.reportingManagerId ?? null,
        hrApproverId: hrApprover?.id ?? null,
      })
      if (!mappedStatus) {
        skipped.push({
          domain: "leave",
          reason: "UNSUPPORTED_STATUS",
          legacyRecordId: recordId,
          status: safeString(pickPath(row, ["status"])),
        })
        continue
      }

      const createdAt = toDate(pickPath(row, ["createdAt"]))
      const updatedAt = toDate(pickPath(row, ["updatedAt"]))
      const reason = safeString(pickPath(row, ["reason"])) || null
      const submittedAt = createdAt ?? new Date()
      const isHalfDay = session === "MORNING" || session === "AFTERNOON"
      const halfDayPeriod = session === "MORNING" ? "AM" : session === "AFTERNOON" ? "PM" : null

      if (!input.dryRun) {
        await db.leaveRequest.upsert({
          where: { requestNumber },
          update: {
            employeeId: employeeMatch.matched.id,
            leaveTypeId: leaveType.id,
            startDate,
            endDate,
            numberOfDays,
            isHalfDay,
            halfDayPeriod,
            reason,
            statusCode: mappedStatus.statusCode,
            submittedAt,
            supervisorApproverId: mappedStatus.supervisorApproverId,
            supervisorApprovedAt: mappedStatus.supervisorApprovedAt,
            supervisorApprovalRemarks: mappedStatus.supervisorApprovalRemarks,
            hrApproverId: mappedStatus.hrApproverId,
            hrApprovedAt: mappedStatus.hrApprovedAt,
            hrApprovalRemarks: mappedStatus.hrApprovalRemarks,
            hrRejectedAt: mappedStatus.hrRejectedAt,
            hrRejectionReason: mappedStatus.hrRejectionReason,
            approverId: mappedStatus.approverId,
            approvedAt: mappedStatus.approvedAt,
            approvalRemarks: mappedStatus.approvalRemarks,
            rejectedAt: mappedStatus.rejectedAt,
            rejectionReason: mappedStatus.rejectionReason,
            cancelledAt: mappedStatus.cancelledAt,
            cancellationReason: mappedStatus.cancellationReason,
            ...(updatedAt ? { updatedAt } : {}),
          },
          create: {
            requestNumber,
            employeeId: employeeMatch.matched.id,
            leaveTypeId: leaveType.id,
            startDate,
            endDate,
            numberOfDays,
            isHalfDay,
            halfDayPeriod,
            reason,
            statusCode: mappedStatus.statusCode,
            submittedAt,
            supervisorApproverId: mappedStatus.supervisorApproverId,
            supervisorApprovedAt: mappedStatus.supervisorApprovedAt,
            supervisorApprovalRemarks: mappedStatus.supervisorApprovalRemarks,
            hrApproverId: mappedStatus.hrApproverId,
            hrApprovedAt: mappedStatus.hrApprovedAt,
            hrApprovalRemarks: mappedStatus.hrApprovalRemarks,
            hrRejectedAt: mappedStatus.hrRejectedAt,
            hrRejectionReason: mappedStatus.hrRejectionReason,
            approverId: mappedStatus.approverId,
            approvedAt: mappedStatus.approvedAt,
            approvalRemarks: mappedStatus.approvalRemarks,
            rejectedAt: mappedStatus.rejectedAt,
            rejectionReason: mappedStatus.rejectionReason,
            cancelledAt: mappedStatus.cancelledAt,
            cancellationReason: mappedStatus.cancellationReason,
            ...(createdAt ? { createdAt } : {}),
            ...(updatedAt ? { updatedAt } : {}),
          },
        })
      }

      processed.leaveRequests += 1
    } catch (error) {
      errors.push({
        domain: "leave",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const row of legacyOvertime) {
    try {
      const recordId = legacyRecordId(row)
      const requestNumber = legacyRequestNumber("OT", row)
      if (!requestNumber) {
        skipped.push({ domain: "overtime", reason: "MISSING_LEGACY_ID_OR_REQUEST_NUMBER", legacyRecordId: recordId })
        continue
      }

      const employeeIdentity = extractEmployeeIdentity(row)
      const employeeMatch = employeeResolver.resolve(employeeIdentity)
      if (!employeeMatch.matched) {
        unmatched.push({
          domain: "overtime",
          reason: employeeMatch.reason ?? "NO_EMPLOYEE_MATCH",
          legacyRecordId: recordId,
          employeeNumber: employeeIdentity.employeeNumber,
          firstName: employeeIdentity.firstName,
          lastName: employeeIdentity.lastName,
        })
        continue
      }

      const startRaw = pickPath(row, ["startTime"])
      const endRaw = pickPath(row, ["endTime"])
      const startDateTime = toDate(startRaw)
      const endDateTime = toDate(endRaw)
      const normalizedStartTime = startDateTime
        ? toUtcTimeOnlyFromDate(startDateTime)
        : parseTimeStringToUtcTime(startRaw)
      const normalizedEndTime = endDateTime
        ? toUtcTimeOnlyFromDate(endDateTime)
        : parseTimeStringToUtcTime(endRaw)
      if (!normalizedStartTime || !normalizedEndTime) {
        skipped.push({ domain: "overtime", reason: "INVALID_START_OR_END_TIME", legacyRecordId: recordId })
        continue
      }

      const overtimeDateRaw = toDate(pickPath(row, ["overtimeDate"])) ?? startDateTime
      if (!overtimeDateRaw) {
        skipped.push({ domain: "overtime", reason: "INVALID_OVERTIME_DATE", legacyRecordId: recordId })
        continue
      }
      const overtimeDate = toUtcDateOnly(overtimeDateRaw)

      const providedHours = safeNumber(pickPath(row, ["hours"]))
      const computedHours = (normalizedEndTime.getTime() - normalizedStartTime.getTime()) / (1000 * 60 * 60)
      const hours = providedHours && providedHours > 0 ? providedHours : computedHours
      if (!Number.isFinite(hours) || hours <= 0) {
        skipped.push({ domain: "overtime", reason: "INVALID_HOURS", legacyRecordId: recordId })
        continue
      }

      const managerIdentity = extractApproverIdentity(row, "manager")
      const hrIdentity = extractApproverIdentity(row, "hr")
      const managerApprover = managerIdentity.employeeNumber || managerIdentity.firstName || managerIdentity.lastName
        ? employeeResolver.resolve(managerIdentity).matched
        : null
      const hrApprover = hrIdentity.employeeNumber || hrIdentity.firstName || hrIdentity.lastName
        ? employeeResolver.resolve(hrIdentity).matched
        : null

      const managerActionAt = toDate(pickPath(row, ["managerActionAt"]))
      const hrActionAt = toDate(pickPath(row, ["hrActionAt"]))
      const managerComments = safeString(pickPath(row, ["managerComments"])) || null
      const hrComments = safeString(pickPath(row, ["hrComments"])) || null
      const mappedStatus = mapOvertimeStatus({
        status: pickPath(row, ["status"]),
        managerActionAt,
        managerComments,
        hrActionAt,
        hrComments,
        supervisorApproverId: managerApprover?.id ?? employeeMatch.matched.reportingManagerId ?? null,
        hrApproverId: hrApprover?.id ?? null,
      })
      if (!mappedStatus) {
        skipped.push({
          domain: "overtime",
          reason: "UNSUPPORTED_STATUS",
          legacyRecordId: recordId,
          status: safeString(pickPath(row, ["status"])),
        })
        continue
      }

      const createdAt = toDate(pickPath(row, ["createdAt"]))
      const updatedAt = toDate(pickPath(row, ["updatedAt"]))
      const reason = safeString(pickPath(row, ["reason"])) || null

      if (!input.dryRun) {
        await db.overtimeRequest.upsert({
          where: { requestNumber },
          update: {
            employeeId: employeeMatch.matched.id,
            overtimeDate,
            startTime: normalizedStartTime,
            endTime: normalizedEndTime,
            hours,
            reason,
            statusCode: mappedStatus.statusCode,
            supervisorApproverId: mappedStatus.supervisorApproverId,
            supervisorApprovedAt: mappedStatus.supervisorApprovedAt,
            supervisorApprovalRemarks: mappedStatus.supervisorApprovalRemarks,
            hrApproverId: mappedStatus.hrApproverId,
            hrApprovedAt: mappedStatus.hrApprovedAt,
            hrApprovalRemarks: mappedStatus.hrApprovalRemarks,
            hrRejectedAt: mappedStatus.hrRejectedAt,
            hrRejectionReason: mappedStatus.hrRejectionReason,
            approverId: mappedStatus.approverId,
            approvedAt: mappedStatus.approvedAt,
            approvalRemarks: mappedStatus.approvalRemarks,
            rejectedAt: mappedStatus.rejectedAt,
            rejectionReason: mappedStatus.rejectionReason,
            ...(updatedAt ? { updatedAt } : {}),
          },
          create: {
            requestNumber,
            employeeId: employeeMatch.matched.id,
            overtimeDate,
            startTime: normalizedStartTime,
            endTime: normalizedEndTime,
            hours,
            reason,
            statusCode: mappedStatus.statusCode,
            supervisorApproverId: mappedStatus.supervisorApproverId,
            supervisorApprovedAt: mappedStatus.supervisorApprovedAt,
            supervisorApprovalRemarks: mappedStatus.supervisorApprovalRemarks,
            hrApproverId: mappedStatus.hrApproverId,
            hrApprovedAt: mappedStatus.hrApprovedAt,
            hrApprovalRemarks: mappedStatus.hrApprovalRemarks,
            hrRejectedAt: mappedStatus.hrRejectedAt,
            hrRejectionReason: mappedStatus.hrRejectionReason,
            approverId: mappedStatus.approverId,
            approvedAt: mappedStatus.approvedAt,
            approvalRemarks: mappedStatus.approvalRemarks,
            rejectedAt: mappedStatus.rejectedAt,
            rejectionReason: mappedStatus.rejectionReason,
            ...(createdAt ? { createdAt } : {}),
            ...(updatedAt ? { updatedAt } : {}),
          },
        })
      }

      processed.overtimeRequests += 1
    } catch (error) {
      errors.push({
        domain: "overtime",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  processed.leaveTypesCreated = leaveTypeResolver.getCreatedCount()

  const summary: LegacySyncSummary = {
    fetched: {
      leaveRequests: legacyLeaves.length,
      overtimeRequests: legacyOvertime.length,
      leaveBalances: 0,
    },
    processed: {
      ...processed,
    },
    unmatchedCount: unmatched.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
  }

  return {
    summary,
    unmatched,
    skipped,
    errors,
  }
}
