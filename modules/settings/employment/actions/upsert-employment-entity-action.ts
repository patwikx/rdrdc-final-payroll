"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  upsertEmploymentEntityInputSchema,
  type UpsertEmploymentEntityInput,
} from "@/modules/settings/employment/schemas/upsert-employment-entity-schema"

type UpsertEmploymentEntityActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  return value
}

const toDecimalText = (value: number | undefined): string | null => {
  if (value === undefined) {
    return null
  }

  return value.toFixed(2)
}

const normalizeCode = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, "_")

const toPlural = (count: number): string => (count === 1 ? "employee" : "employees")

export async function upsertEmploymentEntityAction(
  input: UpsertEmploymentEntityInput
): Promise<UpsertEmploymentEntityActionResult> {
  const parsed = upsertEmploymentEntityInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid employment setup payload at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid employment setup payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to employment settings." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    await db.$transaction(async (tx) => {
      if (payload.entity === "positions") {
        const safeCode = normalizeCode(payload.payload.code)

        const existingByCode = await tx.position.findUnique({
          where: {
            companyId_code: {
              companyId: context.companyId,
              code: safeCode,
            },
          },
          select: { id: true },
        })

        if (payload.payload.id) {
          const existing = await tx.position.findFirst({
            where: {
              id: payload.payload.id,
              companyId: context.companyId,
            },
            select: { id: true },
          })

          if (!existing) {
            throw new Error("Position record not found in active company.")
          }

          if (!payload.payload.isActive) {
            const activeAssignmentCount = await tx.employee.count({
              where: {
                companyId: context.companyId,
                isActive: true,
                positionId: existing.id,
              },
            })

            if (activeAssignmentCount > 0) {
              throw new Error(
                `Cannot deactivate this position. It is assigned to ${activeAssignmentCount} active ${toPlural(activeAssignmentCount)}.`
              )
            }
          }

          await tx.position.update({
            where: { id: payload.payload.id },
            data: {
              code: safeCode,
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              level: payload.payload.level,
              jobFamily: toNullable(payload.payload.jobFamily),
              jobGrade: toNullable(payload.payload.jobGrade),
              salaryGradeMin: toDecimalText(payload.payload.salaryGradeMin),
              salaryGradeMax: toDecimalText(payload.payload.salaryGradeMax),
              minExperienceYears: payload.payload.minExperienceYears,
              educationRequired: toNullable(payload.payload.educationRequired),
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              updatedById: context.userId,
            },
          })
        } else {
          if (!payload.payload.isActive && existingByCode) {
            const activeAssignmentCount = await tx.employee.count({
              where: {
                companyId: context.companyId,
                isActive: true,
                positionId: existingByCode.id,
              },
            })

            if (activeAssignmentCount > 0) {
              throw new Error(
                `Cannot deactivate this position. It is assigned to ${activeAssignmentCount} active ${toPlural(activeAssignmentCount)}.`
              )
            }
          }

          await tx.position.upsert({
            where: {
              companyId_code: {
                companyId: context.companyId,
                code: safeCode,
              },
            },
            update: {
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              level: payload.payload.level,
              jobFamily: toNullable(payload.payload.jobFamily),
              jobGrade: toNullable(payload.payload.jobGrade),
              salaryGradeMin: toDecimalText(payload.payload.salaryGradeMin),
              salaryGradeMax: toDecimalText(payload.payload.salaryGradeMax),
              minExperienceYears: payload.payload.minExperienceYears,
              educationRequired: toNullable(payload.payload.educationRequired),
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              updatedById: context.userId,
            },
            create: {
              companyId: context.companyId,
              code: safeCode,
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              level: payload.payload.level,
              jobFamily: toNullable(payload.payload.jobFamily),
              jobGrade: toNullable(payload.payload.jobGrade),
              salaryGradeMin: toDecimalText(payload.payload.salaryGradeMin),
              salaryGradeMax: toDecimalText(payload.payload.salaryGradeMax),
              minExperienceYears: payload.payload.minExperienceYears,
              educationRequired: toNullable(payload.payload.educationRequired),
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              createdById: context.userId,
              updatedById: context.userId,
            },
          })
        }
      }

      if (payload.entity === "employmentStatuses") {
        const safeCode = normalizeCode(payload.payload.code)

        const existingByCode = await tx.employmentStatus.findUnique({
          where: {
            companyId_code: {
              companyId: context.companyId,
              code: safeCode,
            },
          },
          select: { id: true },
        })

        if (payload.payload.id) {
          const existing = await tx.employmentStatus.findFirst({
            where: {
              id: payload.payload.id,
              companyId: context.companyId,
            },
            select: { id: true },
          })

          if (!existing) {
            throw new Error("Employment status record not found in active company.")
          }

          if (!payload.payload.isActive) {
            const activeAssignmentCount = await tx.employee.count({
              where: {
                companyId: context.companyId,
                isActive: true,
                employmentStatusId: existing.id,
              },
            })

            if (activeAssignmentCount > 0) {
              throw new Error(
                `Cannot deactivate this employment status. It is assigned to ${activeAssignmentCount} active ${toPlural(activeAssignmentCount)}.`
              )
            }
          }

          await tx.employmentStatus.update({
            where: { id: existing.id },
            data: {
              code: safeCode,
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              allowsPayroll: payload.payload.allowsPayroll,
              allowsLeave: payload.payload.allowsLeave,
              allowsLoans: payload.payload.allowsLoans,
              triggersOffboarding: payload.payload.triggersOffboarding,
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              updatedById: context.userId,
            },
          })
        } else {
          if (!payload.payload.isActive && existingByCode) {
            const activeAssignmentCount = await tx.employee.count({
              where: {
                companyId: context.companyId,
                isActive: true,
                employmentStatusId: existingByCode.id,
              },
            })

            if (activeAssignmentCount > 0) {
              throw new Error(
                `Cannot deactivate this employment status. It is assigned to ${activeAssignmentCount} active ${toPlural(activeAssignmentCount)}.`
              )
            }
          }

          await tx.employmentStatus.upsert({
            where: {
              companyId_code: {
                companyId: context.companyId,
                code: safeCode,
              },
            },
            update: {
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              allowsPayroll: payload.payload.allowsPayroll,
              allowsLeave: payload.payload.allowsLeave,
              allowsLoans: payload.payload.allowsLoans,
              triggersOffboarding: payload.payload.triggersOffboarding,
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              updatedById: context.userId,
            },
            create: {
              companyId: context.companyId,
              code: safeCode,
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              allowsPayroll: payload.payload.allowsPayroll,
              allowsLeave: payload.payload.allowsLeave,
              allowsLoans: payload.payload.allowsLoans,
              triggersOffboarding: payload.payload.triggersOffboarding,
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              createdById: context.userId,
              updatedById: context.userId,
            },
          })
        }
      }

      if (payload.entity === "employmentTypes") {
        const safeCode = normalizeCode(payload.payload.code)

        const existingByCode = await tx.employmentType.findUnique({
          where: {
            companyId_code: {
              companyId: context.companyId,
              code: safeCode,
            },
          },
          select: { id: true },
        })

        if (payload.payload.id) {
          const existing = await tx.employmentType.findFirst({
            where: {
              id: payload.payload.id,
              companyId: context.companyId,
            },
            select: { id: true },
          })

          if (!existing) {
            throw new Error("Employment type record not found in active company.")
          }

          if (!payload.payload.isActive) {
            const activeAssignmentCount = await tx.employee.count({
              where: {
                companyId: context.companyId,
                isActive: true,
                employmentTypeId: existing.id,
              },
            })

            if (activeAssignmentCount > 0) {
              throw new Error(
                `Cannot deactivate this employment type. It is assigned to ${activeAssignmentCount} active ${toPlural(activeAssignmentCount)}.`
              )
            }
          }

          await tx.employmentType.update({
            where: { id: existing.id },
            data: {
              code: safeCode,
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              hasBenefits: payload.payload.hasBenefits,
              hasLeaveCredits: payload.payload.hasLeaveCredits,
              has13thMonth: payload.payload.has13thMonth,
              hasMandatoryDeductions: payload.payload.hasMandatoryDeductions,
              maxContractMonths: payload.payload.maxContractMonths,
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              updatedById: context.userId,
            },
          })
        } else {
          if (!payload.payload.isActive && existingByCode) {
            const activeAssignmentCount = await tx.employee.count({
              where: {
                companyId: context.companyId,
                isActive: true,
                employmentTypeId: existingByCode.id,
              },
            })

            if (activeAssignmentCount > 0) {
              throw new Error(
                `Cannot deactivate this employment type. It is assigned to ${activeAssignmentCount} active ${toPlural(activeAssignmentCount)}.`
              )
            }
          }

          await tx.employmentType.upsert({
            where: {
              companyId_code: {
                companyId: context.companyId,
                code: safeCode,
              },
            },
            update: {
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              hasBenefits: payload.payload.hasBenefits,
              hasLeaveCredits: payload.payload.hasLeaveCredits,
              has13thMonth: payload.payload.has13thMonth,
              hasMandatoryDeductions: payload.payload.hasMandatoryDeductions,
              maxContractMonths: payload.payload.maxContractMonths,
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              updatedById: context.userId,
            },
            create: {
              companyId: context.companyId,
              code: safeCode,
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              hasBenefits: payload.payload.hasBenefits,
              hasLeaveCredits: payload.payload.hasLeaveCredits,
              has13thMonth: payload.payload.has13thMonth,
              hasMandatoryDeductions: payload.payload.hasMandatoryDeductions,
              maxContractMonths: payload.payload.maxContractMonths,
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              createdById: context.userId,
              updatedById: context.userId,
            },
          })
        }
      }

      if (payload.entity === "employmentClasses") {
        const safeCode = normalizeCode(payload.payload.code)

        const existingByCode = await tx.employmentClass.findUnique({
          where: {
            companyId_code: {
              companyId: context.companyId,
              code: safeCode,
            },
          },
          select: { id: true },
        })

        if (payload.payload.id) {
          const existing = await tx.employmentClass.findFirst({
            where: {
              id: payload.payload.id,
              companyId: context.companyId,
            },
            select: { id: true },
          })

          if (!existing) {
            throw new Error("Employment class record not found in active company.")
          }

          if (!payload.payload.isActive) {
            const activeAssignmentCount = await tx.employee.count({
              where: {
                companyId: context.companyId,
                isActive: true,
                employmentClassId: existing.id,
              },
            })

            if (activeAssignmentCount > 0) {
              throw new Error(
                `Cannot deactivate this employment class. It is assigned to ${activeAssignmentCount} active ${toPlural(activeAssignmentCount)}.`
              )
            }
          }

          await tx.employmentClass.update({
            where: { id: existing.id },
            data: {
              code: safeCode,
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              standardHoursPerDay: payload.payload.standardHoursPerDay.toFixed(2),
              standardDaysPerWeek: payload.payload.standardDaysPerWeek,
              isOvertimeEligible: payload.payload.isOvertimeEligible,
              isHolidayPayEligible: payload.payload.isHolidayPayEligible,
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              updatedById: context.userId,
            },
          })
        } else {
          if (!payload.payload.isActive && existingByCode) {
            const activeAssignmentCount = await tx.employee.count({
              where: {
                companyId: context.companyId,
                isActive: true,
                employmentClassId: existingByCode.id,
              },
            })

            if (activeAssignmentCount > 0) {
              throw new Error(
                `Cannot deactivate this employment class. It is assigned to ${activeAssignmentCount} active ${toPlural(activeAssignmentCount)}.`
              )
            }
          }

          await tx.employmentClass.upsert({
            where: {
              companyId_code: {
                companyId: context.companyId,
                code: safeCode,
              },
            },
            update: {
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              standardHoursPerDay: payload.payload.standardHoursPerDay.toFixed(2),
              standardDaysPerWeek: payload.payload.standardDaysPerWeek,
              isOvertimeEligible: payload.payload.isOvertimeEligible,
              isHolidayPayEligible: payload.payload.isHolidayPayEligible,
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              updatedById: context.userId,
            },
            create: {
              companyId: context.companyId,
              code: safeCode,
              name: payload.payload.name,
              description: toNullable(payload.payload.description),
              standardHoursPerDay: payload.payload.standardHoursPerDay.toFixed(2),
              standardDaysPerWeek: payload.payload.standardDaysPerWeek,
              isOvertimeEligible: payload.payload.isOvertimeEligible,
              isHolidayPayEligible: payload.payload.isHolidayPayEligible,
              displayOrder: payload.payload.displayOrder,
              isActive: payload.payload.isActive,
              createdById: context.userId,
              updatedById: context.userId,
            },
          })
        }
      }

      await createAuditLog(
        {
          tableName: "EmploymentSetup",
          recordId: context.companyId,
          action: "UPDATE",
          userId: context.userId,
          reason: `EMPLOYMENT_${payload.entity.toUpperCase()}_UPSERT`,
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

    revalidatePath(`/${context.companyId}/settings/employment`)
    revalidatePath(`/${context.companyId}/settings/organization/positions`)

    return { ok: true, message: "Employment setup record saved successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to save employment setup record: ${message}` }
  }
}
