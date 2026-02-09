"use server"

import { BloodType, CivilStatus, EmployeeMovementType, Gender, Prisma, Religion, SalaryAdjustmentType, TaxStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  updateEmployeeProfileInputSchema,
  type UpdateEmployeeProfileInput,
} from "@/modules/employees/profile/schemas/update-employee-profile-schema"

type UpdateEmployeeProfileActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toNullableId = (value: string | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const encodeIdValue = (value: string): string => {
  return Buffer.from(value, "utf8").toString("base64")
}

const maskIdValue = (value: string): string => {
  const tail = value.slice(-4)
  return `${"*".repeat(Math.max(0, value.length - 4))}${tail}`
}

const toGenderEnum = (value: string | undefined): Gender | null => {
  if (!value) return null
  return Object.values(Gender).includes(value as Gender) ? (value as Gender) : null
}

const toCivilStatusEnum = (value: string | undefined): CivilStatus | null => {
  if (!value) return null
  return Object.values(CivilStatus).includes(value as CivilStatus) ? (value as CivilStatus) : null
}

const toTaxStatusEnum = (value: string | undefined): TaxStatus | null => {
  if (!value) return null
  return Object.values(TaxStatus).includes(value as TaxStatus) ? (value as TaxStatus) : null
}

const toReligionEnum = (value: string | undefined): Religion | null => {
  if (!value) return null
  return Object.values(Religion).includes(value as Religion) ? (value as Religion) : null
}

const toBloodTypeEnum = (value: string | undefined): BloodType | null => {
  if (!value) return null
  return Object.values(BloodType).includes(value as BloodType) ? (value as BloodType) : null
}

const parsePhDate = (value: string | undefined): Date | null => {
  if (!value) return null
  const normalized = value.trim()
  if (normalized.length === 0) return null
  const [year, month, day] = normalized.split("-").map((part) => Number(part))
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

const getTodayPhDate = (): Date => {
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date())

  return parsePhDate(today) ?? new Date()
}

export async function updateEmployeeProfileAction(
  input: UpdateEmployeeProfileInput
): Promise<UpdateEmployeeProfileActionResult> {
  const parsed = updateEmployeeProfileInputSchema.safeParse(input)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? "Please review the profile form and try again." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return { ok: false, error: "You do not have permission to update employee records in this company." }
  }

  try {
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id: payload.employeeId,
          companyId: context.companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          nickname: true,
          maidenName: true,
          employmentStatusId: true,
          positionId: true,
          departmentId: true,
          branchId: true,
          rankId: true,
        },
      })

      if (!employee) {
        throw new Error("EMPLOYEE_NOT_FOUND")
      }

      const effectiveDate = getTodayPhDate()
      const nextEmploymentStatusId = toNullableId(payload.employmentStatusId)
      const nextPositionId = toNullableId(payload.positionId)
      const nextDepartmentId = toNullableId(payload.departmentId)
      const nextBranchId = toNullableId(payload.branchId)
      const nextRankId = toNullableId(payload.rankId)

      if (nextEmploymentStatusId !== employee.employmentStatusId) {
        await tx.employeeStatusHistory.create({
          data: {
            employeeId: employee.id,
            previousStatusId: employee.employmentStatusId,
            newStatusId: nextEmploymentStatusId,
            effectiveDate,
            reason: "Employment status updated",
            changedById: context.userId,
          },
        })
      }

      if (nextPositionId !== employee.positionId) {
        await tx.employeePositionHistory.create({
          data: {
            employeeId: employee.id,
            previousPositionId: employee.positionId,
            newPositionId: nextPositionId,
            previousDepartmentId: employee.departmentId,
            newDepartmentId: nextDepartmentId ?? employee.departmentId,
            previousBranchId: employee.branchId,
            newBranchId: nextBranchId ?? employee.branchId,
            movementType: EmployeeMovementType.LATERAL,
            effectiveDate,
            reason: "Profile edit: position updated",
            approvedById: context.userId,
            approvedAt: new Date(),
          },
        })
      }

      if (nextRankId !== employee.rankId) {
        const [previousRank, newRank] = await Promise.all([
          employee.rankId
            ? tx.rank.findFirst({
                where: { id: employee.rankId, companyId: context.companyId },
                select: { level: true },
              })
            : Promise.resolve(null),
          nextRankId
            ? tx.rank.findFirst({
                where: { id: nextRankId, companyId: context.companyId },
                select: { level: true },
              })
            : Promise.resolve(null),
        ])

        let movementType: EmployeeMovementType = EmployeeMovementType.LATERAL
        if (previousRank && newRank) {
          if (newRank.level > previousRank.level) {
            movementType = EmployeeMovementType.PROMOTION
          } else if (newRank.level < previousRank.level) {
            movementType = EmployeeMovementType.DEMOTION
          }
        }

        await tx.employeeRankHistory.create({
          data: {
            employeeId: employee.id,
            previousRankId: employee.rankId,
            newRankId: nextRankId,
            movementType,
            effectiveDate,
            reason: "Profile edit: rank updated",
            approvedById: context.userId,
            approvedAt: new Date(),
          },
        })
      }

      await tx.employee.update({
        where: { id: employee.id },
        data: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          middleName: toNullable(payload.middleName),
          suffix: toNullable(payload.suffix),
          maidenName: toNullable(payload.maidenName),
          nickname: toNullable(payload.nickname),
          birthPlace: toNullable(payload.birthPlace),
          birthDate: parsePhDate(payload.birthDate) ?? undefined,
          nationality: toNullable(payload.nationality),
          citizenship: toNullable(payload.citizenship),
          genderId: toGenderEnum(payload.genderId),
          civilStatusId: toCivilStatusEnum(payload.civilStatusId),
          religionId: toReligionEnum(payload.religionId),
          bloodTypeId: toBloodTypeEnum(payload.bloodTypeId),
          heightCm: payload.heightCm?.toString() ?? null,
          weightKg: payload.weightKg?.toString() ?? null,
          hireDate: parsePhDate(payload.hireDate) ?? undefined,
          applicationDate: parsePhDate(payload.applicationDate),
          interviewDate: parsePhDate(payload.interviewDate),
          jobOfferDate: parsePhDate(payload.jobOfferDate),
          probationStartDate: parsePhDate(payload.probationStartDate),
          probationEndDate: parsePhDate(payload.probationEndDate),
          regularizationDate: parsePhDate(payload.regularizationDate),
          contractStartDate: parsePhDate(payload.contractStartDate),
          contractEndDate: parsePhDate(payload.contractEndDate),
          employmentStatusId: nextEmploymentStatusId,
          employmentTypeId: toNullableId(payload.employmentTypeId),
          employmentClassId: toNullableId(payload.employmentClassId),
          departmentId: nextDepartmentId,
          divisionId: toNullableId(payload.divisionId),
          positionId: nextPositionId,
          rankId: nextRankId,
          branchId: nextBranchId,
          reportingManagerId: toNullableId(payload.reportingManagerId),
          workScheduleId: toNullableId(payload.workScheduleId),
          payPeriodPatternId: toNullableId(payload.payPeriodPatternId),
          taxStatusId: toTaxStatusEnum(payload.taxStatusId),
          biometricId: toNullable(payload.biometricId),
          rfidNumber: toNullable(payload.rfidNumber),
          numberOfDependents: payload.numberOfDependents,
          previousEmployerIncome: payload.previousEmployerIncome?.toString() ?? null,
          previousEmployerTaxWithheld: payload.previousEmployerTaxWithheld?.toString() ?? null,
          isSubstitutedFiling: payload.isSubstitutedFiling,
          isOvertimeEligible: payload.isOvertimeEligible,
          isNightDiffEligible: payload.isNightDiffEligible,
          isWfhEligible: payload.isWfhEligible,
          wfhSchedule: toNullable(payload.wfhSchedule),
          updatedById: context.userId,
        },
      })

      const salary = await tx.employeeSalary.findUnique({
        where: { employeeId: employee.id },
        select: { id: true, baseSalary: true },
      })

      if (salary && payload.monthlyRate !== undefined) {
        const previousSalary = salary.baseSalary ? Number(salary.baseSalary) : null
        const nextSalary = payload.monthlyRate

        if (previousSalary === null || Math.abs(previousSalary - nextSalary) > 0.0001) {
          const adjustmentAmount = previousSalary === null ? null : nextSalary - previousSalary
          const adjustmentPercent =
            previousSalary && previousSalary > 0 && adjustmentAmount !== null
              ? (adjustmentAmount / previousSalary) * 100
              : null

          const adjustmentTypeCode =
            adjustmentAmount === null
              ? SalaryAdjustmentType.OTHER
              : adjustmentAmount >= 0
                ? SalaryAdjustmentType.INCREASE
                : SalaryAdjustmentType.DECREASE

          await tx.employeeSalaryHistory.create({
            data: {
              employeeId: employee.id,
              previousSalary,
              newSalary: nextSalary,
              adjustmentTypeCode,
              adjustmentAmount,
              adjustmentPercent,
              effectiveDate,
              reason: "Profile edit: base salary updated",
              approvalStatus: "APPROVED",
              approvedById: context.userId,
              approvedAt: new Date(),
            },
          })
        }
      }

      if (salary) {
        await tx.employeeSalary.update({
          where: { employeeId: employee.id },
          data: {
            ...(payload.monthlyRate !== undefined ? { baseSalary: payload.monthlyRate.toString() } : {}),
            ...(payload.dailyRate !== undefined ? { dailyRate: payload.dailyRate.toString() } : {}),
            ...(payload.hourlyRate !== undefined ? { hourlyRate: payload.hourlyRate.toString() } : {}),
            ...(payload.monthlyDivisor !== undefined ? { monthlyDivisor: payload.monthlyDivisor } : {}),
            ...(payload.hoursPerDay !== undefined ? { hoursPerDay: payload.hoursPerDay.toString() } : {}),
            ...(payload.salaryGrade !== undefined ? { salaryGrade: toNullable(payload.salaryGrade) } : {}),
            ...(payload.salaryBand !== undefined ? { salaryBand: toNullable(payload.salaryBand) } : {}),
            ...(payload.minimumWageRegion !== undefined ? { minimumWageRegion: toNullable(payload.minimumWageRegion) } : {}),
          },
        })
      }

      const governmentUpdates: Array<{ idTypeId: "TIN" | "SSS" | "PHILHEALTH" | "PAGIBIG" | "UMID"; value: string | undefined }> = [
        { idTypeId: "TIN", value: payload.tinNumber },
        { idTypeId: "SSS", value: payload.sssNumber },
        { idTypeId: "PHILHEALTH", value: payload.philHealthNumber },
        { idTypeId: "PAGIBIG", value: payload.pagIbigNumber },
        { idTypeId: "UMID", value: payload.umidNumber },
      ]

      for (const row of governmentUpdates) {
        const cleanValue = row.value?.trim()
        if (!cleanValue) continue

        const existing = await tx.employeeGovernmentId.findFirst({
          where: {
            employeeId: employee.id,
            idTypeId: row.idTypeId,
          },
          select: { id: true },
        })

        if (existing) {
          await tx.employeeGovernmentId.update({
            where: { id: existing.id },
            data: {
              idNumberEncrypted: encodeIdValue(cleanValue),
              idNumberMasked: maskIdValue(cleanValue),
              isActive: true,
            },
          })
        } else {
          await tx.employeeGovernmentId.create({
            data: {
              employeeId: employee.id,
              idTypeId: row.idTypeId,
              idNumberEncrypted: encodeIdValue(cleanValue),
              idNumberMasked: maskIdValue(cleanValue),
              isActive: true,
            },
          })
        }
      }

      const primaryContact = await tx.employeeContact.findFirst({
        where: {
          employeeId: employee.id,
          isPrimary: true,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })

      if (payload.mobileNumber && payload.mobileNumber.trim().length > 0) {
        if (primaryContact) {
          await tx.employeeContact.update({
            where: { id: primaryContact.id },
            data: {
              number: payload.mobileNumber.trim(),
            },
          })
        } else {
          await tx.employeeContact.create({
            data: {
              employeeId: employee.id,
              contactTypeId: "MOBILE",
              countryCode: "+63",
              number: payload.mobileNumber.trim(),
              isPrimary: true,
              isActive: true,
            },
          })
        }
      }

      const primaryEmail = await tx.employeeEmail.findFirst({
        where: {
          employeeId: employee.id,
          emailTypeId: "PERSONAL",
          isPrimary: true,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })

      const personalEmail = payload.personalEmail?.trim()

      if (personalEmail && personalEmail.length > 0) {
        if (primaryEmail) {
          await tx.employeeEmail.update({
            where: { id: primaryEmail.id },
            data: { email: personalEmail },
          })
        } else {
          await tx.employeeEmail.create({
            data: {
              employeeId: employee.id,
              emailTypeId: "PERSONAL",
              email: personalEmail,
              isPrimary: true,
              isActive: true,
            },
          })
        }
      }

      await createAuditLog(
        {
          tableName: "Employee",
          recordId: employee.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_PROFILE_UPDATED",
          changes: [
            { fieldName: "firstName", oldValue: employee.firstName, newValue: payload.firstName },
            { fieldName: "lastName", oldValue: employee.lastName, newValue: payload.lastName },
            { fieldName: "middleName", oldValue: employee.middleName, newValue: payload.middleName ?? null },
            { fieldName: "nickname", oldValue: employee.nickname, newValue: payload.nickname ?? null },
            { fieldName: "maidenName", oldValue: employee.maidenName, newValue: payload.maidenName ?? null },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/employees`)
    revalidatePath(`/${context.companyId}/employees/${payload.employeeId}`)

    return { ok: true, message: "Employee profile updated successfully." }
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return { ok: false, error: "Employee record was not found in the selected company." }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A unique field value already exists. Please review and try again." }
    }

    return { ok: false, error: "Unable to save employee profile right now. Please try again." }
  }
}
