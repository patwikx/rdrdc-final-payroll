import { PlatformRole, type CompanyRole } from "@prisma/client"

import { db } from "@/lib/db"

type LegacyEmployeeRow = {
  id?: string
  employeeId?: string
  name?: string
  email?: string | null
  passwordHash?: string
  profilePicture?: string | null
  role?: string
  classification?: string | null
  isActive?: boolean
  hireDate?: string | Date | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  departmentName?: string | null
}

export type LegacyEmployeeSyncIssue = {
  employeeId: string
  name: string
  reason: string
}

export type LegacyEmployeeSyncSummary = {
  fetched: number
  processed: number
  skippedAlreadyMatched: number
  createdUsers: number
  createdEmployees: number
  linkedExisting: number
  conflicts: number
  invalidRows: number
  errors: number
}

export type ExecuteLegacyEmployeeSyncInput = {
  companyId: string
  baseUrl: string
  legacyScopeId?: string
  apiToken?: string
  employeeEndpoint: string
  timeoutMs: number
  dryRun: boolean
}

export type ExecuteLegacyEmployeeSyncResult = {
  summary: LegacyEmployeeSyncSummary
  conflicts: LegacyEmployeeSyncIssue[]
  invalidRows: LegacyEmployeeSyncIssue[]
  errors: Array<{ employeeId: string; message: string }>
}

