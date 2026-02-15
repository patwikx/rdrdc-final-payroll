import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cache } from "react"

export type ActiveCompanyContext = {
  userId: string
  companyId: string
  companyCode: string
  companyName: string
  companyRole: string
  userRole: string | null
  isDefaultCompany: boolean
}

export type UserCompanyOption = {
  companyId: string
  companyCode: string
  companyName: string
  role: string
  isDefault: boolean
}

export class ActiveCompanyContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ActiveCompanyContextError"
  }
}

type ActiveCompanyResolverOptions = {
  companyId?: string | null
}

type ActiveCompanySession = {
  userId: string
  defaultCompanyId: string | null
  userRole: string | null
}

const getActiveCompanySession = cache(async (): Promise<ActiveCompanySession> => {
  const session = await auth()

  if (!session?.user?.id) {
    throw new ActiveCompanyContextError("Unauthorized: no authenticated user")
  }

  return {
    userId: session.user.id,
    defaultCompanyId: session.user.defaultCompanyId ?? null,
    userRole: session.user.role ?? null,
  }
})

const getUserPreference = cache(async (userId: string) => {
  return db.user.findUnique({
    where: { id: userId },
    select: { selectedCompanyId: true },
  })
})

const resolveActiveCompanyContext = cache(
  async (requestedCompanyIdInput: string | null): Promise<ActiveCompanyContext> => {
    const session = await getActiveCompanySession()
    const userPreference = await getUserPreference(session.userId)

    const requestedCompanyId =
      requestedCompanyIdInput ??
      userPreference?.selectedCompanyId ??
      session.defaultCompanyId ??
      null

    const commonQuery = {
      userId: session.userId,
      isActive: true,
    }

    const includeCompany = {
      company: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      },
    }

    const orderBy = [{ isDefault: "desc" as const }, { createdAt: "asc" as const }]

    let companyAccess = requestedCompanyId
      ? await db.userCompanyAccess.findFirst({
          where: {
            ...commonQuery,
            companyId: requestedCompanyId,
          },
          include: includeCompany,
          orderBy,
        })
      : null

    if (!companyAccess) {
      companyAccess = await db.userCompanyAccess.findFirst({
        where: commonQuery,
        include: includeCompany,
        orderBy,
      })
    }

    if (!companyAccess) {
      throw new ActiveCompanyContextError("No active company access found for user")
    }

    if (!companyAccess.company.isActive) {
      throw new ActiveCompanyContextError("Selected company is inactive")
    }

    return {
      userId: session.userId,
      companyId: companyAccess.companyId,
      companyCode: companyAccess.company.code,
      companyName: companyAccess.company.name,
      companyRole: companyAccess.role,
      userRole: session.userRole,
      isDefaultCompany: companyAccess.isDefault,
    }
  }
)

export async function getActiveCompanyContext(
  options?: ActiveCompanyResolverOptions
): Promise<ActiveCompanyContext> {
  const requestedCompanyIdInput = options?.companyId ?? null
  return resolveActiveCompanyContext(requestedCompanyIdInput)
}

export async function persistSelectedCompanyForUser(params: {
  userId: string
  companyId: string
}): Promise<void> {
  const access = await db.userCompanyAccess.findFirst({
    where: {
      userId: params.userId,
      companyId: params.companyId,
      isActive: true,
    },
    select: { id: true },
  })

  if (!access) {
    throw new ActiveCompanyContextError("Cannot persist selected company without active user access")
  }

  const switchedAt = new Date()

  await db.user.update({
    where: { id: params.userId },
    data: {
      selectedCompanyId: params.companyId,
      lastCompanySwitchedAt: switchedAt,
      updatedAt: switchedAt,
    },
  })
}

export async function getUserCompanyOptions(userId: string): Promise<UserCompanyOption[]> {
  const accessList = await db.userCompanyAccess.findMany({
    where: {
      userId,
      isActive: true,
      company: {
        isActive: true,
      },
    },
    include: {
      company: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: [
      { isDefault: "desc" },
      { company: { name: "asc" } },
    ],
  })

  return accessList.map((access: (typeof accessList)[number]) => ({
    companyId: access.companyId,
    companyCode: access.company.code,
    companyName: access.company.name,
    role: access.role,
    isDefault: access.isDefault,
  }))
}
