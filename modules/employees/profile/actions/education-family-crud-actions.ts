"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  createBeneficiaryInputSchema,
  createDependentInputSchema,
  createEducationInputSchema,
  deleteBeneficiaryInputSchema,
  deleteDependentInputSchema,
  deleteEducationInputSchema,
  type CreateBeneficiaryInput,
  type CreateDependentInput,
  type CreateEducationInput,
  type DeleteBeneficiaryInput,
  type DeleteDependentInput,
  type DeleteEducationInput,
  type UpdateBeneficiaryInput,
  type UpdateDependentInput,
  type UpdateEducationInput,
  updateBeneficiaryInputSchema,
  updateDependentInputSchema,
  updateEducationInputSchema,
} from "@/modules/employees/profile/schemas/education-family-crud-schema"

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const parsePhDate = (value: string | undefined): Date | null => {
  if (!value) return null
  const normalized = value.trim()
  if (normalized.length === 0) return null
  const [year, month, day] = normalized.split("-").map((part) => Number(part))
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

const revalidateEmployeeProfilePaths = (companyId: string, employeeId: string) => {
  revalidatePath(`/${companyId}/employees`)
  revalidatePath(`/${companyId}/employees/${employeeId}`)
}

const validateContextAndAccess = async (companyId: string): Promise<{ companyId: string; userId: string } | null> => {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return null
  }
  return { companyId: context.companyId, userId: context.userId }
}

const ensureEmployeeInCompany = async (employeeId: string, companyId: string) => {
  return db.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { id: true },
  })
}

