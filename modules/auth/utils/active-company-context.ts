import { auth } from "@/auth"
import { db } from "@/lib/db"

export type ActiveCompanyContext = {
  userId: string
  companyId: string
  companyCode: string
  companyName: string
  companyRole: string
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

export async function getActiveCompanyContext(
  options?: ActiveCompanyResolverOptions
): Promise<ActiveCompanyContext> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new ActiveCompanyContextError("Unauthorized: no authenticated user")
  }

  const userPreference = await db.user.findUnique({
    where: { id: session.user.id },
    select: { selectedCompanyId: true },
  })

  const requestedCompanyId =
    options?.companyId ?? userPreference?.selectedCompanyId ?? session.user.defaultCompanyId ?? null

  const commonQuery = {
    userId: session.user.id,
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
    userId: session.user.id,
    companyId: companyAccess.companyId,
    companyCode: companyAccess.company.code,
    companyName: companyAccess.company.name,
    companyRole: companyAccess.role,
    isDefaultCompany: companyAccess.isDefault,
  }
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

  await db.$executeRawUnsafe(
    'UPDATE "User" SET "selectedCompanyId" = $1, "lastCompanySwitchedAt" = $2, "updatedAt" = $2 WHERE "id" = $3',
    params.companyId,
    switchedAt,
    params.userId
  )
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
