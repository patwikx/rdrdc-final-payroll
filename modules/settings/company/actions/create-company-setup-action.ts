"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly } from "@/lib/ph-time"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  createCompanySetupInputSchema,
  type CreateCompanySetupInput,
} from "@/modules/settings/company/schemas/create-company-setup-schema"

type CreateCompanySetupActionResult =
  | {
      ok: true
      message: string
      companyId: string
    }
  | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  return value
}

const toCompanyCode = (value: string): string => {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
}

const parsePhDate = (value: string | undefined): Date | null => {
  if (!value) {
    return null
  }

  return parsePhDateInputToUtcDateOnly(value)
}

const atTime = (value: string): Date => {
  const [hourString, minuteString] = value.split(":")
  const hour = Number(hourString)
  const minute = Number(minuteString)
  const result = new Date("1970-01-01T00:00:00.000Z")
  result.setUTCHours(hour, minute, 0, 0)
  return result
}

const asDecimalText = (value: number): string => String(value)

const seedCompanyDefaults = async (
  tx: Prisma.TransactionClient,
  params: { companyId: string; userId: string }
): Promise<void> => {
  const now = new Date()

  const regularStatus = await tx.employmentStatus.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "REGULAR",
      },
    },
    update: {
      isActive: true,
      allowsPayroll: true,
      allowsLeave: true,
      allowsLoans: true,
      triggersOffboarding: false,
      updatedById: params.userId,
    },
    create: {
      companyId: params.companyId,
      code: "REGULAR",
      name: "Regular",
      allowsPayroll: true,
      allowsLeave: true,
      allowsLoans: true,
      triggersOffboarding: false,
      createdById: params.userId,
      updatedById: params.userId,
    },
  })

  await tx.employmentStatus.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "PROBATIONARY",
      },
    },
    update: {
      isActive: true,
      allowsPayroll: true,
      allowsLeave: true,
      allowsLoans: false,
      updatedById: params.userId,
    },
    create: {
      companyId: params.companyId,
      code: "PROBATIONARY",
      name: "Probationary",
      allowsPayroll: true,
      allowsLeave: true,
      allowsLoans: false,
      createdById: params.userId,
      updatedById: params.userId,
    },
  })

  await tx.employmentType.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "FULL_TIME",
      },
    },
    update: {
      isActive: true,
      updatedById: params.userId,
    },
    create: {
      companyId: params.companyId,
      code: "FULL_TIME",
      name: "Full Time",
      createdById: params.userId,
      updatedById: params.userId,
    },
  })

  await tx.employmentClass.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "STANDARD",
      },
    },
    update: {
      isActive: true,
      updatedById: params.userId,
    },
    create: {
      companyId: params.companyId,
      code: "STANDARD",
      name: "Standard",
      createdById: params.userId,
      updatedById: params.userId,
    },
  })

  await tx.department.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "ADMIN",
      },
    },
    update: {
      name: "Administration",
      isActive: true,
      updatedById: params.userId,
    },
    create: {
      companyId: params.companyId,
      code: "ADMIN",
      name: "Administration",
      createdById: params.userId,
      updatedById: params.userId,
    },
  })

  await tx.position.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "STAFF",
      },
    },
    update: {
      name: "Staff",
      isActive: true,
      updatedById: params.userId,
    },
    create: {
      companyId: params.companyId,
      code: "STAFF",
      name: "Staff",
      createdById: params.userId,
      updatedById: params.userId,
    },
  })

  await tx.branch.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "MAIN",
      },
    },
    update: {
      name: "Main Branch",
      isActive: true,
      updatedById: params.userId,
    },
    create: {
      companyId: params.companyId,
      code: "MAIN",
      name: "Main Branch",
      createdById: params.userId,
      updatedById: params.userId,
    },
  })

  await tx.division.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "CORP",
      },
    },
    update: {
      name: "Corporate",
      isActive: true,
      updatedById: params.userId,
    },
    create: {
      companyId: params.companyId,
      code: "CORP",
      name: "Corporate",
      createdById: params.userId,
      updatedById: params.userId,
    },
  })

  await tx.rank.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "R1",
      },
    },
    update: {
      name: "Rank 1",
      isActive: true,
      updatedById: params.userId,
    },
    create: {
      companyId: params.companyId,
      code: "R1",
      name: "Rank 1",
      createdById: params.userId,
      updatedById: params.userId,
    },
  })

  await tx.workSchedule.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "REG_DAY",
      },
    },
    update: {
      isActive: true,
      name: "Regular Day Shift",
      workStartTime: atTime("08:00"),
      workEndTime: atTime("17:00"),
      breakStartTime: atTime("12:00"),
      breakEndTime: atTime("13:00"),
      breakDurationMins: 60,
      gracePeriodMins: 10,
      requiredHoursPerDay: asDecimalText(8),
      restDays: ["SATURDAY", "SUNDAY"],
      dayOverrides: {
        SATURDAY: {
          workStartTime: "08:00",
          workEndTime: "12:00",
          requiredHours: 4,
          isRequired: true,
        },
      },
    },
    create: {
      companyId: params.companyId,
      code: "REG_DAY",
      name: "Regular Day Shift",
      workStartTime: atTime("08:00"),
      workEndTime: atTime("17:00"),
      breakStartTime: atTime("12:00"),
      breakEndTime: atTime("13:00"),
      breakDurationMins: 60,
      gracePeriodMins: 10,
      requiredHoursPerDay: asDecimalText(8),
      restDays: ["SATURDAY", "SUNDAY"],
      dayOverrides: {
        SATURDAY: {
          workStartTime: "08:00",
          workEndTime: "12:00",
          requiredHours: 4,
          isRequired: true,
        },
      },
    },
  })

  await tx.payPeriodPattern.upsert({
    where: {
      companyId_code: {
        companyId: params.companyId,
        code: "SEMI_MONTHLY_DEFAULT",
      },
    },
    update: {
      name: "Semi-Monthly Default",
      payFrequencyCode: "SEMI_MONTHLY",
      periodsPerYear: 24,
      paymentDayOffset: 0,
      isActive: true,
    },
    create: {
      companyId: params.companyId,
      code: "SEMI_MONTHLY_DEFAULT",
      name: "Semi-Monthly Default",
      payFrequencyCode: "SEMI_MONTHLY",
      periodsPerYear: 24,
      paymentDayOffset: 0,
      effectiveFrom: now,
      isActive: true,
    },
  })

  const leaveTypes: Array<{ code: string; name: string; isPaid: boolean; annualEntitlement: number }> = [
    { code: "VL", name: "Vacation Leave", isPaid: true, annualEntitlement: 10 },
    { code: "SL", name: "Sick Leave", isPaid: true, annualEntitlement: 10 },
    { code: "LWOP", name: "Leave Without Pay", isPaid: false, annualEntitlement: 0 },
  ]

  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
    }).format(now)
  )
  const defaultPolicyEffectiveFrom = new Date(Date.UTC(currentYear, 0, 1))

  for (const leaveType of leaveTypes) {
    const createdLeaveType = await tx.leaveType.upsert({
      where: {
        companyId_code: {
          companyId: params.companyId,
          code: leaveType.code,
        },
      },
      update: {
        name: leaveType.name,
        isPaid: leaveType.isPaid,
        requiresApproval: true,
        allowHalfDay: true,
        allowHourly: false,
        isActive: true,
      },
      create: {
        companyId: params.companyId,
        code: leaveType.code,
        name: leaveType.name,
        isPaid: leaveType.isPaid,
        requiresApproval: true,
        allowHalfDay: true,
        allowHourly: false,
        isActive: true,
      },
    })

    await tx.leavePolicy.upsert({
      where: {
        leaveTypeId_employmentStatusId_effectiveFrom: {
          leaveTypeId: createdLeaveType.id,
          employmentStatusId: regularStatus.id,
          effectiveFrom: defaultPolicyEffectiveFrom,
        },
      },
      update: {
        annualEntitlement: asDecimalText(leaveType.annualEntitlement),
        accrualMethodCode: "MONTHLY",
        prorationMethodCode: "PRORATED_MONTH",
        isActive: true,
      },
      create: {
        leaveTypeId: createdLeaveType.id,
        employmentStatusId: regularStatus.id,
        annualEntitlement: asDecimalText(leaveType.annualEntitlement),
        accrualMethodCode: "MONTHLY",
        prorationMethodCode: "PRORATED_MONTH",
        effectiveFrom: defaultPolicyEffectiveFrom,
        isActive: true,
      },
    })
  }

  const earningTypes: Array<{ code: string; name: string; isTaxable: boolean; isIncludedInGross: boolean }> = [
    { code: "BASIC_PAY", name: "Basic Pay", isTaxable: true, isIncludedInGross: true },
    { code: "OVERTIME", name: "Overtime Pay", isTaxable: true, isIncludedInGross: true },
    { code: "NIGHT_DIFF", name: "Night Differential", isTaxable: true, isIncludedInGross: true },
    { code: "HOLIDAY_PAY", name: "Holiday Pay", isTaxable: true, isIncludedInGross: true },
  ]

  for (const earningType of earningTypes) {
    await tx.earningType.upsert({
      where: {
        companyId_code: {
          companyId: params.companyId,
          code: earningType.code,
        },
      },
      update: {
        name: earningType.name,
        isTaxable: earningType.isTaxable,
        isIncludedInGross: earningType.isIncludedInGross,
        isActive: true,
        updatedById: params.userId,
      },
      create: {
        companyId: params.companyId,
        code: earningType.code,
        name: earningType.name,
        isTaxable: earningType.isTaxable,
        isIncludedInGross: earningType.isIncludedInGross,
        isActive: true,
        createdById: params.userId,
        updatedById: params.userId,
      },
    })
  }

  const deductionTypes: Array<{ code: string; name: string; isPreTax: boolean; payPeriodApplicability: string }> = [
    { code: "SSS", name: "SSS Contribution", isPreTax: true, payPeriodApplicability: "SECOND_HALF" },
    { code: "PHILHEALTH", name: "PhilHealth Contribution", isPreTax: true, payPeriodApplicability: "FIRST_HALF" },
    { code: "PAGIBIG", name: "Pag-IBIG Contribution", isPreTax: true, payPeriodApplicability: "FIRST_HALF" },
    { code: "WHTAX", name: "Withholding Tax", isPreTax: false, payPeriodApplicability: "EVERY_PAYROLL" },
  ]

  for (const deductionType of deductionTypes) {
    await tx.deductionType.upsert({
      where: {
        companyId_code: {
          companyId: params.companyId,
          code: deductionType.code,
        },
      },
      update: {
        name: deductionType.name,
        isMandatory: true,
        isPreTax: deductionType.isPreTax,
        payPeriodApplicability: deductionType.payPeriodApplicability,
        isActive: true,
        updatedById: params.userId,
      },
      create: {
        companyId: params.companyId,
        code: deductionType.code,
        name: deductionType.name,
        isMandatory: true,
        isPreTax: deductionType.isPreTax,
        payPeriodApplicability: deductionType.payPeriodApplicability,
        isActive: true,
        createdById: params.userId,
        updatedById: params.userId,
      },
    })
  }
}

