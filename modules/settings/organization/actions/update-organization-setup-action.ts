"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  organizationSetupInputSchema,
  type OrganizationSetupInput,
} from "@/modules/settings/organization/schemas/organization-setup-schema"

type UpdateOrganizationSetupActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }
  return value
}

const assertCompanyMatch = (companyId: string, expectedCompanyId: string): boolean => {
  return companyId === expectedCompanyId
}

export async function updateOrganizationSetupAction(
  input: OrganizationSetupInput
): Promise<UpdateOrganizationSetupActionResult> {
  const parsed = organizationSetupInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid organization setup at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid organization setup payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to organization settings." }
  }

  if (!assertCompanyMatch(payload.companyId, context.companyId)) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.department.upsert({
        where: payload.department.id
          ? { id: payload.department.id }
          : { companyId_code: { companyId: context.companyId, code: payload.department.code } },
        update: {
          code: payload.department.code,
          name: payload.department.name,
          description: toNullable(payload.department.description),
          parentId: toNullable(payload.department.parentId),
          displayOrder: payload.department.displayOrder,
          isActive: payload.department.isActive,
          updatedById: context.userId,
        },
        create: {
          companyId: context.companyId,
          code: payload.department.code,
          name: payload.department.name,
          description: toNullable(payload.department.description),
          parentId: toNullable(payload.department.parentId),
          displayOrder: payload.department.displayOrder,
          isActive: payload.department.isActive,
          createdById: context.userId,
          updatedById: context.userId,
        },
      })

      await tx.position.upsert({
        where: payload.position.id
          ? { id: payload.position.id }
          : { companyId_code: { companyId: context.companyId, code: payload.position.code } },
        update: {
          code: payload.position.code,
          name: payload.position.name,
          description: toNullable(payload.position.description),
          jobFamily: toNullable(payload.position.jobFamily),
          jobGrade: toNullable(payload.position.jobGrade),
          salaryGradeMin: payload.position.salaryGradeMin,
          salaryGradeMax: payload.position.salaryGradeMax,
          level: payload.position.level,
          minExperienceYears: payload.position.minExperienceYears,
          educationRequired: toNullable(payload.position.educationRequired),
          displayOrder: payload.position.displayOrder,
          isActive: payload.position.isActive,
          updatedById: context.userId,
        },
        create: {
          companyId: context.companyId,
          code: payload.position.code,
          name: payload.position.name,
          description: toNullable(payload.position.description),
          jobFamily: toNullable(payload.position.jobFamily),
          jobGrade: toNullable(payload.position.jobGrade),
          salaryGradeMin: payload.position.salaryGradeMin,
          salaryGradeMax: payload.position.salaryGradeMax,
          level: payload.position.level,
          minExperienceYears: payload.position.minExperienceYears,
          educationRequired: toNullable(payload.position.educationRequired),
          displayOrder: payload.position.displayOrder,
          isActive: payload.position.isActive,
          createdById: context.userId,
          updatedById: context.userId,
        },
      })

      await tx.branch.upsert({
        where: payload.branch.id
          ? { id: payload.branch.id }
          : { companyId_code: { companyId: context.companyId, code: payload.branch.code } },
        update: {
          code: payload.branch.code,
          name: payload.branch.name,
          description: toNullable(payload.branch.description),
          street: toNullable(payload.branch.street),
          barangay: toNullable(payload.branch.barangay),
          city: toNullable(payload.branch.city),
          municipality: toNullable(payload.branch.municipality),
          province: toNullable(payload.branch.province),
          region: toNullable(payload.branch.region),
          postalCode: toNullable(payload.branch.postalCode),
          country: payload.branch.country,
          phone: toNullable(payload.branch.phone),
          email: toNullable(payload.branch.email),
          minimumWageRegion: toNullable(payload.branch.minimumWageRegion),
          displayOrder: payload.branch.displayOrder,
          isActive: payload.branch.isActive,
          updatedById: context.userId,
        },
        create: {
          companyId: context.companyId,
          code: payload.branch.code,
          name: payload.branch.name,
          description: toNullable(payload.branch.description),
          street: toNullable(payload.branch.street),
          barangay: toNullable(payload.branch.barangay),
          city: toNullable(payload.branch.city),
          municipality: toNullable(payload.branch.municipality),
          province: toNullable(payload.branch.province),
          region: toNullable(payload.branch.region),
          postalCode: toNullable(payload.branch.postalCode),
          country: payload.branch.country,
          phone: toNullable(payload.branch.phone),
          email: toNullable(payload.branch.email),
          minimumWageRegion: toNullable(payload.branch.minimumWageRegion),
          displayOrder: payload.branch.displayOrder,
          isActive: payload.branch.isActive,
          createdById: context.userId,
          updatedById: context.userId,
        },
      })

      await tx.division.upsert({
        where: payload.division.id
          ? { id: payload.division.id }
          : { companyId_code: { companyId: context.companyId, code: payload.division.code } },
        update: {
          code: payload.division.code,
          name: payload.division.name,
          description: toNullable(payload.division.description),
          parentId: toNullable(payload.division.parentId),
          displayOrder: payload.division.displayOrder,
          isActive: payload.division.isActive,
          updatedById: context.userId,
        },
        create: {
          companyId: context.companyId,
          code: payload.division.code,
          name: payload.division.name,
          description: toNullable(payload.division.description),
          parentId: toNullable(payload.division.parentId),
          displayOrder: payload.division.displayOrder,
          isActive: payload.division.isActive,
          createdById: context.userId,
          updatedById: context.userId,
        },
      })

      await tx.rank.upsert({
        where: payload.rank.id
          ? { id: payload.rank.id }
          : { companyId_code: { companyId: context.companyId, code: payload.rank.code } },
        update: {
          code: payload.rank.code,
          name: payload.rank.name,
          description: toNullable(payload.rank.description),
          level: payload.rank.level,
          category: toNullable(payload.rank.category),
          parentId: toNullable(payload.rank.parentId),
          salaryGradeMin: payload.rank.salaryGradeMin,
          salaryGradeMax: payload.rank.salaryGradeMax,
          displayOrder: payload.rank.displayOrder,
          isActive: payload.rank.isActive,
          updatedById: context.userId,
        },
        create: {
          companyId: context.companyId,
          code: payload.rank.code,
          name: payload.rank.name,
          description: toNullable(payload.rank.description),
          level: payload.rank.level,
          category: toNullable(payload.rank.category),
          parentId: toNullable(payload.rank.parentId),
          salaryGradeMin: payload.rank.salaryGradeMin,
          salaryGradeMax: payload.rank.salaryGradeMax,
          displayOrder: payload.rank.displayOrder,
          isActive: payload.rank.isActive,
          createdById: context.userId,
          updatedById: context.userId,
        },
      })

      await createAuditLog(
        {
          tableName: "OrganizationSetup",
          recordId: context.companyId,
          action: "UPDATE",
          userId: context.userId,
          reason: "ORGANIZATION_SETUP_UPDATED",
          changes: [
            { fieldName: "department.code", newValue: payload.department.code },
            { fieldName: "position.code", newValue: payload.position.code },
            { fieldName: "branch.code", newValue: payload.branch.code },
            { fieldName: "division.code", newValue: payload.division.code },
            { fieldName: "rank.code", newValue: payload.rank.code },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/organization`)

    return { ok: true, message: "Organization setup updated successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to update organization setup: ${message}` }
  }
}
