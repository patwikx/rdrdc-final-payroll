import {
  MaterialRequestItemSource,
  MaterialRequestPostingStatus,
  MaterialRequestProcessingStatus,
  MaterialRequestSeries,
  MaterialRequestStatus,
  MaterialRequestStepStatus,
  MaterialRequestType,
} from "@prisma/client"

import { db } from "@/lib/db"

type LegacyRow = Record<string, unknown>

type LegacySyncUnmatchedRow = {
  domain: "material-request"
  reason: string
  legacyRecordId: string
  requestNumber: string
  legacyStatus: string
  mappedStatus: string
  pendingStepName: string | null
  pendingApproverEmployeeNumber: string
  recommendingApproverEmployeeNumber: string
  recommendingApproverName: string
  recommendingApprovalStatus: string
  finalApproverEmployeeNumber: string
  finalApproverName: string
  finalApprovalStatus: string
  legacyDepartmentCode: string
  legacyDepartmentName: string
  departmentCode: string
  departmentName: string
  employeeNumber: string
  requesterName: string
}

type LegacySyncSkippedRow = {
  domain: "material-request"
  reason: string
  legacyRecordId: string
  requestNumber: string
  status?: string
}

type LegacySyncErrorRow = {
  domain: "material-request"
  message: string
}

type LegacySyncSummary = {
  fetched: {
    materialRequests: number
    items: number
  }
  processed: {
    materialRequests: number
    items: number
    approvalSteps: number
    serveBatches: number
    postings: number
  }
  unmatchedCount: number
  skippedCount: number
  errorCount: number
}

export type LegacyMaterialRequestSyncExecutionResult = {
  summary: LegacySyncSummary
  unmatched: LegacySyncUnmatchedRow[]
  skipped: LegacySyncSkippedRow[]
  errors: LegacySyncErrorRow[]
}

export type ExecuteLegacyMaterialRequestSyncInput = {
  companyId: string
  actorUserId: string
  baseUrl: string
  legacyScopeId?: string
  apiToken?: string
  materialRequestEndpoint: string
  timeoutMs: number
  dryRun: boolean
  targetLegacyRecordIds?: string[]
  manualOverrides: LegacyMaterialRequestManualOverride[]
}

export type LegacyMaterialRequestManualOverride = {
  legacyRecordId: string
  departmentId?: string
  requesterEmployeeNumber?: string
  requesterName?: string
  pendingApproverEmployeeNumber?: string
  recommendingApproverEmployeeNumber?: string
  finalApproverEmployeeNumber?: string
  departmentCode?: string
  departmentName?: string
}

type Identity = {
  employeeNumber: string
  firstName: string
  lastName: string
}

type RequesterEmployeeLite = {
  id: string
  userId: string | null
  employeeNumber: string
  firstName: string
  lastName: string
  departmentId: string | null
}

type ApproverUserLite = {
  userId: string
  firstName: string
  lastName: string
}

type DepartmentLite = {
  id: string
  code: string
  name: string
}

type ApprovalStatusText = "APPROVED" | "DISAPPROVED"

type StageKey = "review" | "budget" | "recommending" | "final"

type StageCandidate = {
  key: StageKey
  name: string
  include: boolean
  approverUserId: string | null
  pending: boolean
  explicitStatus: ApprovalStatusText | null
  actedAt: Date | null
  remarks: string | null
}

type NormalizedItem = {
  lineNumber: number
  legacyItemId: string | null
  itemCode: string | null
  description: string
  uom: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
  remarks: string | null
  quantityServed: number
}

type MaterialRequestApprovalStepCreate = {
  stepNumber: number
  stepName: string
  approverUserId: string
  status: MaterialRequestStepStatus
  actedAt: Date | null
  actedByUserId: string | null
  remarks: string | null
}

const LEGACY_SOURCE_SYSTEM = "LEGACY_MATERIAL_REQUESTS_V1"
const QUANTITY_TOLERANCE = 0.0005

const LEGACY_PENDING_STATUSES = new Set([
  "FOR_REVIEW",
  "PENDING_BUDGET_APPROVAL",
  "FOR_REC_APPROVAL",
  "FOR_FINAL_APPROVAL",
  "REC_APPROVED",
])

const LEGACY_APPROVED_STATUSES = new Set([
  "FINAL_APPROVED",
  "FOR_SERVING",
  "SERVED",
  "FOR_POSTING",
  "POSTED",
  "RECEIVED",
  "ACKNOWLEDGED",
  "DEPLOYED",
  "TRANSMITTED",
])

const LEGACY_POSTED_STATUSES = new Set(["POSTED", "RECEIVED", "ACKNOWLEDGED", "DEPLOYED", "TRANSMITTED"])
const LEGACY_FULLY_SERVED_STATUSES = new Set([
  "FOR_POSTING",
  "POSTED",
  "RECEIVED",
  "ACKNOWLEDGED",
  "DEPLOYED",
  "TRANSMITTED",
  "SERVED",
])

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
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const toNumberValue = (value as { toNumber: () => number }).toNumber()
    return Number.isFinite(toNumberValue) ? toNumberValue : null
  }
  return null
}

const round = (value: number, precision: number): number => {
  const multiplier = 10 ** precision
  return Math.round(value * multiplier) / multiplier
}

const toCurrency = (value: number): number => round(value, 2)
const toQuantity = (value: number): number => round(value, 3)

const asNullableText = (value: unknown): string | null => {
  const text = safeString(value)
  return text.length > 0 ? text : null
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
  for (const path of paths) {
    const value = readPath(obj, path)
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
    return { firstName: parts[0] ?? "", lastName: "" }
  }

  return {
    firstName: parts[0] ?? "",
    lastName: parts[parts.length - 1] ?? "",
  }
}

const hasOverrideValue = (value: string | undefined): boolean => {
  return typeof value === "string" && value.trim().length > 0
}

const nameKey = (firstName: string, lastName: string): string => {
  return `${normalizeText(firstName)}|${normalizeText(lastName)}`
}

const unwrapRows = (payload: unknown): LegacyRow[] => {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is LegacyRow => typeof row === "object" && row !== null)
  }

  if (!payload || typeof payload !== "object") {
    return []
  }

  const source = payload as Record<string, unknown>
  for (const key of ["data", "items", "rows", "records"]) {
    if (Array.isArray(source[key])) {
      return source[key].filter((row): row is LegacyRow => typeof row === "object" && row !== null)
    }
  }

  return []
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

  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (input.apiToken) {
    headers.Authorization = `Bearer ${input.apiToken}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs)

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Legacy API failed ${response.status} ${response.statusText}: ${body.slice(0, 240)}`)
    }

    return unwrapRows(await response.json())
  } finally {
    clearTimeout(timer)
  }
}

const extractIdentity = (row: LegacyRow, params: {
  employeeNumberPaths: string[]
  firstNamePaths?: string[]
  lastNamePaths?: string[]
  namePaths?: string[]
}): Identity => {
  const employeeNumber = safeString(pickPath(row, params.employeeNumberPaths))
  const firstName = safeString(pickPath(row, params.firstNamePaths ?? []))
  const lastName = safeString(pickPath(row, params.lastNamePaths ?? []))

  if (firstName && lastName) {
    return { employeeNumber, firstName, lastName }
  }

  const parsed = splitName(pickPath(row, params.namePaths ?? []))

  return {
    employeeNumber,
    firstName: firstName || parsed.firstName,
    lastName: lastName || parsed.lastName,
  }
}

