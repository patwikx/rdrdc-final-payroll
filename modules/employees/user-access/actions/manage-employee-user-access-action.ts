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
  updateLinkedUserCredentialsInputSchema,
  updateEmployeeRequestApproverInputSchema,
  type CreateEmployeeSystemUserInput,
  type LinkEmployeeToUserInput,
  type UnlinkEmployeeUserInput,
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

  const [employee, user, linkedEmployee] = await Promise.all([
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
      isAdmin?: boolean
      passwordHash?: string
    } = {
      username: payload.username,
      email: payload.email,
      isActive: payload.isActive,
    }

    if (payload.companyRole) {
      data.isAdmin = payload.companyRole === "COMPANY_ADMIN"
      await applyApproverRoleFallback(tx, {
        userId: linkedUser.id,
        companyId: context.companyId,
        companyRole: payload.companyRole,
        isRequestApprover: false,
      })
    }

    if (payload.password) {
      data.passwordHash = await bcrypt.hash(payload.password, 12)
    }

    await tx.user.update({
      where: { id: linkedUser.id },
      data,
    })

    await createAuditLog(
      {
        tableName: "User",
        recordId: linkedUser.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "UPDATE_LINKED_USER_CREDENTIALS",
        changes: [
          { fieldName: "username", oldValue: linkedUser.username, newValue: payload.username },
          { fieldName: "email", oldValue: linkedUser.email, newValue: payload.email },
          { fieldName: "isActive", oldValue: linkedUser.isActive, newValue: payload.isActive },
          { fieldName: "passwordChanged", newValue: Boolean(payload.password) },
        ],
      },
      tx
    )
  })

  revalidatePath(`/${context.companyId}/employees/user-access`)
  revalidatePath(`/${context.companyId}/employees`)

  return { ok: true, message: `Updated linked user credentials for employee ${employee.employeeNumber}.` }
}