export async function createDependentAction(input: CreateDependentInput): Promise<ActionResult> {
  const parsed = createDependentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid dependent input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const created = await tx.employeeDependent.create({
      data: {
        employeeId: employee.id,
        firstName: payload.firstName,
        middleName: toNullable(payload.middleName),
        lastName: payload.lastName,
        relationshipId: payload.relationshipId,
        birthDate: parsePhDate(payload.birthDate),
        isTaxDependent: payload.isTaxDependent,
        isActive: true,
      },
    })

    await createAuditLog(
      {
        tableName: "EmployeeDependent",
        recordId: created.id,
        action: "CREATE",
        userId: context.userId,
        reason: "EMPLOYEE_DEPENDENT_CREATED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Dependent added." }
}

export async function updateDependentAction(input: UpdateDependentInput): Promise<ActionResult> {
  const parsed = updateDependentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid dependent input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const existing = await tx.employeeDependent.findFirst({
      where: { id: payload.dependentId, employeeId: employee.id, isActive: true },
      select: { id: true },
    })
    if (!existing) throw new Error("DEPENDENT_NOT_FOUND")

    await tx.employeeDependent.update({
      where: { id: existing.id },
      data: {
        firstName: payload.firstName,
        middleName: toNullable(payload.middleName),
        lastName: payload.lastName,
        relationshipId: payload.relationshipId,
        birthDate: parsePhDate(payload.birthDate),
        isTaxDependent: payload.isTaxDependent,
      },
    })

    await createAuditLog(
      {
        tableName: "EmployeeDependent",
        recordId: existing.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "EMPLOYEE_DEPENDENT_UPDATED",
      },
      tx
    )
  }).catch(() => {
    throw new Error("UPDATE_DEPENDENT_FAILED")
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Dependent updated." }
}

export async function deleteDependentAction(input: DeleteDependentInput): Promise<ActionResult> {
  const parsed = deleteDependentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid dependent delete request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const existing = await tx.employeeDependent.findFirst({
      where: { id: payload.dependentId, employeeId: employee.id, isActive: true },
      select: { id: true },
    })
    if (!existing) throw new Error("DEPENDENT_NOT_FOUND")

    await tx.employeeDependent.update({
      where: { id: existing.id },
      data: { isActive: false },
    })

    await createAuditLog(
      {
        tableName: "EmployeeDependent",
        recordId: existing.id,
        action: "DELETE",
        userId: context.userId,
        reason: "EMPLOYEE_DEPENDENT_DELETED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Dependent deleted." }
}

export async function createBeneficiaryAction(input: CreateBeneficiaryInput): Promise<ActionResult> {
  const parsed = createBeneficiaryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid beneficiary input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const created = await tx.employeeBeneficiary.create({
      data: {
        employeeId: employee.id,
        name: payload.name,
        relationshipId: payload.relationshipId,
        percentage: payload.percentage,
        contactNumber: toNullable(payload.contactNumber),
        isActive: true,
      },
    })

    await createAuditLog(
      {
        tableName: "EmployeeBeneficiary",
        recordId: created.id,
        action: "CREATE",
        userId: context.userId,
        reason: "EMPLOYEE_BENEFICIARY_CREATED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Beneficiary added." }
}

export async function updateBeneficiaryAction(input: UpdateBeneficiaryInput): Promise<ActionResult> {
  const parsed = updateBeneficiaryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid beneficiary input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const existing = await tx.employeeBeneficiary.findFirst({
      where: { id: payload.beneficiaryId, employeeId: employee.id, isActive: true },
      select: { id: true },
    })
    if (!existing) throw new Error("BENEFICIARY_NOT_FOUND")

    await tx.employeeBeneficiary.update({
      where: { id: existing.id },
      data: {
        name: payload.name,
        relationshipId: payload.relationshipId,
        percentage: payload.percentage,
        contactNumber: toNullable(payload.contactNumber),
      },
    })

    await createAuditLog(
      {
        tableName: "EmployeeBeneficiary",
        recordId: existing.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "EMPLOYEE_BENEFICIARY_UPDATED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Beneficiary updated." }
}

export async function deleteBeneficiaryAction(input: DeleteBeneficiaryInput): Promise<ActionResult> {
  const parsed = deleteBeneficiaryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid beneficiary delete request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const existing = await tx.employeeBeneficiary.findFirst({
      where: { id: payload.beneficiaryId, employeeId: employee.id, isActive: true },
      select: { id: true },
    })
    if (!existing) throw new Error("BENEFICIARY_NOT_FOUND")

    await tx.employeeBeneficiary.update({
      where: { id: existing.id },
      data: { isActive: false },
    })

    await createAuditLog(
      {
        tableName: "EmployeeBeneficiary",
        recordId: existing.id,
        action: "DELETE",
        userId: context.userId,
        reason: "EMPLOYEE_BENEFICIARY_DELETED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Beneficiary deleted." }
}

export async function createEducationAction(input: CreateEducationInput): Promise<ActionResult> {
  const parsed = createEducationInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid education input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const created = await tx.employeeEducation.create({
      data: {
        employeeId: employee.id,
        educationLevelId: payload.educationLevelId,
        schoolName: payload.schoolName,
        course: toNullable(payload.course),
        yearGraduated: payload.yearGraduated,
        isGraduated: Boolean(payload.yearGraduated),
        isOngoing: !payload.yearGraduated,
        isActive: true,
      },
    })

    await createAuditLog(
      {
        tableName: "EmployeeEducation",
        recordId: created.id,
        action: "CREATE",
        userId: context.userId,
        reason: "EMPLOYEE_EDUCATION_CREATED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Education record added." }
}

export async function updateEducationAction(input: UpdateEducationInput): Promise<ActionResult> {
  const parsed = updateEducationInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid education input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const existing = await tx.employeeEducation.findFirst({
      where: { id: payload.educationId, employeeId: employee.id, isActive: true },
      select: { id: true },
    })
    if (!existing) throw new Error("EDUCATION_NOT_FOUND")

    await tx.employeeEducation.update({
      where: { id: existing.id },
      data: {
        educationLevelId: payload.educationLevelId,
        schoolName: payload.schoolName,
        course: toNullable(payload.course),
        yearGraduated: payload.yearGraduated,
        isGraduated: Boolean(payload.yearGraduated),
        isOngoing: !payload.yearGraduated,
      },
    })

    await createAuditLog(
      {
        tableName: "EmployeeEducation",
        recordId: existing.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "EMPLOYEE_EDUCATION_UPDATED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Education record updated." }
}

export async function deleteEducationAction(input: DeleteEducationInput): Promise<ActionResult> {
  const parsed = deleteEducationInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid education delete request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const existing = await tx.employeeEducation.findFirst({
      where: { id: payload.educationId, employeeId: employee.id, isActive: true },
      select: { id: true },
    })
    if (!existing) throw new Error("EDUCATION_NOT_FOUND")

    await tx.employeeEducation.update({
      where: { id: existing.id },
      data: { isActive: false },
    })

    await createAuditLog(
      {
        tableName: "EmployeeEducation",
        recordId: existing.id,
        action: "DELETE",
        userId: context.userId,
        reason: "EMPLOYEE_EDUCATION_DELETED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Education record deleted." }
}
