"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  upsertOrganizationEntityInputSchema,
  type UpsertOrganizationEntityInput,
} from "@/modules/settings/organization/schemas/organization-entity-schema"

type UpsertOrganizationEntityActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  return value
}

export async function upsertOrganizationEntityAction(
  input: UpsertOrganizationEntityInput
): Promise<UpsertOrganizationEntityActionResult> {
  const parsed = upsertOrganizationEntityInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid organization data at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid organization data payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to organization settings." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    await db.$transaction(async (tx) => {
      if (payload.entity === "departments") {
        await tx.department.upsert({
          where: payload.payload.id
            ? { id: payload.payload.id }
            : { companyId_code: { companyId: context.companyId, code: payload.payload.code } },
          update: {
            code: payload.payload.code,
            name: payload.payload.name,
            description: toNullable(payload.payload.description),
            parentId: toNullable(payload.payload.parentId),
            displayOrder: payload.payload.displayOrder,
            isActive: payload.payload.isActive,
            updatedById: context.userId,
          },
          create: {
            companyId: context.companyId,
            code: payload.payload.code,
            name: payload.payload.name,
            description: toNullable(payload.payload.description),
            parentId: toNullable(payload.payload.parentId),
            displayOrder: payload.payload.displayOrder,
            isActive: payload.payload.isActive,
            createdById: context.userId,
            updatedById: context.userId,
          },
        })
      }

      if (payload.entity === "divisions") {
        await tx.division.upsert({
          where: payload.payload.id
            ? { id: payload.payload.id }
            : { companyId_code: { companyId: context.companyId, code: payload.payload.code } },
          update: {
            code: payload.payload.code,
            name: payload.payload.name,
            description: toNullable(payload.payload.description),
            parentId: toNullable(payload.payload.parentId),
            displayOrder: payload.payload.displayOrder,
            isActive: payload.payload.isActive,
            updatedById: context.userId,
          },
          create: {
            companyId: context.companyId,
            code: payload.payload.code,
            name: payload.payload.name,
            description: toNullable(payload.payload.description),
            parentId: toNullable(payload.payload.parentId),
            displayOrder: payload.payload.displayOrder,
            isActive: payload.payload.isActive,
            createdById: context.userId,
            updatedById: context.userId,
          },
        })
      }

      if (payload.entity === "ranks") {
        await tx.rank.upsert({
          where: payload.payload.id
            ? { id: payload.payload.id }
            : { companyId_code: { companyId: context.companyId, code: payload.payload.code } },
          update: {
            code: payload.payload.code,
            name: payload.payload.name,
            description: toNullable(payload.payload.description),
            level: payload.payload.level,
            category: toNullable(payload.payload.category),
            parentId: toNullable(payload.payload.parentId),
            salaryGradeMin: payload.payload.salaryGradeMin,
            salaryGradeMax: payload.payload.salaryGradeMax,
            displayOrder: payload.payload.displayOrder,
            isActive: payload.payload.isActive,
            updatedById: context.userId,
          },
          create: {
            companyId: context.companyId,
            code: payload.payload.code,
            name: payload.payload.name,
            description: toNullable(payload.payload.description),
            level: payload.payload.level,
            category: toNullable(payload.payload.category),
            parentId: toNullable(payload.payload.parentId),
            salaryGradeMin: payload.payload.salaryGradeMin,
            salaryGradeMax: payload.payload.salaryGradeMax,
            displayOrder: payload.payload.displayOrder,
            isActive: payload.payload.isActive,
            createdById: context.userId,
            updatedById: context.userId,
          },
        })
      }

      if (payload.entity === "branches") {
        await tx.branch.upsert({
          where: payload.payload.id
            ? { id: payload.payload.id }
            : { companyId_code: { companyId: context.companyId, code: payload.payload.code } },
          update: {
            code: payload.payload.code,
            name: payload.payload.name,
            description: toNullable(payload.payload.description),
            street: toNullable(payload.payload.street),
            barangay: toNullable(payload.payload.barangay),
            city: toNullable(payload.payload.city),
            municipality: toNullable(payload.payload.municipality),
            province: toNullable(payload.payload.province),
            region: toNullable(payload.payload.region),
            postalCode: toNullable(payload.payload.postalCode),
            country: payload.payload.country,
            phone: toNullable(payload.payload.phone),
            email: toNullable(payload.payload.email),
            minimumWageRegion: toNullable(payload.payload.minimumWageRegion),
            displayOrder: payload.payload.displayOrder,
            isActive: payload.payload.isActive,
            updatedById: context.userId,
          },
          create: {
            companyId: context.companyId,
            code: payload.payload.code,
            name: payload.payload.name,
            description: toNullable(payload.payload.description),
            street: toNullable(payload.payload.street),
            barangay: toNullable(payload.payload.barangay),
            city: toNullable(payload.payload.city),
            municipality: toNullable(payload.payload.municipality),
            province: toNullable(payload.payload.province),
            region: toNullable(payload.payload.region),
            postalCode: toNullable(payload.payload.postalCode),
            country: payload.payload.country,
            phone: toNullable(payload.payload.phone),
            email: toNullable(payload.payload.email),
            minimumWageRegion: toNullable(payload.payload.minimumWageRegion),
            displayOrder: payload.payload.displayOrder,
            isActive: payload.payload.isActive,
            createdById: context.userId,
            updatedById: context.userId,
          },
        })
      }

      await createAuditLog(
        {
          tableName: "OrganizationEntity",
          recordId: context.companyId,
          action: "UPDATE",
          userId: context.userId,
          reason: `ORGANIZATION_${payload.entity.toUpperCase()}_UPSERT`,
          changes: [
            { fieldName: "entity", newValue: payload.entity },
            { fieldName: "code", newValue: payload.payload.code },
            { fieldName: "name", newValue: payload.payload.name },
            { fieldName: "isActive", newValue: payload.payload.isActive },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/organization`)
    revalidatePath(`/${context.companyId}/settings/organization/departments`)
    revalidatePath(`/${context.companyId}/settings/organization/divisions`)
    revalidatePath(`/${context.companyId}/settings/organization/ranks`)
    revalidatePath(`/${context.companyId}/settings/organization/branches`)

    return { ok: true, message: "Organization record saved successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to save organization record: ${message}` }
  }
}
