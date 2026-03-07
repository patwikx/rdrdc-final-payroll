"use server"

import { revalidatePath } from "next/cache"
import { randomUUID } from "node:crypto"

import bcrypt from "bcryptjs"
import { Prisma, PlatformRole, type CompanyRole } from "@prisma/client"
import { z } from "zod"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess } from "@/modules/auth/utils/authorization-policy"
import {
  isEmployeePortalCapability,
  toEmployeePortalCapabilityOverrideEntries,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"
import {
  createEmployeeSystemUserInputSchema,
  createStandaloneSystemUserInputSchema,
  linkEmployeeToUserInputSchema,
  unlinkEmployeeUserInputSchema,
  deleteStandaloneSystemUserInputSchema,
  updateEmployeeCompanyAccessInputSchema,
  updateEmployeePortalCapabilityOverridesInputSchema,
  updateLinkedUserCredentialsInputSchema,
  updateStandaloneSystemUserInputSchema,
  updateEmployeeRequestApproverInputSchema,
  type CreateEmployeeSystemUserInput,
  type CreateStandaloneSystemUserInput,
  type DeleteStandaloneSystemUserInput,
  type LinkEmployeeToUserInput,
  type UnlinkEmployeeUserInput,
  type UpdateEmployeeCompanyAccessInput,
  type UpdateEmployeePortalCapabilityOverridesInput,
  type UpdateLinkedUserCredentialsInput,
  type UpdateStandaloneSystemUserInput,
  type UpdateEmployeeRequestApproverInput,
} from "@/modules/employees/user-access/schemas/user-access-actions-schema"

type ManageEmployeeUserAccessResult = { ok: true; message: string } | { ok: false; error: string }
type AvailableSystemUserOption = {
  id: string
  username: string
  email: string
  displayName: string
  companyRole: string | null
}
type GetAvailableSystemUsersActionResult =
  | { ok: true; data: AvailableSystemUserOption[] }
  | { ok: false; error: string }

const getAvailableSystemUsersInputSchema = z.object({
  companyId: z.string().uuid(),
  query: z.string().trim().max(120).optional(),
})

const resolveLinkedEmployeeUserEmail = async (params: {
  employeeId: string
  primaryEmail?: string | null
}): Promise<string> => {
  const normalizedPrimaryEmail = params.primaryEmail?.trim().toLowerCase() ?? ""

  if (normalizedPrimaryEmail) {
    const existingUser = await db.user.findUnique({
      where: { email: normalizedPrimaryEmail },
      select: { id: true },
    })

    if (!existingUser) {
      return normalizedPrimaryEmail
    }
  }

  return `employee-${params.employeeId}-${randomUUID()}@local.invalid`
}

const applyApproverRoleFallback = async (
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  params: {
    userId: string
    companyId: string
    companyRole: CompanyRole
    isRequestApprover: boolean
    isMaterialRequestPurchaser: boolean
    isMaterialRequestPoster: boolean
    isPurchaseRequestItemManager: boolean
  }
): Promise<void> => {
  const normalizedRole: CompanyRole = params.companyRole === "APPROVER" ? "EMPLOYEE" : params.companyRole

  await tx.userCompanyAccess.updateMany({
    where: {
      userId: params.userId,
      companyId: { not: params.companyId },
    },
    data: {
      isDefault: false,
    },
  })

  const existingAccess = await tx.userCompanyAccess.findUnique({
    where: {
      userId_companyId: {
        userId: params.userId,
        companyId: params.companyId,
      },
    },
    select: {
      userId: true,
    },
  })

  if (existingAccess) {
    await tx.userCompanyAccess.update({
      where: {
        userId_companyId: {
          userId: params.userId,
          companyId: params.companyId,
        },
      },
      data: {
        role: normalizedRole,
        isMaterialRequestPurchaser: params.isMaterialRequestPurchaser,
        isMaterialRequestPoster: params.isMaterialRequestPoster,
        isPurchaseRequestItemManager: params.isPurchaseRequestItemManager,
        isActive: true,
        isDefault: true,
      },
    })
  } else {
    await tx.userCompanyAccess.create({
      data: {
        userId: params.userId,
        companyId: params.companyId,
        role: normalizedRole,
        isMaterialRequestPurchaser: params.isMaterialRequestPurchaser,
        isMaterialRequestPoster: params.isMaterialRequestPoster,
        isPurchaseRequestItemManager: params.isPurchaseRequestItemManager,
        isActive: true,
        isDefault: true,
      },
    })
  }

  await tx.user.update({
    where: {
      id: params.userId,
    },
    data: {
      selectedCompanyId: params.companyId,
      lastCompanySwitchedAt: new Date(),
    },
  })
}

const canManageEmployeeUsers = (companyRole: CompanyRole): boolean => {
  return hasModuleAccess(companyRole, "employees")
}

export async function getAvailableSystemUsersAction(input: {
  companyId: string
  query?: string
}): Promise<GetAvailableSystemUsersActionResult> {
  const parsed = getAvailableSystemUsersInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid available users payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole
  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const searchQuery = payload.query?.trim() ?? ""

  const users = await db.user.findMany({
    where: {
      isActive: true,
      employee: null,
      ...(searchQuery
        ? {
            OR: [
              { username: { contains: searchQuery, mode: "insensitive" } },
              { email: { contains: searchQuery, mode: "insensitive" } },
              { firstName: { contains: searchQuery, mode: "insensitive" } },
              { lastName: { contains: searchQuery, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      companyAccess: {
        where: {
          companyId: context.companyId,
          isActive: true,
        },
        select: {
          role: true,
        },
        take: 1,
      },
    },
  })

  return {
    ok: true,
    data: users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: `${user.lastName}, ${user.firstName}`,
      companyRole: user.companyAccess[0]?.role ?? null,
    })),
  }
}

export async function createEmployeeSystemUserAction(
  input: CreateEmployeeSystemUserInput
): Promise<ManageEmployeeUserAccessResult> {
  const parsed = createEmployeeSystemUserInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid create user payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole

  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userId: true,
      employeeNumber: true,
      emails: {
        where: {
          isActive: true,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          email: true,
        },
        take: 1,
      },
    },
  })

  if (!employee) {
    return { ok: false, error: "Employee not found in active company." }
  }

  if (employee.userId) {
    return { ok: false, error: "Employee already has a linked user account." }
  }

  const existingUser = await db.user.findFirst({
    where: {
      username: payload.username,
    },
    select: {
      id: true,
      username: true,
    },
  })

  if (existingUser) {
    return {
      ok: false,
      error: "Username is already in use.",
    }
  }

  const passwordHash = await bcrypt.hash(payload.password, 12)
  const internalEmail = await resolveLinkedEmployeeUserEmail({
    employeeId: employee.id,
    primaryEmail: employee.emails[0]?.email ?? null,
  })

  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username: payload.username,
        email: internalEmail,
        passwordHash,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: PlatformRole.STANDARD,
        isAdmin: payload.companyRole === "COMPANY_ADMIN",
        isRequestApprover: payload.isRequestApprover,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
      },
    })

    await applyApproverRoleFallback(tx, {
      userId: user.id,
      companyId: context.companyId,
      companyRole: payload.companyRole,
      isRequestApprover: payload.isRequestApprover,
      isMaterialRequestPurchaser: payload.isMaterialRequestPurchaser,
      isMaterialRequestPoster: payload.isMaterialRequestPoster,
      isPurchaseRequestItemManager: payload.isPurchaseRequestItemManager,
    })

    await tx.employee.update({
      where: { id: employee.id },
      data: { userId: user.id, updatedById: context.userId },
    })

    await createAuditLog(
      {
        tableName: "Employee",
        recordId: employee.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "CREATE_AND_LINK_SYSTEM_USER",
        changes: [
          { fieldName: "userId", oldValue: employee.userId, newValue: user.id },
          { fieldName: "linkedUsername", newValue: user.username },
          { fieldName: "isRequestApprover", newValue: payload.isRequestApprover },
          { fieldName: "isMaterialRequestPurchaser", newValue: payload.isMaterialRequestPurchaser },
          { fieldName: "isMaterialRequestPoster", newValue: payload.isMaterialRequestPoster },
          { fieldName: "isPurchaseRequestItemManager", newValue: payload.isPurchaseRequestItemManager },
        ],
      },
      tx
    )

    return user
  })

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees`)

  return { ok: true, message: `System user ${created.username} created and linked.` }
}

export async function createStandaloneSystemUserAction(
  input: CreateStandaloneSystemUserInput
): Promise<ManageEmployeeUserAccessResult> {
  const parsed = createStandaloneSystemUserInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid create system account payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole

  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const existingUser = await db.user.findFirst({
    where: {
      OR: [{ username: payload.username }, { email: payload.email }],
    },
    select: {
      id: true,
      username: true,
      email: true,
    },
  })

  if (existingUser) {
    return {
      ok: false,
      error:
        existingUser.username.toLowerCase() === payload.username.toLowerCase()
          ? "Username is already in use."
          : "Email is already in use.",
    }
  }

  const passwordHash = await bcrypt.hash(payload.password, 12)

  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username: payload.username,
        email: payload.email,
        passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: PlatformRole.STANDARD,
        isAdmin: payload.companyRole === "COMPANY_ADMIN",
        isRequestApprover: payload.isRequestApprover,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    })

    await applyApproverRoleFallback(tx, {
      userId: user.id,
      companyId: context.companyId,
      companyRole: payload.companyRole,
      isRequestApprover: payload.isRequestApprover,
      isMaterialRequestPurchaser: payload.isMaterialRequestPurchaser,
      isMaterialRequestPoster: payload.isMaterialRequestPoster,
      isPurchaseRequestItemManager: payload.isPurchaseRequestItemManager,
    })

    await createAuditLog(
      {
        tableName: "User",
        recordId: user.id,
        action: "CREATE",
        userId: context.userId,
        reason: "CREATE_STANDALONE_SYSTEM_USER",
        changes: [
          { fieldName: "username", newValue: payload.username },
          { fieldName: "email", newValue: payload.email },
          { fieldName: "companyRole", newValue: payload.companyRole },
          { fieldName: "isRequestApprover", newValue: payload.isRequestApprover },
          { fieldName: "isMaterialRequestPurchaser", newValue: payload.isMaterialRequestPurchaser },
          { fieldName: "isMaterialRequestPoster", newValue: payload.isMaterialRequestPoster },
          { fieldName: "isPurchaseRequestItemManager", newValue: payload.isPurchaseRequestItemManager },
        ],
      },
      tx
    )

    return user
  })

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees`)

  return { ok: true, message: `System account ${created.username} created.` }
}

