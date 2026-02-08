"use server"

import { BloodType, CivilStatus, Gender, Prisma, Religion, TaxStatus } from "@prisma/client"
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
        },
      })

      if (!employee) {
        throw new Error("EMPLOYEE_NOT_FOUND")
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
          employmentStatusId: toNullableId(payload.employmentStatusId),
          employmentTypeId: toNullableId(payload.employmentTypeId),
          employmentClassId: toNullableId(payload.employmentClassId),
          departmentId: toNullableId(payload.departmentId),
          divisionId: toNullableId(payload.divisionId),
          positionId: toNullableId(payload.positionId),
          rankId: toNullableId(payload.rankId),
          branchId: toNullableId(payload.branchId),
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
        select: { id: true },
      })

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