const hasIdentity = (identity: Identity): boolean => {
  return Boolean(identity.employeeNumber || identity.firstName || identity.lastName)
}

const normalizeLegacyStatus = (value: unknown): string => {
  return safeString(value).toUpperCase()
}

const normalizeApprovalStatus = (value: unknown): ApprovalStatusText | null => {
  const normalized = safeString(value).toUpperCase()
  if (normalized === "APPROVED") return "APPROVED"
  if (normalized === "DISAPPROVED") return "DISAPPROVED"
  return null
}

const mapSeries = (value: unknown): MaterialRequestSeries => {
  const normalized = safeString(value).toUpperCase()
  if (normalized === "PO") return MaterialRequestSeries.PO
  if (normalized === "JO") return MaterialRequestSeries.JO
  return MaterialRequestSeries.OTHERS
}

const mapRequestType = (value: unknown): MaterialRequestType => {
  return safeString(value).toUpperCase() === "SERVICE" ? MaterialRequestType.SERVICE : MaterialRequestType.ITEM
}

const mapRequestStatus = (params: {
  legacyStatus: string
  hasFinalStageSignal: boolean
  finalApprovalStatus: ApprovalStatusText | null
}): MaterialRequestStatus | null => {
  if (params.legacyStatus === "DRAFT" || params.legacyStatus === "FOR_EDIT") {
    return MaterialRequestStatus.DRAFT
  }

  if (params.legacyStatus === "CANCELLED") {
    return MaterialRequestStatus.CANCELLED
  }

  if (params.legacyStatus === "DISAPPROVED") {
    return MaterialRequestStatus.REJECTED
  }

  if (params.legacyStatus === "REC_APPROVED") {
    if (params.hasFinalStageSignal && params.finalApprovalStatus !== "APPROVED") {
      return MaterialRequestStatus.PENDING_APPROVAL
    }
    return MaterialRequestStatus.APPROVED
  }

  if (LEGACY_PENDING_STATUSES.has(params.legacyStatus)) {
    return MaterialRequestStatus.PENDING_APPROVAL
  }

  if (LEGACY_APPROVED_STATUSES.has(params.legacyStatus)) {
    return MaterialRequestStatus.APPROVED
  }

  return null
}

const mapLegacyToUnmatchedDisplayStatus = (params: {
  legacyStatus: string
  mappedStatus: MaterialRequestStatus | null
}): string => {
  if (!params.mappedStatus) {
    return "UNSUPPORTED"
  }

  if (params.mappedStatus !== MaterialRequestStatus.APPROVED) {
    return params.mappedStatus
  }

  if (LEGACY_POSTED_STATUSES.has(params.legacyStatus)) {
    return MaterialRequestPostingStatus.POSTED
  }

  if (params.legacyStatus === "FOR_POSTING") {
    return MaterialRequestPostingStatus.PENDING_POSTING
  }

  if (params.legacyStatus === "FOR_SERVING" || params.legacyStatus === "SERVED") {
    return MaterialRequestProcessingStatus.PENDING_PURCHASER
  }

  return params.mappedStatus
}

const pendingStageKeyFromStatus = (legacyStatus: string, hasFinalStageSignal: boolean): StageKey | null => {
  if (legacyStatus === "FOR_REVIEW") return "review"
  if (legacyStatus === "PENDING_BUDGET_APPROVAL") return "budget"
  if (legacyStatus === "FOR_REC_APPROVAL") return "recommending"
  if (legacyStatus === "FOR_FINAL_APPROVAL") return "final"
  if (legacyStatus === "REC_APPROVED" && hasFinalStageSignal) return "final"
  return null
}

const stageNameMap: Record<StageKey, string> = {
  review: "Review",
  budget: "Budget Approval",
  recommending: "Recommending Approval",
  final: "Final Approval",
}

