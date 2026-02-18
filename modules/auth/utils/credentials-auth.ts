import bcrypt from "bcryptjs"

import { db } from "@/lib/db"

type LoginUserRecord = {
  id: string
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  role: string
  isAdmin: boolean
  isActive: boolean
  lastLoginAt: Date | null
  companyAccess: Array<{
    companyId: string
    role: string
    isDefault: boolean
  }>
  employee: {
    id: string
    employeeNumber: string
    companyId: string
  } | null
}

export type AuthenticatedCredentialsUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isAdmin: boolean
  lastLoginAt: Date | null
  companyRole: string | null
  companyId: string | null
  employeeId: string | null
  employeeNumber: string | null
}

export type CredentialsAuthResult =
  | {
      ok: false
      reason: "USER_NOT_FOUND" | "USER_INACTIVE" | "BAD_PASSWORD" | "NO_ACTIVE_COMPANY_ACCESS"
      userId?: string
    }
  | { ok: true; user: AuthenticatedCredentialsUser }

export async function getLoginUser(identifier: string): Promise<LoginUserRecord | null> {
  try {
    const user = await db.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        isAdmin: true,
        isActive: true,
        lastLoginAt: true,
        companyAccess: {
          where: {
            isActive: true,
          },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          select: {
            companyId: true,
            role: true,
            isDefault: true,
          },
        },
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            companyId: true,
          },
        },
      },
    })

    return user
  } catch (error) {
    console.error("Failed to fetch user for credential auth:", error)
    return null
  }
}

type AuthenticateCredentialsInput = {
  identifier: string
  password: string
  requestedCompanyId?: string | null
}

export async function authenticateCredentials(input: AuthenticateCredentialsInput): Promise<CredentialsAuthResult> {
  const identifier = input.identifier.trim()
  if (!identifier) {
    return { ok: false, reason: "USER_NOT_FOUND" }
  }

  const user = await getLoginUser(identifier)
  if (!user) {
    return { ok: false, reason: "USER_NOT_FOUND" }
  }

  if (!user.isActive) {
    return { ok: false, reason: "USER_INACTIVE", userId: user.id }
  }

  const passwordsMatch = await bcrypt.compare(input.password, user.passwordHash)
  if (!passwordsMatch) {
    return { ok: false, reason: "BAD_PASSWORD", userId: user.id }
  }

  const requestedCompanyId = input.requestedCompanyId?.trim() || null
  const selectedCompanyAccess = requestedCompanyId
    ? user.companyAccess.find((access) => access.companyId === requestedCompanyId) ?? null
    : user.companyAccess[0] ?? null

  if (!selectedCompanyAccess && !user.isAdmin) {
    return { ok: false, reason: "NO_ACTIVE_COMPANY_ACCESS", userId: user.id }
  }

  const fallbackCompanyId = requestedCompanyId ?? user.employee?.companyId ?? null
  const resolvedCompanyId = selectedCompanyAccess?.companyId ?? fallbackCompanyId

  if (!resolvedCompanyId) {
    return { ok: false, reason: "NO_ACTIVE_COMPANY_ACCESS", userId: user.id }
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isAdmin: user.isAdmin,
      lastLoginAt: user.lastLoginAt,
      companyRole: selectedCompanyAccess?.role ?? null,
      companyId: resolvedCompanyId,
      employeeId: user.employee?.id ?? null,
      employeeNumber: user.employee?.employeeNumber ?? null,
    },
  }
}

export async function getUserSessionForCompany(params: {
  userId: string
  companyId: string
}): Promise<AuthenticatedCredentialsUser | null> {
  const user = await db.user.findFirst({
    where: {
      id: params.userId,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isAdmin: true,
      lastLoginAt: true,
      companyAccess: {
        where: {
          isActive: true,
          companyId: params.companyId,
        },
        select: {
          role: true,
        },
        take: 1,
      },
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          companyId: true,
        },
      },
    },
  })

  if (!user) {
    return null
  }

  const companyRole = user.companyAccess[0]?.role ?? null
  if (!companyRole && !user.isAdmin) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isAdmin: user.isAdmin,
    lastLoginAt: user.lastLoginAt,
    companyRole,
    companyId: params.companyId,
    employeeId: user.employee?.id ?? null,
    employeeNumber: user.employee?.employeeNumber ?? null,
  }
}