type CompanyAccessRole = {
  companyRole: CompanyRole
  isRequestApprover: boolean
  isAdmin: boolean
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

const isValidEmail = (value: string): boolean => {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

const splitName = (fullName: string): { firstName: string; lastName: string } => {
  const normalized = fullName.trim().replace(/\s+/g, " ")
  if (!normalized) {
    return { firstName: "Legacy", lastName: "User" }
  }

  if (normalized.includes(",")) {
    const [lastPart, firstPart] = normalized.split(",").map((value) => value.trim())
    return {
      firstName: firstPart || "Legacy",
      lastName: lastPart || "User",
    }
  }

  const parts = normalized.split(" ").filter(Boolean)
  if (parts.length === 1) {
    return {
      firstName: parts[0] || "Legacy",
      lastName: "User",
    }
  }

  return {
    firstName: parts[0] || "Legacy",
    lastName: parts[parts.length - 1] || "User",
  }
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null
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

const mapLegacyRoleToCompanyAccess = (legacyRoleRaw: string): CompanyAccessRole => {
  const role = normalizeText(legacyRoleRaw).toUpperCase()

  if (role === "ADMIN") {
    return { companyRole: "COMPANY_ADMIN", isRequestApprover: true, isAdmin: true }
  }
  if (role === "HR") {
    return { companyRole: "HR_ADMIN", isRequestApprover: true, isAdmin: false }
  }
  if (role === "ACCTG" || role === "ACCTG_MANAGER") {
    return { companyRole: "PAYROLL_ADMIN", isRequestApprover: true, isAdmin: false }
  }
  if (role === "MANAGER" || role === "PURCHASING_MANAGER") {
    return { companyRole: "APPROVER", isRequestApprover: true, isAdmin: false }
  }

  return { companyRole: "EMPLOYEE", isRequestApprover: false, isAdmin: false }
}

const normalizeLegacyPhotoUrl = (rawValue: unknown, baseUrl: string): string | null => {
  const raw = safeString(rawValue)
  if (!raw) return null

  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
    return raw
  }

  try {
    if (raw.startsWith("/")) {
      return new URL(raw, baseUrl).toString()
    }

    return new URL(`/api/profile-picture/${encodeURIComponent(raw)}?direct=true`, baseUrl).toString()
  } catch {
    return null
  }
}

const unwrapRows = (payload: unknown): LegacyEmployeeRow[] => {
  if (Array.isArray(payload)) {
    return payload as LegacyEmployeeRow[]
  }

  if (!payload || typeof payload !== "object") {
    return []
  }

  const source = payload as Record<string, unknown>
  for (const key of ["data", "items", "rows", "records"]) {
    if (Array.isArray(source[key])) {
      return source[key] as LegacyEmployeeRow[]
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
}): Promise<LegacyEmployeeRow[]> => {
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

const resolveUniqueEmail = async (
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  params: { preferredEmail: string | null; employeeId: string; existingUserId?: string }
): Promise<string> => {
  const usedByOther = async (candidate: string): Promise<boolean> => {
    const match = await tx.user.findUnique({
      where: { email: candidate },
      select: { id: true },
    })
    if (!match) return false
    if (params.existingUserId && match.id === params.existingUserId) return false
    return true
  }

  const preferred = params.preferredEmail?.trim().toLowerCase() ?? ""
  if (preferred && isValidEmail(preferred) && !(await usedByOther(preferred))) {
    return preferred
  }

  const baseLocal = params.employeeId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")
  const local = baseLocal || "legacy_user"
  const domain = "legacy.local"

  for (let index = 0; index < 200; index += 1) {
    const candidate = index === 0 ? `${local}@${domain}` : `${local}+${index}@${domain}`
    if (!(await usedByOther(candidate))) {
      return candidate
    }
  }

  throw new Error(`Unable to resolve unique email for ${params.employeeId}.`)
}

const ensureCompanyAccess = async (
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  params: {
    userId: string
    companyId: string
    companyRole: CompanyRole
  }
): Promise<void> => {
  const existing = await tx.userCompanyAccess.findUnique({
    where: {
      userId_companyId: {
        userId: params.userId,
        companyId: params.companyId,
      },
    },
    select: {
      userId: true,
      isDefault: true,
    },
  })

  if (existing) {
    await tx.userCompanyAccess.update({
      where: {
        userId_companyId: {
          userId: params.userId,
          companyId: params.companyId,
        },
      },
      data: {
        role: params.companyRole,
        isActive: true,
        isDefault: true,
      },
    })
  } else {
    await tx.userCompanyAccess.create({
      data: {
        userId: params.userId,
        companyId: params.companyId,
        role: params.companyRole,
        isActive: true,
        isDefault: true,
      },
    })
  }

  await tx.userCompanyAccess.updateMany({
    where: {
      userId: params.userId,
      companyId: { not: params.companyId },
    },
    data: {
      isDefault: false,
    },
  })
}

export async function executeLegacyEmployeeSync(
  input: ExecuteLegacyEmployeeSyncInput
): Promise<ExecuteLegacyEmployeeSyncResult> {
  const legacyRows = await fetchRows({
    baseUrl: input.baseUrl,
    endpoint: input.employeeEndpoint,
    companyId: input.companyId,
    legacyScopeId: input.legacyScopeId,
    apiToken: input.apiToken,
    timeoutMs: input.timeoutMs,
  })

  const summary: LegacyEmployeeSyncSummary = {
    fetched: legacyRows.length,
    processed: 0,
    skippedAlreadyMatched: 0,
    createdUsers: 0,
    createdEmployees: 0,
    linkedExisting: 0,
    conflicts: 0,
    invalidRows: 0,
    errors: 0,
  }

  const conflicts: LegacyEmployeeSyncIssue[] = []
  const invalidRows: LegacyEmployeeSyncIssue[] = []
  const errors: Array<{ employeeId: string; message: string }> = []

  for (const row of legacyRows) {
    const legacyEmployeeId = safeString(row.employeeId)
    const displayName = safeString(row.name)
    const { firstName, lastName } = splitName(displayName)
    const passwordHash = safeString(row.passwordHash)
    const legacyPhotoUrl = normalizeLegacyPhotoUrl(row.profilePicture, input.baseUrl)

    if (!legacyEmployeeId) {
      summary.invalidRows += 1
      invalidRows.push({
        employeeId: "",
        name: displayName || "(empty)",
        reason: "MISSING_EMPLOYEE_ID",
      })
      continue
    }

    if (!passwordHash) {
      summary.invalidRows += 1
      invalidRows.push({
        employeeId: legacyEmployeeId,
        name: displayName || "(empty)",
        reason: "MISSING_PASSWORD_HASH",
      })
      continue
    }

    try {
      const existingEmployee = await db.employee.findFirst({
        where: {
          companyId: input.companyId,
          employeeNumber: legacyEmployeeId,
        },
        select: {
          id: true,
          employeeNumber: true,
          userId: true,
          photoUrl: true,
          createdAt: true,
        },
      })

      const existingUser = await db.user.findUnique({
        where: { username: legacyEmployeeId },
        select: {
          id: true,
          username: true,
          employee: {
            select: {
              id: true,
              companyId: true,
              employeeNumber: true,
            },
          },
        },
      })

      if (existingEmployee && existingUser && existingEmployee.userId === existingUser.id) {
        if (!input.dryRun && legacyPhotoUrl && !existingEmployee.photoUrl) {
          await db.employee.update({
            where: { id: existingEmployee.id },
            data: {
              photoUrl: legacyPhotoUrl,
            },
          })
        }

        summary.skippedAlreadyMatched += 1
        continue
      }

      if (existingEmployee?.userId && existingUser && existingEmployee.userId !== existingUser.id) {
        summary.conflicts += 1
        conflicts.push({
          employeeId: legacyEmployeeId,
          name: displayName,
          reason: "EMPLOYEE_LINKED_TO_DIFFERENT_USER",
        })
        continue
      }

      if (existingUser?.employee && (!existingEmployee || existingUser.employee.id !== existingEmployee.id)) {
        summary.conflicts += 1
        conflicts.push({
          employeeId: legacyEmployeeId,
          name: displayName,
          reason: "USER_ALREADY_LINKED_TO_DIFFERENT_EMPLOYEE",
        })
        continue
      }

      const roleMapping = mapLegacyRoleToCompanyAccess(safeString(row.role))
      const hireDateRaw = toDate(row.hireDate) ?? toDate(row.createdAt) ?? new Date()
      const hireDate = toUtcDateOnly(hireDateRaw)
      const birthDate = toUtcDateOnly(new Date(Date.UTC(1990, 0, 1)))
      const createdAt = toDate(row.createdAt)
      const updatedAt = toDate(row.updatedAt)
      const isActive = typeof row.isActive === "boolean" ? row.isActive : true

      if (input.dryRun) {
        if (!existingUser) summary.createdUsers += 1
        if (!existingEmployee) summary.createdEmployees += 1
        if ((existingUser && !existingEmployee) || (!existingUser && existingEmployee) || (existingUser && existingEmployee)) {
          summary.linkedExisting += 1
        }
        summary.processed += 1
        continue
      }

      await db.$transaction(async (tx) => {
        let userId = existingUser?.id ?? null
        let employeeId = existingEmployee?.id ?? null

        if (!userId) {
          const email = await resolveUniqueEmail(tx, {
            preferredEmail: safeString(row.email) || null,
            employeeId: legacyEmployeeId,
          })

          const createdUser = await tx.user.create({
            data: {
              username: legacyEmployeeId,
              email,
              passwordHash,
              firstName,
              lastName,
              role: PlatformRole.STANDARD,
              isAdmin: roleMapping.isAdmin,
              isRequestApprover: roleMapping.isRequestApprover,
              isActive,
              ...(createdAt ? { createdAt } : {}),
              ...(updatedAt ? { updatedAt } : {}),
            },
            select: { id: true },
          })

          userId = createdUser.id
          summary.createdUsers += 1
        }

        if (!employeeId) {
          const createdEmployee = await tx.employee.create({
            data: {
              companyId: input.companyId,
              employeeNumber: legacyEmployeeId,
              userId,
              firstName,
              lastName,
              birthDate,
              hireDate,
              companyAssignmentDate: hireDate,
              isActive,
              ...(legacyPhotoUrl ? { photoUrl: legacyPhotoUrl } : {}),
              ...(createdAt ? { createdAt } : {}),
              ...(updatedAt ? { updatedAt } : {}),
            },
            select: { id: true },
          })

          employeeId = createdEmployee.id
          summary.createdEmployees += 1
        } else if (!existingEmployee?.userId) {
          await tx.employee.update({
            where: { id: employeeId },
            data: {
              userId,
              ...(updatedAt ? { updatedAt } : {}),
            },
          })
        }

        if (existingEmployee && legacyPhotoUrl && !existingEmployee.photoUrl) {
          await tx.employee.update({
            where: { id: existingEmployee.id },
            data: {
              photoUrl: legacyPhotoUrl,
              ...(updatedAt ? { updatedAt } : {}),
            },
          })
        }

        if (userId) {
          await ensureCompanyAccess(tx, {
            userId,
            companyId: input.companyId,
            companyRole: roleMapping.companyRole,
          })

          await tx.user.update({
            where: { id: userId },
            data: {
              selectedCompanyId: input.companyId,
              lastCompanySwitchedAt: new Date(),
              isActive,
              isRequestApprover: roleMapping.isRequestApprover,
              isAdmin: roleMapping.isAdmin,
            },
          })
        }
      })

      summary.linkedExisting += 1
      summary.processed += 1
    } catch (error) {
      summary.errors += 1
      errors.push({
        employeeId: legacyEmployeeId,
        message: error instanceof Error ? error.message : "Unknown sync error.",
      })
    }
  }

  return {
    summary,
    conflicts: conflicts.slice(0, 200),
    invalidRows: invalidRows.slice(0, 200),
    errors: errors.slice(0, 200),
  }
}