export async function linkEmployeeToExistingUserAction(
  input: LinkEmployeeToUserInput
): Promise<ManageEmployeeUserAccessResult> {
  const parsed = linkEmployeeToUserInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid link payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole

  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const [employee, user, linkedEmployee, existingAccess] = await Promise.all([
    db.employee.findFirst({
      where: {
        id: payload.employeeId,
        companyId: context.companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        employeeNumber: true,
      },
    }),
    db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        isRequestApprover: true,
      },
    }),
    db.employee.findFirst({
      where: { userId: payload.userId },
      select: { id: true, employeeNumber: true },
    }),
    db.userCompanyAccess.findUnique({
      where: {
        userId_companyId: {
          userId: payload.userId,
          companyId: context.companyId,
        },
      },
      select: {
        isMaterialRequestPurchaser: true,
        isMaterialRequestPoster: true,
        isPurchaseRequestItemManager: true,
      },
    }),
  ])

  if (!employee) {
    return { ok: false, error: "Employee not found in active company." }
  }
  if (employee.userId) {
    return { ok: false, error: "Employee already has a linked user account." }
  }
  if (!user) {
    return { ok: false, error: "Selected user account does not exist." }
  }
  if (linkedEmployee) {
    return { ok: false, error: `Selected user is already linked to employee ${linkedEmployee.employeeNumber}.` }
  }

  await db.$transaction(async (tx) => {
    await applyApproverRoleFallback(tx, {
      userId: user.id,
      companyId: context.companyId,
      companyRole: payload.companyRole,
      isRequestApprover: payload.isRequestApprover,
      isMaterialRequestPurchaser: payload.isMaterialRequestPurchaser,
      isMaterialRequestPoster: payload.isMaterialRequestPoster,
      isPurchaseRequestItemManager: payload.isPurchaseRequestItemManager,
    })

    await tx.user.update({
      where: { id: user.id },
      data: {
        isRequestApprover: payload.isRequestApprover,
        isAdmin: payload.companyRole === "COMPANY_ADMIN",
      },
    })

    await tx.employee.update({
      where: { id: employee.id },
      data: {
        userId: user.id,
        updatedById: context.userId,
      },
    })

    await createAuditLog(
      {
        tableName: "Employee",
        recordId: employee.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "LINK_EXISTING_USER",
        changes: [
          { fieldName: "userId", oldValue: employee.userId, newValue: user.id },
          { fieldName: "linkedUsername", newValue: user.username },
          { fieldName: "isRequestApprover", oldValue: user.isRequestApprover, newValue: payload.isRequestApprover },
          {
            fieldName: "isMaterialRequestPurchaser",
            oldValue: existingAccess?.isMaterialRequestPurchaser ?? false,
            newValue: payload.isMaterialRequestPurchaser,
          },
          {
            fieldName: "isMaterialRequestPoster",
            oldValue: existingAccess?.isMaterialRequestPoster ?? false,
            newValue: payload.isMaterialRequestPoster,
          },
          {
            fieldName: "isPurchaseRequestItemManager",
            oldValue: existingAccess?.isPurchaseRequestItemManager ?? false,
            newValue: payload.isPurchaseRequestItemManager,
          },
        ],
      },
      tx
    )
  })

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees`)

  return { ok: true, message: `Linked ${user.username} to employee ${employee.employeeNumber}.` }
}

export async function unlinkEmployeeUserAction(
  input: UnlinkEmployeeUserInput
): Promise<ManageEmployeeUserAccessResult> {
  const parsed = unlinkEmployeeUserInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid unlink payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole

  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
    },
    select: {
      id: true,
      employeeNumber: true,
      userId: true,
    },
  })

  if (!employee) {
    return { ok: false, error: "Employee not found in active company." }
  }

  if (!employee.userId) {
    return { ok: false, error: "Employee does not have a linked user account." }
  }

  await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employee.id },
      data: {
        userId: null,
        updatedById: context.userId,
      },
    })

    await createAuditLog(
      {
        tableName: "Employee",
        recordId: employee.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "UNLINK_USER",
        changes: [{ fieldName: "userId", oldValue: employee.userId, newValue: null }],
      },
      tx
    )
  })

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees`)

  return { ok: true, message: `Unlinked user from employee ${employee.employeeNumber}.` }
}

