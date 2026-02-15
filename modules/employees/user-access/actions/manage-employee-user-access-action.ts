"use server"

import { revalidatePath } from "next/cache"

import bcrypt from "bcryptjs"
import { PlatformRole, type CompanyRole } from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess } from "@/modules/auth/utils/authorization-policy"
import {
  createEmployeeSystemUserInputSchema,
  linkEmployeeToUserInputSchema,
  unlinkEmployeeUserInputSchema,
  updateEmployeeCompanyAccessInputSchema,
  updateLinkedUserCredentialsInputSchema,
  updateEmployeeRequestApproverInputSchema,
  type CreateEmployeeSystemUserInput,
  type LinkEmployeeToUserInput,
  type UnlinkEmployeeUserInput,
  type UpdateEmployeeCompanyAccessInput,
  type UpdateLinkedUserCredentialsInput,
  type UpdateEmployeeRequestApproverInput,
} from "@/modules/employees/user-access/schemas/user-access-actions-schema"

type ManageEmployeeUserAccessResult = { ok: true; message: string } | { ok: false; error: string }

const applyApproverRoleFallback = async (
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  params: {
    userId: string
    companyId: string
    companyRole: CompanyRole
    isRequestApprover: boolean
    isMaterialRequestPurchaser: boolean
    isMaterialRequestPoster: boolean
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
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userId: true,
      employeeNumber: true,
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
      deletedAt: null,
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
      deletedAt: null,
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
      companyId: context.companyId,
      deletedAt: null,
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
        },
        create: {
          userId: linkedUser.id,
          companyId: entry.companyId,
          role: normalizedRole,
          isActive: true,
          isDefault: entry.companyId === nextDefaultCompanyId,
          isMaterialRequestPurchaser: entry.isMaterialRequestPurchaser,
          isMaterialRequestPoster: entry.isMaterialRequestPoster,
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
      companyId: context.companyId,
      deletedAt: null,
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
    const data: {
      username: string
      email: string
      isActive: boolean
      isRequestApprover?: boolean
      isAdmin?: boolean
      passwordHash?: string
    } = {
      username: payload.username,
      email: payload.email,
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
      })
    } else if (
      typeof payload.isMaterialRequestPurchaser === "boolean" ||
      typeof payload.isMaterialRequestPoster === "boolean"
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
      { fieldName: "email", oldValue: linkedUser.email, newValue: payload.email },
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
  revalidatePath(`/${context.companyId}/employees`)

  return { ok: true, message: `Updated linked user credentials for employee ${employee.employeeNumber}.` }
}