const buildRequesterResolver = async (companyId: string) => {
  const employees = await db.employee.findMany({
    where: {
      deletedAt: null,
      OR: [
        {
          companyId,
        },
        {
          user: {
            is: {
              isActive: true,
              companyAccess: {
                some: {
                  companyId,
                  isActive: true,
                  company: {
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      departmentId: true,
    },
  })

  const byEmployeeNumber = new Map<string, RequesterEmployeeLite[]>()

  for (const employee of employees) {
    const lite: RequesterEmployeeLite = {
      id: employee.id,
      userId: employee.userId,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      departmentId: employee.departmentId,
    }

    const employeeNumberKey = normalizeText(employee.employeeNumber)
    if (employeeNumberKey) {
      const existing = byEmployeeNumber.get(employeeNumberKey) ?? []
      existing.push(lite)
      byEmployeeNumber.set(employeeNumberKey, existing)
    }
  }

  const resolve = (identity: Identity): { matched: RequesterEmployeeLite | null; reason: string | null } => {
    const employeeNumberKey = normalizeText(identity.employeeNumber)
    if (!employeeNumberKey) {
      return { matched: null, reason: "REQUESTER_EMPLOYEE_NUMBER_MISSING" }
    }

    const candidates = byEmployeeNumber.get(employeeNumberKey) ?? []
    if (candidates.length === 1) {
      return { matched: candidates[0], reason: null }
    }
    if (candidates.length > 1) {
      return { matched: null, reason: "AMBIGUOUS_REQUESTER_EMPLOYEE_NUMBER_MATCH" }
    }

    return { matched: null, reason: "REQUESTER_NOT_FOUND" }
  }

  return { resolve }
}

const buildApproverResolver = async (companyId: string) => {
  const accessRows = await db.userCompanyAccess.findMany({
    where: {
      companyId,
      isActive: true,
      user: {
        isActive: true,
      },
    },
    select: {
      userId: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  const userIds = accessRows.map((row) => row.userId)
  const employeeRows =
    userIds.length > 0
      ? await db.employee.findMany({
          where: {
            userId: {
              in: userIds,
            },
            deletedAt: null,
          },
          select: {
            userId: true,
            employeeNumber: true,
          },
        })
      : []

  const userById = new Map<string, ApproverUserLite>()
  const userIdsByEmployeeNumber = new Map<string, string[]>()
  const userIdsByName = new Map<string, string[]>()

  for (const access of accessRows) {
    userById.set(access.userId, {
      userId: access.userId,
      firstName: access.user.firstName,
      lastName: access.user.lastName,
    })

    const key = nameKey(access.user.firstName, access.user.lastName)
    const existing = userIdsByName.get(key) ?? []
    existing.push(access.userId)
    userIdsByName.set(key, existing)
  }

  for (const employee of employeeRows) {
    if (!employee.userId) continue
    const employeeNumberKey = normalizeText(employee.employeeNumber)
    if (!employeeNumberKey) continue

    const existing = userIdsByEmployeeNumber.get(employeeNumberKey) ?? []
    if (!existing.includes(employee.userId)) {
      existing.push(employee.userId)
      userIdsByEmployeeNumber.set(employeeNumberKey, existing)
    }
  }

  const resolve = (identity: Identity): { matched: ApproverUserLite | null; reason: string | null } => {
    const employeeNumberKey = normalizeText(identity.employeeNumber)

    if (employeeNumberKey) {
      const candidateIds = userIdsByEmployeeNumber.get(employeeNumberKey) ?? []
      if (candidateIds.length === 1) {
        const candidate = userById.get(candidateIds[0]) ?? null
        return { matched: candidate, reason: candidate ? null : "APPROVER_NOT_FOUND" }
      }
      if (candidateIds.length > 1) {
        return { matched: null, reason: "AMBIGUOUS_APPROVER_EMPLOYEE_NUMBER_MATCH" }
      }
    }

    const firstName = normalizeText(identity.firstName)
    const lastName = normalizeText(identity.lastName)
    if (firstName && lastName) {
      const candidateIds = userIdsByName.get(`${firstName}|${lastName}`) ?? []
      if (candidateIds.length === 1) {
        const candidate = userById.get(candidateIds[0]) ?? null
        return { matched: candidate, reason: candidate ? null : "APPROVER_NOT_FOUND" }
      }
      if (candidateIds.length > 1) {
        return { matched: null, reason: "AMBIGUOUS_APPROVER_NAME_MATCH" }
      }
    }

    return { matched: null, reason: "APPROVER_NOT_FOUND" }
  }

  return { resolve }
}

const buildDepartmentResolver = async (companyId: string) => {
  const departments = await db.department.findMany({
    where: {
      companyId,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  })

  const byId = new Map<string, DepartmentLite>()
  const byCode = new Map<string, DepartmentLite>()
  const byName = new Map<string, DepartmentLite[]>()

  for (const department of departments) {
    const lite: DepartmentLite = {
      id: department.id,
      code: department.code,
      name: department.name,
    }
    byId.set(lite.id, lite)

    const codeKey = normalizeText(department.code)
    if (codeKey) {
      byCode.set(codeKey, lite)
    }

    const nameKeyValue = normalizeText(department.name)
    const existing = byName.get(nameKeyValue) ?? []
    existing.push(lite)
    byName.set(nameKeyValue, existing)
  }

  const resolve = (params: { departmentCode: string; departmentName: string }): { matched: DepartmentLite | null; reason: string | null } => {
    const codeKey = normalizeText(params.departmentCode)
    if (codeKey) {
      const byCodeMatch = byCode.get(codeKey)
      if (byCodeMatch) {
        return { matched: byCodeMatch, reason: null }
      }
    }

    const nameKeyValue = normalizeText(params.departmentName)
    if (nameKeyValue) {
      const candidates = byName.get(nameKeyValue) ?? []
      if (candidates.length === 1) {
        return { matched: candidates[0], reason: null }
      }
      if (candidates.length > 1) {
        return { matched: null, reason: "AMBIGUOUS_DEPARTMENT_NAME_MATCH" }
      }
    }

    return { matched: null, reason: "DEPARTMENT_NOT_FOUND" }
  }

  const resolveById = (departmentId: string): { matched: DepartmentLite | null; reason: string | null } => {
    const trimmedId = departmentId.trim()
    if (!trimmedId) {
      return { matched: null, reason: "DEPARTMENT_NOT_FOUND" }
    }

    const matched = byId.get(trimmedId) ?? null
    return matched ? { matched, reason: null } : { matched: null, reason: "DEPARTMENT_NOT_FOUND" }
  }

  return { resolve, resolveById }
}

const extractLegacyRecordId = (row: LegacyRow): string => {
  return safeString(pickPath(row, ["id", "legacyId", "docNo", "requestNumber"])) || "UNKNOWN"
}

const extractLegacyRequestNumber = (row: LegacyRow): string => {
  const docNo = safeString(pickPath(row, ["docNo", "requestNumber"]))
  if (docNo) return docNo
  const recordId = extractLegacyRecordId(row)
  return `LEGACY-MR-${recordId}`
}

const getPendingApproverEmployeeNumber = (row: LegacyRow, pendingKey: StageKey | null): string => {
  if (!pendingKey) return ""

  if (pendingKey === "review") {
    return safeString(pickPath(row, ["reviewerEmployeeId"]))
  }
  if (pendingKey === "budget") {
    return safeString(pickPath(row, ["budgetApproverEmployeeId"]))
  }
  if (pendingKey === "recommending") {
    return safeString(pickPath(row, ["recApproverEmployeeId"]))
  }
  if (pendingKey === "final") {
    return safeString(pickPath(row, ["finalApproverEmployeeId"]))
  }
  return ""
}

const normalizeItems = (row: LegacyRow, legacyStatus: string): NormalizedItem[] => {
  const rawItems = pickPath(row, ["items"])
  if (!Array.isArray(rawItems)) {
    return []
  }

  const items: NormalizedItem[] = []

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") {
      continue
    }

    const item = rawItem as LegacyRow
    const description = safeString(pickPath(item, ["description"]))
    const uom = safeString(pickPath(item, ["uom"]))
    const quantityRaw = safeNumber(pickPath(item, ["quantity"]))

    if (!description || !uom || !quantityRaw || quantityRaw <= 0) {
      continue
    }

    const quantity = toQuantity(quantityRaw)
    const unitPriceRaw = safeNumber(pickPath(item, ["unitPrice"]))
    const unitPrice = unitPriceRaw === null ? null : toCurrency(unitPriceRaw)

    const lineTotalRaw = safeNumber(pickPath(item, ["lineTotal", "totalPrice"]))
    const lineTotal =
      lineTotalRaw !== null
        ? toCurrency(lineTotalRaw)
        : unitPrice !== null
          ? toCurrency(quantity * unitPrice)
          : null

    const quantityServedRaw = safeNumber(pickPath(item, ["quantityServed"])) ?? 0
    const quantityServed = toQuantity(
      LEGACY_FULLY_SERVED_STATUSES.has(legacyStatus) && quantityServedRaw <= 0
        ? quantity
        : Math.max(0, Math.min(quantity, quantityServedRaw))
    )

    items.push({
      lineNumber: items.length + 1,
      legacyItemId: asNullableText(pickPath(item, ["id"])),
      itemCode: asNullableText(pickPath(item, ["itemCode"])),
      description,
      uom,
      quantity,
      unitPrice,
      lineTotal,
      remarks: asNullableText(pickPath(item, ["remarks"])),
      quantityServed,
    })
  }

  return items
}

const buildStageCandidates = (params: {
  row: LegacyRow
  legacyStatus: string
  approverResolver: Awaited<ReturnType<typeof buildApproverResolver>>
  hasFinalStageSignal: boolean
  overrideRecommendingApproverEmployeeNumber?: string
  overrideFinalApproverEmployeeNumber?: string
}): {
  stages: StageCandidate[]
  pendingKey: StageKey | null
  recApprovalStatus: ApprovalStatusText | null
  finalApprovalStatus: ApprovalStatusText | null
  recApprovalDate: Date | null
  finalApprovalDate: Date | null
} => {
  const reviewStatus = normalizeApprovalStatus(pickPath(params.row, ["reviewStatus"]))
  const reviewedAt = toDate(pickPath(params.row, ["reviewedAt"]))
  const reviewRemarks = asNullableText(pickPath(params.row, ["reviewRemarks"]))

  const budgetApprovalStatus = normalizeApprovalStatus(pickPath(params.row, ["budgetApprovalStatus"]))
  const budgetApprovalDate = toDate(pickPath(params.row, ["budgetApprovalDate"]))
  const budgetRemarks = asNullableText(pickPath(params.row, ["budgetRemarks"]))
  const isWithinBudget = pickPath(params.row, ["isWithinBudget"]) === true

  const recApprovalStatus = normalizeApprovalStatus(pickPath(params.row, ["recApprovalStatus"]))
  const recApprovalDate = toDate(pickPath(params.row, ["recApprovalDate"]))
  const recApprovalRemarks = asNullableText(pickPath(params.row, ["recApprovalRemarks"]))

  const finalApprovalStatus = normalizeApprovalStatus(pickPath(params.row, ["finalApprovalStatus"]))
  const finalApprovalDate = toDate(pickPath(params.row, ["finalApprovalDate"]))
  const finalApprovalRemarks = asNullableText(pickPath(params.row, ["finalApprovalRemarks"]))

  const reviewerIdentity = extractIdentity(params.row, {
    employeeNumberPaths: ["reviewerEmployeeId"],
    firstNamePaths: ["reviewerFirstName"],
    lastNamePaths: ["reviewerLastName"],
    namePaths: ["reviewerName"],
  })

  const budgetApproverIdentity = extractIdentity(params.row, {
    employeeNumberPaths: ["budgetApproverEmployeeId"],
    firstNamePaths: ["budgetApproverFirstName"],
    lastNamePaths: ["budgetApproverLastName"],
    namePaths: ["budgetApproverName"],
  })

  const recApproverIdentity = extractIdentity(params.row, {
    employeeNumberPaths: ["recApproverEmployeeId"],
    firstNamePaths: ["recApproverFirstName"],
    lastNamePaths: ["recApproverLastName"],
    namePaths: ["recApproverName"],
  })
  if (hasOverrideValue(params.overrideRecommendingApproverEmployeeNumber)) {
    recApproverIdentity.employeeNumber = params.overrideRecommendingApproverEmployeeNumber?.trim() ?? ""
  }

  const finalApproverIdentity = extractIdentity(params.row, {
    employeeNumberPaths: ["finalApproverEmployeeId"],
    firstNamePaths: ["finalApproverFirstName"],
    lastNamePaths: ["finalApproverLastName"],
    namePaths: ["finalApproverName"],
  })
  if (hasOverrideValue(params.overrideFinalApproverEmployeeNumber)) {
    finalApproverIdentity.employeeNumber = params.overrideFinalApproverEmployeeNumber?.trim() ?? ""
  }

  const reviewer = hasIdentity(reviewerIdentity) ? params.approverResolver.resolve(reviewerIdentity).matched : null
  const budgetApprover = hasIdentity(budgetApproverIdentity)
    ? params.approverResolver.resolve(budgetApproverIdentity).matched
    : null
  const recApprover = hasIdentity(recApproverIdentity) ? params.approverResolver.resolve(recApproverIdentity).matched : null
  const finalApprover = hasIdentity(finalApproverIdentity)
    ? params.approverResolver.resolve(finalApproverIdentity).matched
    : null

  const includeReview = params.legacyStatus === "FOR_REVIEW" || reviewStatus !== null || reviewedAt !== null || hasIdentity(reviewerIdentity)
  const includeBudget =
    params.legacyStatus === "PENDING_BUDGET_APPROVAL" ||
    budgetApprovalStatus !== null ||
    budgetApprovalDate !== null ||
    hasIdentity(budgetApproverIdentity)
  const includeRec =
    recApprovalStatus !== null ||
    recApprovalDate !== null ||
    hasIdentity(recApproverIdentity) ||
    ["FOR_REC_APPROVAL", "REC_APPROVED", "FOR_FINAL_APPROVAL", "DISAPPROVED"].includes(params.legacyStatus)
  const includeFinal =
    finalApprovalStatus !== null ||
    finalApprovalDate !== null ||
    hasIdentity(finalApproverIdentity) ||
    ["FOR_FINAL_APPROVAL", "FINAL_APPROVED", "FOR_SERVING", "SERVED", "FOR_POSTING", "POSTED", "RECEIVED", "ACKNOWLEDGED", "DEPLOYED", "TRANSMITTED"].includes(
      params.legacyStatus
    ) ||
    params.hasFinalStageSignal

  const budgetOutcomePrefix =
    budgetApprovalStatus === "DISAPPROVED"
      ? isWithinBudget
        ? "Legacy budget result: WITHIN_BUDGET"
        : "Legacy budget result: NOT_WITHIN_BUDGET"
      : null

  const stages: StageCandidate[] = [
    {
      key: "review",
      name: stageNameMap.review,
      include: includeReview,
      approverUserId: reviewer?.userId ?? null,
      pending: params.legacyStatus === "FOR_REVIEW",
      explicitStatus: reviewStatus,
      actedAt: reviewedAt,
      remarks: reviewRemarks,
    },
    {
      key: "budget",
      name: stageNameMap.budget,
      include: includeBudget,
      approverUserId: budgetApprover?.userId ?? null,
      pending: params.legacyStatus === "PENDING_BUDGET_APPROVAL",
      explicitStatus: budgetApprovalStatus === null ? null : "APPROVED",
      actedAt: budgetApprovalDate,
      remarks:
        budgetOutcomePrefix && budgetRemarks
          ? `${budgetOutcomePrefix}. ${budgetRemarks}`
          : budgetOutcomePrefix ?? budgetRemarks,
    },
    {
      key: "recommending",
      name: stageNameMap.recommending,
      include: includeRec,
      approverUserId: recApprover?.userId ?? null,
      pending: params.legacyStatus === "FOR_REC_APPROVAL",
      explicitStatus: recApprovalStatus,
      actedAt: recApprovalDate,
      remarks: recApprovalRemarks,
    },
    {
      key: "final",
      name: stageNameMap.final,
      include: includeFinal,
      approverUserId: finalApprover?.userId ?? null,
      pending: params.legacyStatus === "FOR_FINAL_APPROVAL" || (params.legacyStatus === "REC_APPROVED" && includeFinal),
      explicitStatus: finalApprovalStatus,
      actedAt: finalApprovalDate,
      remarks: finalApprovalRemarks,
    },
  ]

  return {
    stages,
    pendingKey: pendingStageKeyFromStatus(params.legacyStatus, includeFinal),
    recApprovalStatus,
    finalApprovalStatus,
    recApprovalDate,
    finalApprovalDate,
  }
}

const uniqueRequestNumber = async (companyId: string, preferredRequestNumber: string): Promise<string> => {
  const base = preferredRequestNumber.trim() || "LEGACY-MR"

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${String(suffix).padStart(2, "0")}`
    const existing = await db.materialRequest.findFirst({
      where: {
        companyId,
        requestNumber: candidate,
      },
      select: {
        id: true,
      },
    })

    if (!existing) {
      return candidate
    }
  }

  throw new Error(`Unable to generate unique request number for ${preferredRequestNumber}`)
}

export async function executeLegacyMaterialRequestSync(
  input: ExecuteLegacyMaterialRequestSyncInput
): Promise<LegacyMaterialRequestSyncExecutionResult> {
  const [requesterResolver, approverResolver, departmentResolver] = await Promise.all([
    buildRequesterResolver(input.companyId),
    buildApproverResolver(input.companyId),
    buildDepartmentResolver(input.companyId),
  ])

  const fetchedRows = await fetchRows({
    baseUrl: input.baseUrl,
    endpoint: input.materialRequestEndpoint,
    companyId: input.companyId,
    legacyScopeId: input.legacyScopeId,
    apiToken: input.apiToken,
    timeoutMs: input.timeoutMs,
  })
  const targetLegacyRecordIdSet =
    input.targetLegacyRecordIds && input.targetLegacyRecordIds.length > 0
      ? new Set(input.targetLegacyRecordIds.map((value) => value.trim()).filter(Boolean))
      : null
  const rows =
    targetLegacyRecordIdSet === null
      ? fetchedRows
      : fetchedRows.filter((row) => targetLegacyRecordIdSet.has(extractLegacyRecordId(row)))

  const legacyIds = rows.map((row) => extractLegacyRecordId(row)).filter((id) => id && id !== "UNKNOWN")
  const existingLegacyRows =
    legacyIds.length > 0
      ? await db.materialRequest.findMany({
          where: {
            companyId: input.companyId,
            legacySourceSystem: LEGACY_SOURCE_SYSTEM,
            legacyRecordId: {
              in: legacyIds,
            },
          },
          select: {
            legacyRecordId: true,
          },
        })
      : []

  const existingLegacyRecordIdSet = new Set(existingLegacyRows.map((row) => row.legacyRecordId ?? ""))
  const manualOverrideByLegacyRecordId = new Map(
    input.manualOverrides.map((override) => [override.legacyRecordId.trim(), override])
  )

  const unmatched: LegacySyncUnmatchedRow[] = []
  const skipped: LegacySyncSkippedRow[] = []
  const errors: LegacySyncErrorRow[] = []

  const summary: LegacySyncSummary = {
    fetched: {
      materialRequests: rows.length,
      items: 0,
    },
    processed: {
      materialRequests: 0,
      items: 0,
      approvalSteps: 0,
      serveBatches: 0,
      postings: 0,
    },
    unmatchedCount: 0,
    skippedCount: 0,
    errorCount: 0,
  }

  for (const row of rows) {
    const legacyRecordId = extractLegacyRecordId(row)
    const requestNumber = extractLegacyRequestNumber(row)
    const override = manualOverrideByLegacyRecordId.get(legacyRecordId)

    try {
      if (!legacyRecordId || legacyRecordId === "UNKNOWN") {
        skipped.push({
          domain: "material-request",
          reason: "MISSING_LEGACY_RECORD_ID",
          legacyRecordId,
          requestNumber,
        })
        continue
      }

      if (existingLegacyRecordIdSet.has(legacyRecordId)) {
        skipped.push({
          domain: "material-request",
          reason: "ALREADY_SYNCED",
          legacyRecordId,
          requestNumber,
        })
        continue
      }

      const legacyStatus = normalizeLegacyStatus(pickPath(row, ["status"]))
      if (!legacyStatus) {
        skipped.push({
          domain: "material-request",
          reason: "MISSING_STATUS",
          legacyRecordId,
          requestNumber,
        })
        continue
      }

      const pendingKeyHint = pendingStageKeyFromStatus(legacyStatus, true)
      const pendingStepNameHint = pendingKeyHint ? stageNameMap[pendingKeyHint] : null
      const recommendingApproverEmployeeNumberHint = hasOverrideValue(override?.recommendingApproverEmployeeNumber)
        ? override?.recommendingApproverEmployeeNumber?.trim() ?? ""
        : safeString(pickPath(row, ["recApproverEmployeeId"]))
      const recommendingApproverNameHint = safeString(pickPath(row, ["recApproverName"]))
      const recommendingApprovalStatusHint = safeString(pickPath(row, ["recApprovalStatus"]))
      const finalApproverEmployeeNumberHint = hasOverrideValue(override?.finalApproverEmployeeNumber)
        ? override?.finalApproverEmployeeNumber?.trim() ?? ""
        : safeString(pickPath(row, ["finalApproverEmployeeId"]))
      const finalApproverNameHint = safeString(pickPath(row, ["finalApproverName"]))
      const finalApprovalStatusHint = safeString(pickPath(row, ["finalApprovalStatus"]))
      const pendingApproverEmployeeNumberHint = hasOverrideValue(override?.pendingApproverEmployeeNumber)
        ? override?.pendingApproverEmployeeNumber?.trim() ?? ""
        : pendingKeyHint === "recommending"
          ? recommendingApproverEmployeeNumberHint
          : pendingKeyHint === "final"
            ? finalApproverEmployeeNumberHint
            : getPendingApproverEmployeeNumber(row, pendingKeyHint)
      const legacyDepartmentCode = safeString(pickPath(row, ["department.code", "departmentCode"]))
      const legacyDepartmentName = safeString(pickPath(row, ["department.name", "departmentName", "chargeTo"]))
      const overrideDepartmentId = hasOverrideValue(override?.departmentId) ? override?.departmentId?.trim() ?? "" : ""
      const overrideDepartmentResolved = overrideDepartmentId
        ? departmentResolver.resolveById(overrideDepartmentId).matched
        : null
      const departmentCodeHint = hasOverrideValue(override?.departmentCode)
        ? override?.departmentCode?.trim() ?? ""
        : overrideDepartmentResolved?.code ?? legacyDepartmentCode
      const departmentNameHint = hasOverrideValue(override?.departmentName)
        ? override?.departmentName?.trim() ?? ""
        : overrideDepartmentResolved?.name ?? legacyDepartmentName
      const stageBuild = buildStageCandidates({
        row,
        legacyStatus,
        approverResolver,
        hasFinalStageSignal: false,
        overrideRecommendingApproverEmployeeNumber: recommendingApproverEmployeeNumberHint,
        overrideFinalApproverEmployeeNumber: finalApproverEmployeeNumberHint,
      })
      const mappedStatus = mapRequestStatus({
        legacyStatus,
        hasFinalStageSignal: stageBuild.stages.some((stage) => stage.key === "final" && stage.include),
        finalApprovalStatus: stageBuild.finalApprovalStatus,
      })
      const mappedStatusLabel = mapLegacyToUnmatchedDisplayStatus({
        legacyStatus,
        mappedStatus,
      })

      const requesterIdentity = extractIdentity(row, {
        // Requester matching must be legacy requester employee-id/number only.
        employeeNumberPaths: ["requestedByEmployeeId", "requestedBy.employeeId", "requestedBy.employeeNumber"],
        firstNamePaths: ["requestedByFirstName", "requestedBy.firstName"],
        lastNamePaths: ["requestedByLastName", "requestedBy.lastName"],
        namePaths: ["requestedByName", "requestedBy.name"],
      })
      if (hasOverrideValue(override?.requesterEmployeeNumber)) {
        requesterIdentity.employeeNumber = override?.requesterEmployeeNumber?.trim() ?? ""
      }
      if (hasOverrideValue(override?.requesterName)) {
        const parsedRequesterName = splitName(override?.requesterName)
        requesterIdentity.firstName = parsedRequesterName.firstName
        requesterIdentity.lastName = parsedRequesterName.lastName
      }

      const requesterName = `${requesterIdentity.firstName} ${requesterIdentity.lastName}`.trim()
      const requesterMatch = requesterResolver.resolve(requesterIdentity)
      if (!requesterMatch.matched) {
        unmatched.push({
          domain: "material-request",
          reason: requesterMatch.reason ?? "REQUESTER_NOT_FOUND",
          legacyRecordId,
          requestNumber,
          legacyStatus,
          mappedStatus: mappedStatusLabel,
          pendingStepName: pendingStepNameHint,
          pendingApproverEmployeeNumber: pendingApproverEmployeeNumberHint,
          recommendingApproverEmployeeNumber: recommendingApproverEmployeeNumberHint,
          recommendingApproverName: recommendingApproverNameHint,
          recommendingApprovalStatus: recommendingApprovalStatusHint,
          finalApproverEmployeeNumber: finalApproverEmployeeNumberHint,
          finalApproverName: finalApproverNameHint,
          finalApprovalStatus: finalApprovalStatusHint,
          legacyDepartmentCode,
          legacyDepartmentName,
          departmentCode: departmentCodeHint,
          departmentName: departmentNameHint,
          employeeNumber: requesterIdentity.employeeNumber,
          requesterName,
        })
        continue
      }

      const requester = requesterMatch.matched
      if (!requester.userId) {
        unmatched.push({
          domain: "material-request",
          reason: "REQUESTER_HAS_NO_LINKED_USER",
          legacyRecordId,
          requestNumber,
          legacyStatus,
          mappedStatus: mappedStatusLabel,
          pendingStepName: pendingStepNameHint,
          pendingApproverEmployeeNumber: pendingApproverEmployeeNumberHint,
          recommendingApproverEmployeeNumber: recommendingApproverEmployeeNumberHint,
          recommendingApproverName: recommendingApproverNameHint,
          recommendingApprovalStatus: recommendingApprovalStatusHint,
          finalApproverEmployeeNumber: finalApproverEmployeeNumberHint,
          finalApproverName: finalApproverNameHint,
          finalApprovalStatus: finalApprovalStatusHint,
          legacyDepartmentCode,
          legacyDepartmentName,
          departmentCode: departmentCodeHint,
          departmentName: departmentNameHint,
          employeeNumber: requester.employeeNumber,
          requesterName: `${requester.firstName} ${requester.lastName}`,
        })
        continue
      }
      const requesterUserId: string = requester.userId

      const departmentCode = departmentCodeHint
      const departmentName = departmentNameHint
      const resolvedDepartment = overrideDepartmentId
        ? departmentResolver.resolveById(overrideDepartmentId)
        : departmentResolver.resolve({ departmentCode, departmentName })

      const departmentId = resolvedDepartment.matched?.id ?? requester.departmentId
      if (!departmentId) {
        unmatched.push({
          domain: "material-request",
          reason: resolvedDepartment.reason ?? "DEPARTMENT_NOT_FOUND",
          legacyRecordId,
          requestNumber,
          legacyStatus,
          mappedStatus: mappedStatusLabel,
          pendingStepName: pendingStepNameHint,
          pendingApproverEmployeeNumber: pendingApproverEmployeeNumberHint,
          recommendingApproverEmployeeNumber: recommendingApproverEmployeeNumberHint,
          recommendingApproverName: recommendingApproverNameHint,
          recommendingApprovalStatus: recommendingApprovalStatusHint,
          finalApproverEmployeeNumber: finalApproverEmployeeNumberHint,
          finalApproverName: finalApproverNameHint,
          finalApprovalStatus: finalApprovalStatusHint,
          legacyDepartmentCode,
          legacyDepartmentName,
          departmentCode,
          departmentName,
          employeeNumber: requester.employeeNumber,
          requesterName: `${requester.firstName} ${requester.lastName}`,
        })
        continue
      }

      const datePreparedSource = toDate(pickPath(row, ["datePrepared", "createdAt"]))
      const dateRequiredSource = toDate(pickPath(row, ["dateRequired", "datePrepared", "createdAt"]))
      if (!datePreparedSource || !dateRequiredSource) {
        skipped.push({
          domain: "material-request",
          reason: "INVALID_DATE_PREPARED_OR_REQUIRED",
          legacyRecordId,
          requestNumber,
          status: legacyStatus,
        })
        continue
      }

      const datePrepared = toUtcDateOnly(datePreparedSource)
      const dateRequired = toUtcDateOnly(dateRequiredSource)

      const normalizedItems = normalizeItems(row, legacyStatus)
      summary.fetched.items += normalizedItems.length

      if (normalizedItems.length === 0) {
        skipped.push({
          domain: "material-request",
          reason: "NO_VALID_ITEMS",
          legacyRecordId,
          requestNumber,
          status: legacyStatus,
        })
        continue
      }

      if (!mappedStatus) {
        skipped.push({
          domain: "material-request",
          reason: "UNSUPPORTED_STATUS",
          legacyRecordId,
          requestNumber,
          status: legacyStatus,
        })
        continue
      }

      const pendingKey = stageBuild.pendingKey
      if (pendingKey && hasOverrideValue(override?.pendingApproverEmployeeNumber)) {
        const pendingStage = stageBuild.stages.find((stage) => stage.key === pendingKey)
        if (pendingStage && !pendingStage.approverUserId) {
          const pendingApproverMatch = approverResolver.resolve({
            employeeNumber: override?.pendingApproverEmployeeNumber?.trim() ?? "",
            firstName: "",
            lastName: "",
          })
          pendingStage.approverUserId = pendingApproverMatch.matched?.userId ?? null
        }
      }

      const pendingStepName = pendingKey ? stageNameMap[pendingKey] : pendingStepNameHint
      const pendingApproverEmployeeNumber = hasOverrideValue(override?.pendingApproverEmployeeNumber)
        ? override?.pendingApproverEmployeeNumber?.trim() ?? ""
        : pendingKey === "recommending"
          ? recommendingApproverEmployeeNumberHint
          : pendingKey === "final"
            ? finalApproverEmployeeNumberHint
            : getPendingApproverEmployeeNumber(row, pendingKey)
      const stagesWithApprovers: Array<StageCandidate & { approverUserId: string }> = []

      for (const stage of stageBuild.stages) {
        if (!stage.include) {
          continue
        }

        if (!stage.approverUserId) {
          skipped.push({
            domain: "material-request",
            reason: `DROPPED_STAGE_WITHOUT_APPROVER_${stage.key.toUpperCase()}`,
            legacyRecordId,
            requestNumber,
            status: legacyStatus,
          })
          continue
        }

        stagesWithApprovers.push({
          ...stage,
          approverUserId: stage.approverUserId,
        })
      }

      if (mappedStatus === MaterialRequestStatus.PENDING_APPROVAL) {
        if (!pendingKey) {
          skipped.push({
            domain: "material-request",
            reason: "PENDING_STATUS_WITHOUT_PENDING_STAGE",
            legacyRecordId,
            requestNumber,
            status: legacyStatus,
          })
          continue
        }

        const hasPendingStage = stagesWithApprovers.some((stage) => stage.key === pendingKey)
        if (!hasPendingStage) {
          unmatched.push({
            domain: "material-request",
            reason: `PENDING_STAGE_NOT_RESOLVED_${pendingKey.toUpperCase()}`,
            legacyRecordId,
            requestNumber,
            legacyStatus,
            mappedStatus: mappedStatusLabel,
            pendingStepName,
            pendingApproverEmployeeNumber,
            recommendingApproverEmployeeNumber: recommendingApproverEmployeeNumberHint,
            recommendingApproverName: recommendingApproverNameHint,
            recommendingApprovalStatus: recommendingApprovalStatusHint,
            finalApproverEmployeeNumber: finalApproverEmployeeNumberHint,
            finalApproverName: finalApproverNameHint,
            finalApprovalStatus: finalApprovalStatusHint,
            legacyDepartmentCode,
            legacyDepartmentName,
            departmentCode,
            departmentName,
            employeeNumber: requester.employeeNumber,
            requesterName: `${requester.firstName} ${requester.lastName}`,
          })
          continue
        }
      }

      const approvalSteps: MaterialRequestApprovalStepCreate[] = []
      const pendingIndex =
        mappedStatus === MaterialRequestStatus.PENDING_APPROVAL && pendingKey
          ? stagesWithApprovers.findIndex((stage) => stage.key === pendingKey)
          : -1

      const explicitRejectedIndex = stagesWithApprovers.findIndex((stage) => stage.explicitStatus === "DISAPPROVED")
      const rejectedIndex =
        mappedStatus === MaterialRequestStatus.REJECTED
          ? explicitRejectedIndex >= 0
            ? explicitRejectedIndex
            : stagesWithApprovers.length - 1
          : -1

      for (let index = 0; index < stagesWithApprovers.length; index += 1) {
        const stage = stagesWithApprovers[index]

        let stepStatus: MaterialRequestStepStatus
        if (mappedStatus === MaterialRequestStatus.PENDING_APPROVAL) {
          stepStatus = pendingIndex >= 0 && index < pendingIndex ? MaterialRequestStepStatus.APPROVED : MaterialRequestStepStatus.PENDING
        } else if (mappedStatus === MaterialRequestStatus.APPROVED) {
          stepStatus = MaterialRequestStepStatus.APPROVED
        } else if (mappedStatus === MaterialRequestStatus.REJECTED) {
          if (rejectedIndex >= 0 && index < rejectedIndex) {
            stepStatus = MaterialRequestStepStatus.APPROVED
          } else if (index === rejectedIndex) {
            stepStatus = MaterialRequestStepStatus.REJECTED
          } else {
            stepStatus = MaterialRequestStepStatus.SKIPPED
          }
        } else {
          if (stage.explicitStatus === "APPROVED") {
            stepStatus = MaterialRequestStepStatus.APPROVED
          } else if (stage.explicitStatus === "DISAPPROVED") {
            stepStatus = MaterialRequestStepStatus.REJECTED
          } else {
            stepStatus = MaterialRequestStepStatus.SKIPPED
          }
        }

        approvalSteps.push({
          stepNumber: index + 1,
          stepName: stage.name,
          approverUserId: stage.approverUserId,
          status: stepStatus,
          actedAt: stepStatus === MaterialRequestStepStatus.PENDING ? null : stage.actedAt,
          actedByUserId: stepStatus === MaterialRequestStepStatus.PENDING || stepStatus === MaterialRequestStepStatus.SKIPPED ? null : stage.approverUserId,
          remarks:
            stepStatus === MaterialRequestStepStatus.SKIPPED
              ? "Skipped after rejection"
              : stage.remarks,
        })
      }

      const requiredSteps = approvalSteps.length
      const currentStep =
        mappedStatus === MaterialRequestStatus.PENDING_APPROVAL && pendingIndex >= 0
          ? pendingIndex + 1
          : mappedStatus === MaterialRequestStatus.REJECTED && rejectedIndex >= 0
            ? rejectedIndex + 1
            : mappedStatus === MaterialRequestStatus.APPROVED && requiredSteps > 0
              ? requiredSteps
              : null

      if (mappedStatus === MaterialRequestStatus.PENDING_APPROVAL && currentStep === null) {
        skipped.push({
          domain: "material-request",
          reason: "PENDING_STATUS_WITHOUT_CURRENT_STEP",
          legacyRecordId,
          requestNumber,
          status: legacyStatus,
        })
        continue
      }

      const submittedAt = toDate(pickPath(row, ["createdAt"])) ?? datePreparedSource
      const approvedAt =
        mappedStatus === MaterialRequestStatus.APPROVED
          ? toDate(pickPath(row, ["dateApproved"])) ?? stageBuild.finalApprovalDate ?? stageBuild.recApprovalDate ?? null
          : null
      const rejectedAt =
        mappedStatus === MaterialRequestStatus.REJECTED
          ? stageBuild.finalApprovalDate ?? stageBuild.recApprovalDate ?? toDate(pickPath(row, ["updatedAt"]))
          : null
      const cancelledAt =
        mappedStatus === MaterialRequestStatus.CANCELLED ? toDate(pickPath(row, ["updatedAt"])) : null

      const rejectionStep = rejectedIndex >= 0 ? approvalSteps[rejectedIndex] : null
      const finalDecisionByUserId =
        mappedStatus === MaterialRequestStatus.REJECTED
          ? rejectionStep?.approverUserId ?? null
          : mappedStatus === MaterialRequestStatus.APPROVED
            ? approvalSteps.at(-1)?.approverUserId ?? null
            : null
      const finalDecisionRemarks =
        mappedStatus === MaterialRequestStatus.REJECTED
          ? rejectionStep?.remarks ?? null
          : mappedStatus === MaterialRequestStatus.APPROVED
            ? approvalSteps.at(-1)?.remarks ?? null
            : null

      const freight = toCurrency(safeNumber(pickPath(row, ["freight"])) ?? 0)
      const discount = toCurrency(safeNumber(pickPath(row, ["discount"])) ?? 0)
      const computedSubTotal = toCurrency(
        normalizedItems.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0)
      )
      const providedTotal = safeNumber(pickPath(row, ["total"]))
      const grandTotal =
        providedTotal === null
          ? toCurrency(computedSubTotal + freight - discount)
          : toCurrency(providedTotal)

      const hasAnyServedQuantity = normalizedItems.some((item) => item.quantityServed > QUANTITY_TOLERANCE)
      const isFullyServed = normalizedItems.every((item) => {
        return item.quantity - item.quantityServed <= QUANTITY_TOLERANCE
      })

      const processingStatus =
        mappedStatus !== MaterialRequestStatus.APPROVED
          ? null
          : isFullyServed || LEGACY_FULLY_SERVED_STATUSES.has(legacyStatus)
            ? MaterialRequestProcessingStatus.COMPLETED
            : hasAnyServedQuantity
              ? MaterialRequestProcessingStatus.IN_PROGRESS
              : MaterialRequestProcessingStatus.PENDING_PURCHASER

      const processingStartedAt =
        processingStatus === MaterialRequestProcessingStatus.IN_PROGRESS ||
        processingStatus === MaterialRequestProcessingStatus.COMPLETED
          ? toDate(pickPath(row, ["servedAt", "processedAt", "updatedAt"]))
          : null

      const processingCompletedAt =
        processingStatus === MaterialRequestProcessingStatus.COMPLETED
          ? toDate(pickPath(row, ["servedAt", "processedAt", "datePosted", "updatedAt"]))
          : null

      const servedByIdentity = extractIdentity(row, {
        employeeNumberPaths: ["servedByEmployeeId"],
        namePaths: ["servedByName"],
      })
      const processedByIdentity = extractIdentity(row, {
        employeeNumberPaths: ["processedByEmployeeId"],
        namePaths: ["processedByName"],
      })

      const servedByUser = hasIdentity(servedByIdentity) ? approverResolver.resolve(servedByIdentity).matched : null
      const processedByUser = hasIdentity(processedByIdentity)
        ? approverResolver.resolve(processedByIdentity).matched
        : null

      const shouldCreateServeBatch = hasAnyServedQuantity || LEGACY_FULLY_SERVED_STATUSES.has(legacyStatus)
      const serveBatchServedByUserId = servedByUser?.userId ?? processedByUser?.userId ?? input.actorUserId
      const serveBatchServedAt = toDate(pickPath(row, ["servedAt", "processedAt", "updatedAt"])) ?? submittedAt

      const postingStatus =
        mappedStatus !== MaterialRequestStatus.APPROVED
          ? null
          : LEGACY_POSTED_STATUSES.has(legacyStatus)
            ? MaterialRequestPostingStatus.POSTED
            : processingStatus === MaterialRequestProcessingStatus.COMPLETED || legacyStatus === "FOR_POSTING"
              ? MaterialRequestPostingStatus.PENDING_POSTING
              : null

      const postedAt =
        postingStatus === MaterialRequestPostingStatus.POSTED
          ? toDate(pickPath(row, ["datePosted", "processedAt", "updatedAt"]))
          : null
      const postedByUserId = postingStatus === MaterialRequestPostingStatus.POSTED
        ? processedByUser?.userId ?? input.actorUserId
        : null

      const preferredRequestNumber = requestNumber

      if (!input.dryRun) {
        const requestNumberForCreate = await uniqueRequestNumber(input.companyId, preferredRequestNumber)

        await db.$transaction(async (tx) => {
          const created = await tx.materialRequest.create({
            data: {
              companyId: input.companyId,
              requestNumber: requestNumberForCreate,
              series: mapSeries(pickPath(row, ["series"])),
              requestType: mapRequestType(pickPath(row, ["requestType", "type"])),
              status: mappedStatus,
              requesterEmployeeId: requester.id,
              requesterUserId,
              selectedInitialApproverUserId: approvalSteps[0]?.approverUserId ?? null,
              selectedStepTwoApproverUserId: approvalSteps[1]?.approverUserId ?? null,
              selectedStepThreeApproverUserId: approvalSteps[2]?.approverUserId ?? null,
              selectedStepFourApproverUserId: approvalSteps[3]?.approverUserId ?? null,
              departmentId,
              datePrepared,
              dateRequired,
              chargeTo: asNullableText(pickPath(row, ["chargeTo"])),
              bldgCode: asNullableText(pickPath(row, ["bldgCode"])),
              purpose: asNullableText(pickPath(row, ["purpose"])),
              remarks: asNullableText(pickPath(row, ["remarks"])),
              deliverTo: asNullableText(pickPath(row, ["deliverTo"])),
              isStoreUse: pickPath(row, ["isStoreUse"]) === true,
              freight,
              discount,
              subTotal: computedSubTotal,
              grandTotal,
              requiredSteps,
              currentStep,
              submittedAt,
              approvedAt,
              rejectedAt,
              cancelledAt,
              processingStatus,
              processingStartedAt,
              processingCompletedAt,
              processingRemarks: asNullableText(pickPath(row, ["servedNotes"])),
              processedByUserId: processedByUser?.userId ?? servedByUser?.userId ?? null,
              postingStatus,
              postingReference: asNullableText(pickPath(row, ["confirmationNo", "purchaseOrderNumber"])),
              postingRemarks: asNullableText(pickPath(row, ["remarks"])),
              postedAt,
              postedByUserId,
              finalDecisionByUserId,
              finalDecisionRemarks,
              cancellationReason:
                mappedStatus === MaterialRequestStatus.CANCELLED
                  ? asNullableText(pickPath(row, ["remarks"])) ?? "Cancelled in legacy system"
                  : null,
              legacySourceSystem: LEGACY_SOURCE_SYSTEM,
              legacyRecordId,
              legacyBusinessUnitId: asNullableText(pickPath(row, ["businessUnitId"])),
              steps: {
                create: approvalSteps.map((step) => ({
                  stepNumber: step.stepNumber,
                  stepName: step.stepName,
                  approverUserId: step.approverUserId,
                  status: step.status,
                  actedAt: step.actedAt,
                  actedByUserId: step.actedByUserId,
                  remarks: step.remarks,
                })),
              },
              items: {
                create: normalizedItems.map((item) => ({
                  lineNumber: item.lineNumber,
                  source: MaterialRequestItemSource.MANUAL,
                  itemCode: item.itemCode,
                  description: item.description,
                  uom: item.uom,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                  remarks: item.remarks,
                  legacyItemId: item.legacyItemId,
                })),
              },
            },
            select: {
              id: true,
            },
          })

          if (shouldCreateServeBatch) {
            const createdItems = await tx.materialRequestItem.findMany({
              where: {
                materialRequestId: created.id,
              },
              select: {
                id: true,
                lineNumber: true,
              },
            })

            const itemIdByLineNumber = new Map<number, string>(createdItems.map((item) => [item.lineNumber, item.id]))
            const serveBatchItems = normalizedItems
              .filter((item) => item.quantityServed > QUANTITY_TOLERANCE)
              .map((item) => ({
                materialRequestItemId: itemIdByLineNumber.get(item.lineNumber) ?? "",
                quantityServed: item.quantityServed,
              }))
              .filter((item) => item.materialRequestItemId.length > 0)

            if (serveBatchItems.length > 0) {
              await tx.materialRequestServeBatch.create({
                data: {
                  materialRequestId: created.id,
                  poNumber:
                    asNullableText(pickPath(row, ["purchaseOrderNumber"])) ??
                    `LEGACY-PO-${preferredRequestNumber}`,
                  supplierName:
                    asNullableText(pickPath(row, ["supplierName"])) ?? "Legacy Supplier",
                  notes: asNullableText(pickPath(row, ["servedNotes"])),
                  isFinalServe: isFullyServed,
                  servedAt: serveBatchServedAt,
                  servedByUserId: serveBatchServedByUserId,
                  items: {
                    create: serveBatchItems,
                  },
                },
              })
            }
          }

          if (postingStatus === MaterialRequestPostingStatus.POSTED) {
            const postingReference =
              asNullableText(pickPath(row, ["confirmationNo", "purchaseOrderNumber"])) ??
              `LEGACY-POST-${preferredRequestNumber}`

            await tx.materialRequestPosting.create({
              data: {
                materialRequestId: created.id,
                postingReference,
                remarks: asNullableText(pickPath(row, ["remarks"])),
                postedAt: postedAt ?? submittedAt,
                postedByUserId: postedByUserId ?? input.actorUserId,
              },
            })
          }
        })
      }

      summary.processed.materialRequests += 1
      summary.processed.items += normalizedItems.length
      summary.processed.approvalSteps += approvalSteps.length
      if (shouldCreateServeBatch && normalizedItems.some((item) => item.quantityServed > QUANTITY_TOLERANCE)) {
        summary.processed.serveBatches += 1
      }
      if (postingStatus === MaterialRequestPostingStatus.POSTED) {
        summary.processed.postings += 1
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push({
        domain: "material-request",
        message: `Legacy record ${legacyRecordId} (${requestNumber}): ${message}`,
      })
    }
  }

  summary.unmatchedCount = unmatched.length
  summary.skippedCount = skipped.length
  summary.errorCount = errors.length

  return {
    summary,
    unmatched,
    skipped,
    errors,
  }
}