export async function updateEmployeeRequestApproverAction(
  input: UpdateEmployeeRequestApproverInput
): Promise<ManageEmployeeUserAccessResult> {
  const parsed = updateEmployeeRequestApproverInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid approver update payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole

  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
    },
    select: {
      id: true,
      employeeNumber: true,
      userId: true,
      user: {
        select: {
          id: true,
          isRequestApprover: true,
        },
      },
    },
  })

  if (!employee?.user?.id) {
    return { ok: false, error: "Employee must be linked to a user account before updating approver access." }
  }

  const linkedUserId = employee.user.id
  const previousIsRequestApprover = employee.user.isRequestApprover

  await db.$transaction(async (tx) => {
    const access = await tx.userCompanyAccess.findUnique({
      where: {
        userId_companyId: {
          userId: linkedUserId,
          companyId: context.companyId,
        },
      },
      select: { role: true },
    })

    const nextRole: CompanyRole | undefined = access
      ? access.role === "APPROVER"
        ? "EMPLOYEE"
        : access.role
      : undefined

    if (nextRole) {
      await tx.userCompanyAccess.update({
        where: {
          userId_companyId: {
            userId: linkedUserId,
            companyId: context.companyId,
          },
        },
        data: {
          role: nextRole,
        },
      })
    }

    await tx.user.update({
      where: { id: linkedUserId },
      data: {
        isRequestApprover: payload.isRequestApprover,
      },
    })

    await createAuditLog(
      {
        tableName: "User",
        recordId: linkedUserId,
        action: "UPDATE",
        userId: context.userId,
        reason: payload.isRequestApprover ? "GRANT_REQUEST_APPROVER" : "REVOKE_REQUEST_APPROVER",
        changes: [
          {
            fieldName: "isRequestApprover",
            oldValue: previousIsRequestApprover,
            newValue: payload.isRequestApprover,
          },
        ],
      },
      tx
    )
  })

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees`)

  return {
    ok: true,
    message: payload.isRequestApprover
      ? `Employee ${employee.employeeNumber} can now approve leave/overtime requests.`
      : `Employee ${employee.employeeNumber} is no longer a request approver.`,
  }
}

export async function updateEmployeeCompanyAccessAction(
  input: UpdateEmployeeCompanyAccessInput
): Promise<ManageEmployeeUserAccessResult> {
  const parsed = updateEmployeeCompanyAccessInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid company access payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole

  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      OR: [
        {
          companyId: context.companyId,
        },
        {
          user: {
            companyAccess: {
              some: {
                companyId: context.companyId,
                isActive: true,
                company: {
                  isActive: true,
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      employeeNumber: true,
      user: {
        select: {
          id: true,
          selectedCompanyId: true,
        },
      },
    },
  })

  if (!employee?.user?.id) {
    return { ok: false, error: "Employee must be linked to a user account before assigning company access." }
  }

  const linkedUser = employee.user
  const targetCompanyIds = payload.accesses.map((entry) => entry.companyId)
  const activeCompanies = await db.company.findMany({
    where: {
      id: {
        in: targetCompanyIds,
      },
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  if (activeCompanies.length !== targetCompanyIds.length) {
    return { ok: false, error: "Some selected companies are invalid or inactive." }
  }

  const explicitDefault = payload.accesses.find((entry) => entry.isDefault)?.companyId
  const nextDefaultCompanyId = explicitDefault ?? (targetCompanyIds.includes(context.companyId) ? context.companyId : targetCompanyIds[0])

  await db.$transaction(async (tx) => {
    await tx.userCompanyAccess.updateMany({
      where: {
        userId: linkedUser.id,
      },
      data: {
        isDefault: false,
      },
    })

    for (const entry of payload.accesses) {
      const normalizedRole: CompanyRole = entry.role === "APPROVER" ? "EMPLOYEE" : entry.role
      await tx.userCompanyAccess.upsert({
        where: {
          userId_companyId: {
            userId: linkedUser.id,
            companyId: entry.companyId,
          },
        },
        update: {
          role: normalizedRole,
          isActive: true,
          isDefault: entry.companyId === nextDefaultCompanyId,
          isMaterialRequestPurchaser: entry.isMaterialRequestPurchaser,
          isMaterialRequestPoster: entry.isMaterialRequestPoster,
          isPurchaseRequestItemManager: entry.isPurchaseRequestItemManager,
        },
        create: {
          userId: linkedUser.id,
          companyId: entry.companyId,
          role: normalizedRole,
          isActive: true,
          isDefault: entry.companyId === nextDefaultCompanyId,
          isMaterialRequestPurchaser: entry.isMaterialRequestPurchaser,
          isMaterialRequestPoster: entry.isMaterialRequestPoster,
          isPurchaseRequestItemManager: entry.isPurchaseRequestItemManager,
        },
      })
    }

    await tx.userCompanyAccess.updateMany({
      where: {
        userId: linkedUser.id,
        companyId: {
          notIn: targetCompanyIds,
        },
      },
      data: {
        isActive: false,
        isDefault: false,
      },
    })

    await tx.user.update({
      where: {
        id: linkedUser.id,
      },
      data: {
        selectedCompanyId:
          linkedUser.selectedCompanyId && targetCompanyIds.includes(linkedUser.selectedCompanyId)
            ? linkedUser.selectedCompanyId
            : nextDefaultCompanyId,
        lastCompanySwitchedAt: new Date(),
        isAdmin: payload.accesses.some((entry) => entry.role === "COMPANY_ADMIN"),
      },
    })

    await createAuditLog(
      {
        tableName: "UserCompanyAccess",
        recordId: linkedUser.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "UPDATE_MULTI_COMPANY_ACCESS",
        changes: [
          { fieldName: "accessCompanyIds", newValue: targetCompanyIds.join(",") },
          { fieldName: "defaultCompanyId", newValue: nextDefaultCompanyId },
        ],
      },
      tx
    )
  })

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees`)

  return { ok: true, message: `Updated company access assignments for employee ${employee.employeeNumber}.` }
}

