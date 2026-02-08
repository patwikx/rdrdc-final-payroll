"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  employeeOnboardingInputSchema,
  type EmployeeOnboardingInput,
} from "@/modules/employees/onboarding/schemas/employee-onboarding-schema"

type CreateEmployeeOnboardingActionResult =
  | { ok: true; message: string; employeeId: string }
  | { ok: false; error: string }

const fieldLabelMap: Record<string, string> = {
  "identity.employeeNumber": "Employee Number",
  "identity.firstName": "First Name",
  "identity.lastName": "Last Name",
  "identity.birthDate": "Birth Date",
  "identity.genderId": "Gender",
  "contact.mobileNumber": "Mobile Number",
  "contact.personalEmail": "Personal Email",
  "employment.hireDate": "Hire Date",
  "employment.employmentStatusId": "Employment Status",
  "employment.employmentTypeId": "Employment Type",
  "employment.employmentClassId": "Employment Class",
  "employment.departmentId": "Department",
  "employment.positionId": "Position",
  "payroll.monthlyRate": "Monthly Rate",
  "payroll.workScheduleId": "Work Schedule",
  "payroll.payPeriodPatternId": "Pay Period Pattern",
  "tax.taxStatusId": "Tax Status",
}

const sectionLabelMap: Record<string, string> = {
  identity: "Identity",
  contact: "Contact",
  employment: "Employment",
  payroll: "Payroll",
  tax: "Tax",
  uploads: "Uploads",
}

const toHumanLabel = (value: string): string => {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\bid\b/i, "ID")
    .replace(/\burl\b/i, "URL")
    .replace(/\bsss\b/i, "SSS")
    .replace(/\btin\b/i, "TIN")
    .replace(/\bwfh\b/i, "WFH")
    .replace(/\bpag\sibig\b/i, "Pag-IBIG")
    .replace(/\bphil\shealth\b/i, "PhilHealth")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (match) => match.toUpperCase())
}

const getFriendlyValidationError = (
  issue: { path: Array<string | number | symbol>; message: string; code?: string }
): string => {
  const normalizedPath = issue.path
    .map((part) => (typeof part === "symbol" ? String(part) : String(part)))
  const key = normalizedPath.join(".")
  const label = fieldLabelMap[key]
  const fallbackLabel = normalizedPath.length > 0 ? toHumanLabel(normalizedPath[normalizedPath.length - 1]) : "This field"
  const section = normalizedPath[0] ? sectionLabelMap[normalizedPath[0]] : undefined
  const finalLabel = label ?? fallbackLabel
  const sectionHint = section ? ` in the ${section} section` : ""

  if (issue.code === "invalid_type" || issue.code === "too_small") {
    return `${finalLabel} is required${sectionHint}.`
  }

  if (issue.code === "invalid_string" || issue.message.toLowerCase().includes("email")) {
    return `Please enter a valid ${finalLabel.toLowerCase()}${sectionHint}.`
  }

  if (issue.code === "invalid_enum_value" || issue.message.toLowerCase().includes("invalid uuid")) {
    return `Please select a valid ${finalLabel.toLowerCase()}${sectionHint}.`
  }

  return `Please check ${finalLabel.toLowerCase()}${sectionHint} and try again.`
}

const parsePhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

const encodeIdValue = (value: string): string => {
  return Buffer.from(value, "utf8").toString("base64")
}

const maskIdValue = (value: string): string => {
  const tail = value.slice(-4)
  return `${"*".repeat(Math.max(0, value.length - 4))}${tail}`
}