export async function createCompanySetupAction(
  input: CreateCompanySetupInput
): Promise<CreateCompanySetupActionResult> {
  const parsed = createCompanySetupInputSchema.safeParse(input)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: issue ? `Invalid company setup at ${issue.path.join(".")}: ${issue.message}` : "Invalid company setup payload.",
    }
  }

  const payload = parsed.data
  const session = await auth()
  const context = await getActiveCompanyContext({ companyId: payload.sourceCompanyId })
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  if (!isSuperAdmin && !hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to create a new company." }
  }

  if (!isSuperAdmin && context.companyRole !== "COMPANY_ADMIN") {
    return { ok: false, error: "Only Company Admin can create another company." }
  }

  const normalizedCode = toCompanyCode(payload.company.code)
  const existingByCode = await db.company.findUnique({
    where: { code: normalizedCode },
    select: { id: true, name: true },
  })

  if (existingByCode) {
    return { ok: false, error: `Company code "${normalizedCode}" is already used by ${existingByCode.name}.` }
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          code: normalizedCode,
          name: payload.company.name.trim(),
          legalName: toNullable(payload.company.legalName),
          tradeName: toNullable(payload.company.tradeName),
          abbreviation: toNullable(payload.company.abbreviation),
          secDtiNumber: toNullable(payload.company.secDtiNumber),
          dateOfIncorporation: parsePhDate(payload.company.dateOfIncorporation),
          tinNumber: toNullable(payload.company.tinNumber),
          rdoCode: toNullable(payload.company.rdoCode),
          sssEmployerNumber: toNullable(payload.company.sssEmployerNumber),
          philHealthEmployerNumber: toNullable(payload.company.philHealthEmployerNumber),
          pagIbigEmployerNumber: toNullable(payload.company.pagIbigEmployerNumber),
          industryCode: payload.company.industryCode ?? null,
          companySizeCode: payload.company.companySizeCode ?? null,
          statusCode: payload.company.statusCode ?? "ACTIVE",
          companyGroupId: toNullable(payload.company.companyGroupId),
          parentCompanyId: toNullable(payload.company.parentCompanyId),
          websiteUrl: toNullable(payload.company.websiteUrl),
          payslipWatermarkText: toNullable(payload.company.payslipWatermarkText),
          fiscalYearStartMonth: payload.company.fiscalYearStartMonth,
          defaultCurrency: payload.company.defaultCurrency.toUpperCase(),
          minimumWageRegion: toNullable(payload.company.minimumWageRegion),
          createdById: context.userId,
          updatedById: context.userId,
          isActive: (payload.company.statusCode ?? "ACTIVE") === "ACTIVE",
        },
      })

      await tx.companyAddress.create({
        data: {
          companyId: company.id,
          addressTypeId: payload.primaryAddress.addressTypeId,
          street: toNullable(payload.primaryAddress.street),
          barangay: toNullable(payload.primaryAddress.barangay),
          city: toNullable(payload.primaryAddress.city),
          municipality: toNullable(payload.primaryAddress.municipality),
          province: toNullable(payload.primaryAddress.province),
          region: toNullable(payload.primaryAddress.region),
          postalCode: toNullable(payload.primaryAddress.postalCode),
          country: payload.primaryAddress.country,
          isPrimary: true,
          isActive: true,
        },
      })

      await tx.companyContact.create({
        data: {
          companyId: company.id,
          contactTypeId: payload.primaryContact.contactTypeId,
          countryCode: toNullable(payload.primaryContact.countryCode) ?? "+63",
          areaCode: toNullable(payload.primaryContact.areaCode),
          number: payload.primaryContact.number,
          extension: toNullable(payload.primaryContact.extension),
          isPrimary: true,
          isActive: true,
        },
      })

      await tx.companyEmail.create({
        data: {
          companyId: company.id,
          emailTypeId: payload.primaryEmail.emailTypeId,
          email: payload.primaryEmail.email,
          isPrimary: true,
          isActive: true,
        },
      })

      if (payload.defaults.initializeDefaults) {
        await seedCompanyDefaults(tx, { companyId: company.id, userId: context.userId })
      }

      if (payload.defaults.grantCreatorAccess) {
        await tx.userCompanyAccess.upsert({
          where: {
            userId_companyId: {
              userId: context.userId,
              companyId: company.id,
            },
          },
          update: {
            role: "COMPANY_ADMIN",
            isActive: true,
          },
          create: {
            userId: context.userId,
            companyId: company.id,
            role: "COMPANY_ADMIN",
            isDefault: false,
            isActive: true,
          },
        })

        if (payload.defaults.switchToNewCompany) {
          const switchedAt = new Date()
          await tx.user.update({
            where: { id: context.userId },
            data: {
              selectedCompanyId: company.id,
              lastCompanySwitchedAt: switchedAt,
            },
          })
        }
      }

      await createAuditLog(
        {
          tableName: "Company",
          recordId: company.id,
          action: "CREATE",
          userId: context.userId,
          reason: "COMPANY_CREATED_FROM_SETUP_WIZARD",
          changes: [
            { fieldName: "code", newValue: company.code },
            { fieldName: "name", newValue: company.name },
            { fieldName: "statusCode", newValue: company.statusCode },
            { fieldName: "companyGroupId", newValue: company.companyGroupId },
            { fieldName: "parentCompanyId", newValue: company.parentCompanyId },
            { fieldName: "initializeDefaults", newValue: payload.defaults.initializeDefaults },
            { fieldName: "grantCreatorAccess", newValue: payload.defaults.grantCreatorAccess },
          ],
        },
        tx
      )

      return company
    })

    revalidatePath(`/${context.companyId}/settings/company`)
    revalidatePath(`/${context.companyId}/dashboard`)
    revalidatePath(`/${created.id}/settings/company`)

    return {
      ok: true,
      message: `Company ${created.name} (${created.code}) created successfully.`,
      companyId: created.id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to create company: ${message}` }
  }
}