export async function updateLinkedUserCredentialsAction(
  input: UpdateLinkedUserCredentialsInput
): Promise<ManageEmployeeUserAccessResult> {
  const parsed = updateLinkedUserCredentialsInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid user credentials payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole

  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      deletedAt: null,
      user: {
        isNot: null,
      },
    },
    select: {
      id: true,
      employeeNumber: true,
      userId: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          isRequestApprover: true,
          companyAccess: {
            where: {
              companyId: context.companyId,
              isActive: true,
            },
            select: {
              isMaterialRequestPurchaser: true,
              isMaterialRequestPoster: true,
              isPurchaseRequestItemManager: true,
            },
            take: 1,
          },
        },
      },
    },
  })

  if (!employee?.user?.id) {
    return { ok: false, error: "Employee has no linked user account." }
  }

  const linkedUser = employee.user

  const duplicate = await db.user.findFirst({
    where: {
      id: { not: linkedUser.id },
      username: payload.username,
    },
    select: {
      id: true,
      username: true,
    },
  })

  if (duplicate) {
    return {
      ok: false,
      error: "Username is already in use.",
    }
  }

  await db.$transaction(async (tx) => {
    const data: {
      username: string
      isActive: boolean
      isRequestApprover?: boolean
      isAdmin?: boolean
      passwordHash?: string
    } = {
      username: payload.username,
      isActive: payload.isActive,
    }

    if (typeof payload.isRequestApprover === "boolean") {
      data.isRequestApprover = payload.isRequestApprover
    }

    if (payload.companyRole) {
      data.isAdmin = payload.companyRole === "COMPANY_ADMIN"
      await applyApproverRoleFallback(tx, {
        userId: linkedUser.id,
        companyId: context.companyId,
        companyRole: payload.companyRole,
        isRequestApprover: payload.isRequestApprover ?? linkedUser.isRequestApprover,
        isMaterialRequestPurchaser:
          payload.isMaterialRequestPurchaser ?? linkedUser.companyAccess[0]?.isMaterialRequestPurchaser ?? false,
        isMaterialRequestPoster:
          payload.isMaterialRequestPoster ?? linkedUser.companyAccess[0]?.isMaterialRequestPoster ?? false,
        isPurchaseRequestItemManager:
          payload.isPurchaseRequestItemManager ?? linkedUser.companyAccess[0]?.isPurchaseRequestItemManager ?? false,
      })
    } else if (
      typeof payload.isMaterialRequestPurchaser === "boolean" ||
      typeof payload.isMaterialRequestPoster === "boolean" ||
      typeof payload.isPurchaseRequestItemManager === "boolean"
    ) {
      await tx.userCompanyAccess.updateMany({
        where: {
          userId: linkedUser.id,
          companyId: context.companyId,
          isActive: true,
        },
        data: {
          ...(typeof payload.isMaterialRequestPurchaser === "boolean"
            ? { isMaterialRequestPurchaser: payload.isMaterialRequestPurchaser }
            : {}),
          ...(typeof payload.isMaterialRequestPoster === "boolean"
            ? { isMaterialRequestPoster: payload.isMaterialRequestPoster }
            : {}),
          ...(typeof payload.isPurchaseRequestItemManager === "boolean"
            ? { isPurchaseRequestItemManager: payload.isPurchaseRequestItemManager }
            : {}),
        },
      })
    }

    if (payload.password) {
      data.passwordHash = await bcrypt.hash(payload.password, 12)
    }

    await tx.user.update({
      where: { id: linkedUser.id },
      data,
    })

    const changes: Array<{ fieldName: string; oldValue?: unknown; newValue?: unknown }> = [
      { fieldName: "username", oldValue: linkedUser.username, newValue: payload.username },
      { fieldName: "isActive", oldValue: linkedUser.isActive, newValue: payload.isActive },
      { fieldName: "passwordChanged", newValue: Boolean(payload.password) },
    ]

    if (typeof payload.isRequestApprover === "boolean") {
      changes.push({
        fieldName: "isRequestApprover",
        oldValue: linkedUser.isRequestApprover,
        newValue: payload.isRequestApprover,
      })
    }

    if (typeof payload.isMaterialRequestPurchaser === "boolean") {
      changes.push({
        fieldName: "isMaterialRequestPurchaser",
        oldValue: linkedUser.companyAccess[0]?.isMaterialRequestPurchaser ?? false,
        newValue: payload.isMaterialRequestPurchaser,
      })
    }

    if (typeof payload.isMaterialRequestPoster === "boolean") {
      changes.push({
        fieldName: "isMaterialRequestPoster",
        oldValue: linkedUser.companyAccess[0]?.isMaterialRequestPoster ?? false,
        newValue: payload.isMaterialRequestPoster,
      })
    }

    if (typeof payload.isPurchaseRequestItemManager === "boolean") {
      changes.push({
        fieldName: "isPurchaseRequestItemManager",
        oldValue: linkedUser.companyAccess[0]?.isPurchaseRequestItemManager ?? false,
        newValue: payload.isPurchaseRequestItemManager,
      })
    }

    await createAuditLog(
      {
        tableName: "User",
        recordId: linkedUser.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "UPDATE_LINKED_USER_CREDENTIALS",
        changes,
      },
      tx
    )
  })

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees/user-access/${employee.id}`)
  revalidatePath(`/${context.companyId}/employees`)

  return { ok: true, message: `Updated linked user credentials for employee ${employee.employeeNumber}.` }
}

export async function updateEmployeePortalCapabilityOverridesAction(
  input: UpdateEmployeePortalCapabilityOverridesInput
): Promise<ManageEmployeeUserAccessResult> {
  const parsed = updateEmployeePortalCapabilityOverridesInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid employee portal override payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole

  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const invalidCapability = payload.overrides.find(
    (entry) => !isEmployeePortalCapability(entry.capability)
  )
  if (invalidCapability) {
    return {
      ok: false,
      error: `Unsupported employee portal capability: ${invalidCapability.capability}.`,
    }
  }

  const normalizedOverrides = toEmployeePortalCapabilityOverrideEntries(payload.overrides)

  const [linkedUser, employee, companyAccess] = await Promise.all([
    db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
      },
    }),
    db.employee.findFirst({
      where: {
        id: payload.employeeId,
        userId: payload.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        employeeNumber: true,
      },
    }),
    db.userCompanyAccess.findUnique({
      where: {
        userId_companyId: {
          userId: payload.userId,
          companyId: context.companyId,
        },
      },
      select: {
        isActive: true,
        company: {
          select: {
            isActive: true,
          },
        },
      },
    }),
  ])

  if (!linkedUser) {
    return { ok: false, error: "Employee has no linked user account." }
  }
  const linkedUserId = linkedUser.id

  if (
    normalizedOverrides.length > 0 &&
    (!companyAccess?.isActive || !companyAccess.company.isActive)
  ) {
    return {
      ok: false,
      error: "Linked user does not have active access to the selected company.",
    }
  }

  const previousOverrides = await db.employeePortalCapabilityOverride.findMany({
    where: {
      userId: linkedUserId,
      companyId: context.companyId,
    },
    select: {
      capability: true,
      accessScope: true,
    },
    orderBy: [{ capability: "asc" }],
  })

  await db.$transaction(async (tx) => {
    await tx.employeePortalCapabilityOverride.deleteMany({
      where: {
        userId: linkedUserId,
        companyId: context.companyId,
      },
    })

    if (normalizedOverrides.length > 0) {
      await tx.employeePortalCapabilityOverride.createMany({
        data: normalizedOverrides.map((override) => ({
          userId: linkedUserId,
          companyId: context.companyId,
          capability: override.capability,
          accessScope: override.accessScope,
        })),
      })
    }

    await createAuditLog(
      {
        tableName: "EmployeePortalCapabilityOverride",
        recordId: linkedUserId,
        action: "UPDATE",
        userId: context.userId,
        reason: "UPDATE_EMPLOYEE_PORTAL_CAPABILITY_OVERRIDES",
        changes: [
          {
            fieldName: "previousOverrides",
            oldValue: JSON.stringify(previousOverrides),
            newValue: JSON.stringify(normalizedOverrides),
          },
        ],
      },
      tx
    )
  })

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees/user-access/${payload.employeeId}`)
  revalidatePath(`/${context.companyId}/employee-portal`)

  return {
    ok: true,
    message: `Updated employee portal access overrides for ${employee?.employeeNumber ?? linkedUser.username}.`,
  }
}