export async function createEmployeeOnboardingAction(
  input: EmployeeOnboardingInput
): Promise<CreateEmployeeOnboardingActionResult> {
  const parsed = employeeOnboardingInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? getFriendlyValidationError({ path: firstIssue.path, message: firstIssue.message, code: firstIssue.code })
        : "Please review the onboarding form and complete all required fields.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return { ok: false, error: "You do not have permission to create employees in this company." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Selected company does not match your active session. Please reload and try again." }
  }

  try {
    const employeeId = await db.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          companyId: context.companyId,
          employeeNumber: payload.identity.employeeNumber,
          firstName: payload.identity.firstName,
          middleName: payload.identity.middleName ?? null,
          lastName: payload.identity.lastName,
          suffix: payload.identity.suffix ?? null,
          nickname: payload.identity.nickname ?? null,
          birthDate: parsePhDate(payload.identity.birthDate),
          birthPlace: payload.identity.birthPlace ?? null,
          genderId: payload.identity.genderId,
          civilStatusId: payload.identity.civilStatusId ?? null,
          nationality: payload.identity.nationality ?? null,
          citizenship: payload.identity.citizenship ?? null,
          photoUrl: payload.uploads.profilePhotoDataUrl ?? null,

          hireDate: parsePhDate(payload.employment.hireDate),
          employmentStatusId: payload.employment.employmentStatusId,
          employmentTypeId: payload.employment.employmentTypeId,
          employmentClassId: payload.employment.employmentClassId,
          departmentId: payload.employment.departmentId,
          divisionId: payload.employment.divisionId ?? null,
          positionId: payload.employment.positionId,
          rankId: payload.employment.rankId ?? null,
          branchId: payload.employment.branchId ?? null,
          reportingManagerId: payload.employment.reportingManagerId ?? null,
          probationEndDate: payload.employment.probationEndDate ? parsePhDate(payload.employment.probationEndDate) : null,
          regularizationDate: payload.employment.regularizationDate ? parsePhDate(payload.employment.regularizationDate) : null,

          workScheduleId: payload.payroll.workScheduleId,
          payPeriodPatternId: payload.payroll.payPeriodPatternId,
          isNightDiffEligible: payload.payroll.isNightDiffEligible,
          isOvertimeEligible: payload.payroll.isOvertimeEligible,
          isWfhEligible: payload.payroll.isWfhEligible,
          wfhSchedule: payload.payroll.wfhSchedule ?? null,

          taxStatusId: payload.tax.taxStatusId,
          numberOfDependents: payload.tax.numberOfDependents,
          isSubstitutedFiling: payload.tax.isSubstitutedFiling,
          previousEmployerIncome: payload.tax.previousEmployerIncome ?? null,
          previousEmployerTaxWithheld: payload.tax.previousEmployerTaxWithheld ?? null,

          rehireNotes: payload.tax.notes ?? null,

          isActive: true,
          createdById: context.userId,
          updatedById: context.userId,
        },
        select: { id: true },
      })

      await tx.employeeContact.create({
        data: {
          employeeId: employee.id,
          contactTypeId: "MOBILE",
          countryCode: "+63",
          number: payload.contact.mobileNumber,
          isPrimary: true,
          isActive: true,
        },
      })

      await tx.employeeEmail.createMany({
        data: [
          {
            employeeId: employee.id,
            emailTypeId: "PERSONAL",
            email: payload.contact.personalEmail,
            isPrimary: true,
            isActive: true,
          },
          ...(payload.contact.workEmail
            ? [
                {
                  employeeId: employee.id,
                  emailTypeId: "WORK" as const,
                  email: payload.contact.workEmail,
                  isPrimary: false,
                  isActive: true,
                },
              ]
            : []),
        ],
      })

      if (payload.contact.street || payload.contact.barangay || payload.contact.city || payload.contact.province || payload.contact.postalCode) {
        await tx.employeeAddress.create({
          data: {
            employeeId: employee.id,
            addressTypeId: "HOME",
            street: payload.contact.street ?? null,
            barangay: payload.contact.barangay ?? null,
            city: payload.contact.city ?? null,
            province: payload.contact.province ?? null,
            postalCode: payload.contact.postalCode ?? null,
            country: "Philippines",
            isPrimary: true,
            isActive: true,
          },
        })
      }

      await tx.employeeSalary.create({
        data: {
          employeeId: employee.id,
          baseSalary: payload.payroll.monthlyRate.toString(),
          salaryRateTypeCode: "MONTHLY",
          monthlyDivisor: payload.payroll.monthlyDivisor,
          hoursPerDay: payload.payroll.hoursPerDay.toString(),
          minimumWageRegion: payload.payroll.minimumWageRegion ?? null,
          effectiveDate: parsePhDate(payload.employment.hireDate),
          isActive: true,
        },
      })

      if (payload.contact.emergencyContactName && payload.contact.emergencyRelationshipId) {
        await tx.employeeEmergencyContact.create({
          data: {
            employeeId: employee.id,
            name: payload.contact.emergencyContactName,
            relationshipId: payload.contact.emergencyRelationshipId,
            mobileNumber: payload.contact.emergencyContactNumber ?? null,
            priority: 1,
            isActive: true,
          },
        })
      }

      const governmentIdRows: Array<{ idTypeId: "TIN" | "SSS" | "PHILHEALTH" | "PAGIBIG"; idNumber: string }> = []

      if (payload.tax.tin) governmentIdRows.push({ idTypeId: "TIN", idNumber: payload.tax.tin })
      if (payload.tax.sssNumber) governmentIdRows.push({ idTypeId: "SSS", idNumber: payload.tax.sssNumber })
      if (payload.tax.philHealthNumber) governmentIdRows.push({ idTypeId: "PHILHEALTH", idNumber: payload.tax.philHealthNumber })
      if (payload.tax.pagIbigNumber) governmentIdRows.push({ idTypeId: "PAGIBIG", idNumber: payload.tax.pagIbigNumber })

      if (governmentIdRows.length > 0) {
        await tx.employeeGovernmentId.createMany({
          data: governmentIdRows.map((row) => ({
            employeeId: employee.id,
            idTypeId: row.idTypeId,
            idNumberEncrypted: encodeIdValue(row.idNumber),
            idNumberMasked: maskIdValue(row.idNumber),
            isActive: true,
          })),
        })
      }

      if (payload.uploads.scannedDocuments.length > 0) {
        await tx.employeeDocument.createMany({
          data: payload.uploads.scannedDocuments.map((document) => ({
            employeeId: employee.id,
            documentTypeId: document.documentTypeId,
            title: document.title,
            description: null,
            fileName: document.fileName,
            fileUrl: document.fileDataUrl,
            fileType: document.fileType,
            fileSize: document.fileSize,
            isActive: true,
            createdById: context.userId,
            uploadedById: context.userId,
          })),
        })
      }

      await createAuditLog(
        {
          tableName: "Employee",
          recordId: employee.id,
          action: "CREATE",
          userId: context.userId,
          reason: "EMPLOYEE_ONBOARDED",
          changes: [
            { fieldName: "employeeNumber", newValue: payload.identity.employeeNumber },
            { fieldName: "firstName", newValue: payload.identity.firstName },
            { fieldName: "lastName", newValue: payload.identity.lastName },
            { fieldName: "hireDate", newValue: payload.employment.hireDate },
            { fieldName: "monthlyRate", newValue: payload.payroll.monthlyRate },
            { fieldName: "documents.count", newValue: payload.uploads.scannedDocuments.length },
          ],
        },
        tx
      )

      return employee.id
    })

    revalidatePath(`/${context.companyId}/employees/onboarding`)
    revalidatePath(`/${context.companyId}/employees/master-list`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return {
      ok: true,
      message: `Employee ${payload.identity.firstName} ${payload.identity.lastName} onboarded successfully.`,
      employeeId,
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Employee Number already exists. Please use a different Employee Number." }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        ok: false,
        error: "Some selected references are invalid (for example Department, Position, or Work Schedule). Please reselect and try again.",
      }
    }

    return { ok: false, error: "Unable to create employee right now. Please try again in a moment." }
  }
}