export async function updateStandaloneSystemUserAction(
  input: UpdateStandaloneSystemUserInput
): Promise<ManageEmployeeUserAccessResult> {
  const parsed = updateStandaloneSystemUserInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid system account payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole

  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const currentAccess = await db.userCompanyAccess.findUnique({
    where: {
      userId_companyId: {
        userId: payload.userId,
        companyId: context.companyId,
      },
    },
    select: {
      role: true,
      isMaterialRequestPurchaser: true,
      isMaterialRequestPoster: true,
      isPurchaseRequestItemManager: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isRequestApprover: true,
        },
      },
    },
  })

  if (!currentAccess?.user?.id) {
    return { ok: false, error: "System account not found for the active company." }
  }

  const duplicate = await db.user.findFirst({
    where: {
      id: { not: currentAccess.user.id },
      OR: [{ username: payload.username }, { email: payload.email }],
    },
    select: {
      id: true,
      username: true,
      email: true,
    },
  })

  if (duplicate) {
    return {
      ok: false,
      error:
        duplicate.username.toLowerCase() === payload.username.toLowerCase()
          ? "Username is already in use."
          : "Email is already in use.",
    }
  }

  await db.$transaction(async (tx) => {
    const normalizedRole: CompanyRole = payload.companyRole === "APPROVER" ? "EMPLOYEE" : payload.companyRole
    const userData: {
      firstName: string
      lastName: string
      username: string
      email: string
      isActive: boolean
      isRequestApprover: boolean
      isAdmin: boolean
      passwordHash?: string
    } = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username,
      email: payload.email,
      isActive: payload.isActive,
      isRequestApprover: payload.isRequestApprover,
      isAdmin: payload.companyRole === "COMPANY_ADMIN",
    }

    if (payload.password) {
      userData.passwordHash = await bcrypt.hash(payload.password, 12)
    }

    await tx.user.update({
      where: { id: currentAccess.user.id },
      data: userData,
    })

    await tx.userCompanyAccess.update({
      where: {
        userId_companyId: {
          userId: currentAccess.user.id,
          companyId: context.companyId,
        },
      },
      data: {
        role: normalizedRole,
        isActive: true,
        isMaterialRequestPurchaser: payload.isMaterialRequestPurchaser,
        isMaterialRequestPoster: payload.isMaterialRequestPoster,
        isPurchaseRequestItemManager: payload.isPurchaseRequestItemManager,
      },
    })

    await createAuditLog(
      {
        tableName: "User",
        recordId: currentAccess.user.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "UPDATE_SYSTEM_ACCOUNT",
        changes: [
          { fieldName: "firstName", oldValue: currentAccess.user.firstName, newValue: payload.firstName },
          { fieldName: "lastName", oldValue: currentAccess.user.lastName, newValue: payload.lastName },
          { fieldName: "username", oldValue: currentAccess.user.username, newValue: payload.username },
          { fieldName: "email", oldValue: currentAccess.user.email, newValue: payload.email },
          { fieldName: "isActive", oldValue: currentAccess.user.isActive, newValue: payload.isActive },
          {
            fieldName: "isRequestApprover",
            oldValue: currentAccess.user.isRequestApprover,
            newValue: payload.isRequestApprover,
          },
          { fieldName: "companyRole", oldValue: currentAccess.role, newValue: normalizedRole },
          {
            fieldName: "isMaterialRequestPurchaser",
            oldValue: currentAccess.isMaterialRequestPurchaser,
            newValue: payload.isMaterialRequestPurchaser,
          },
          {
            fieldName: "isMaterialRequestPoster",
            oldValue: currentAccess.isMaterialRequestPoster,
            newValue: payload.isMaterialRequestPoster,
          },
          {
            fieldName: "isPurchaseRequestItemManager",
            oldValue: currentAccess.isPurchaseRequestItemManager,
            newValue: payload.isPurchaseRequestItemManager,
          },
          { fieldName: "passwordChanged", newValue: Boolean(payload.password) },
        ],
      },
      tx
    )
  })

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees`)

  return { ok: true, message: `Updated system account ${currentAccess.user.username}.` }
}

export async function deleteStandaloneSystemUserAction(
  input: DeleteStandaloneSystemUserInput
): Promise<ManageEmployeeUserAccessResult> {
  const parsed = deleteStandaloneSystemUserInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid delete system account payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actorRole = context.companyRole as CompanyRole

  if (!canManageEmployeeUsers(actorRole)) {
    return { ok: false, error: "You do not have access to manage employee user accounts." }
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      employee: {
        select: {
          id: true,
          employeeNumber: true,
        },
      },
      companyAccess: {
        where: {
          isActive: true,
        },
        select: {
          companyId: true,
        },
      },
    },
  })

  if (!user) {
    return { ok: false, error: "System account not found." }
  }

  if (!user.companyAccess.some((access) => access.companyId === context.companyId)) {
    return { ok: false, error: "System account is not assigned to the active company." }
  }

  if (user.employee?.id) {
    return {
      ok: false,
      error: `Unlink this account from employee ${user.employee.employeeNumber} before deleting it.`,
    }
  }

  if (user.companyAccess.length > 1) {
    return {
      ok: false,
      error: "This account has access to multiple companies. Remove the other company access first before deleting it.",
    }
  }

  try {
    await db.$transaction(async (tx) => {
      await createAuditLog(
        {
          tableName: "User",
          recordId: user.id,
          action: "DELETE",
          userId: context.userId,
          reason: "DELETE_STANDALONE_SYSTEM_USER",
          changes: [{ fieldName: "username", oldValue: user.username }],
        },
        tx
      )

      await tx.user.delete({
        where: {
          id: user.id,
        },
      })
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        ok: false,
        error: "This account already has business history and cannot be deleted. Deactivate it instead.",
      }
    }

    throw error
  }

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees`)

  return { ok: true, message: `Deleted system account ${user.username}.` }
}
