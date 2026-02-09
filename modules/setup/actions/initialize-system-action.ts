"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import {
  initializeSystemSchema,
  type InitializeSystemInput,
} from "@/modules/setup/schemas/initialize-system-schema"

type InitializeSystemResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const atTime = (value: string): Date => {
  const [hourString, minuteString] = value.split(":")
  const hour = Number(hourString)
  const minute = Number(minuteString)
  const result = new Date("1970-01-01T00:00:00.000Z")
  result.setUTCHours(hour, minute, 0, 0)
  return result
}

const asDecimalText = (value: number): string => String(value)

export async function initializeSystemAction(
  input: InitializeSystemInput
): Promise<InitializeSystemResult> {
  const parsed = initializeSystemSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    if (firstIssue) {
      return {
        ok: false,
        error: `Invalid setup payload at ${firstIssue.path.join(".")}: ${firstIssue.message}`,
      }
    }

    return { ok: false, error: "Invalid setup payload. Please review all fields." }
  }

  const setup = parsed.data

  const existingSetup = await db.systemSetup.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, isInitialized: true },
  })

  if (existingSetup?.isInitialized) {
    return { ok: false, error: "System is already initialized." }
  }

  const hashedPassword = await bcrypt.hash(setup.admin.password, 12)
  const now = new Date()

  try {
    await db.$transaction(async (tx) => {
      const superAdmin = await tx.user.create({
        data: {
          username: setup.admin.username,
          email: setup.admin.email,
          passwordHash: hashedPassword,
          firstName: setup.admin.firstName,
          lastName: setup.admin.lastName,
          role: "SUPER_ADMIN",
          isAdmin: true,
          isRequestApprover: true,
          preferredTimezone: setup.system.timezone,
        },
      })

      const companyGroup = await tx.companyGroup.create({
        data: {
          code: `${setup.company.code}_GROUP`,
          name: `${setup.company.name} Group`,
          description: "Default company group created by setup wizard",
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      const company = await tx.company.create({
        data: {
          code: setup.company.code,
          name: setup.company.name,
          legalName: setup.company.legalName ?? setup.company.name,
          tinNumber: setup.company.tin,
          rdoCode: setup.company.rdoCode,
          secDtiNumber: setup.company.secDtiNumber,
          sssEmployerNumber: setup.company.sssEmployerNumber,
          philHealthEmployerNumber: setup.company.philHealthEmployerNumber,
          pagIbigEmployerNumber: setup.company.pagIbigEmployerNumber,
          minimumWageRegion: setup.company.minimumWageRegion,
          fiscalYearStartMonth: setup.company.fiscalYearStartMonth,
          defaultCurrency: setup.company.defaultCurrency,
          companyGroupId: companyGroup.id,
          statusCode: "ACTIVE",
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      await tx.userCompanyAccess.create({
        data: {
          userId: superAdmin.id,
          companyId: company.id,
          role: "COMPANY_ADMIN",
          isDefault: true,
          isActive: true,
        },
      })

      await tx.user.update({
        where: { id: superAdmin.id },
        data: {
          selectedCompanyId: company.id,
          lastCompanySwitchedAt: now,
        },
      })

      const regularStatus = await tx.employmentStatus.upsert({
        where: {
          companyId_code: {
            companyId: company.id,
            code: "REGULAR",
          },
        },
        update: {},
        create: {
          companyId: company.id,
          code: "REGULAR",
          name: "Regular",
          allowsPayroll: true,
          allowsLeave: true,
          allowsLoans: true,
          triggersOffboarding: false,
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      await tx.employmentStatus.upsert({
        where: {
          companyId_code: {
            companyId: company.id,
            code: "PROBATIONARY",
          },
        },
        update: {},
        create: {
          companyId: company.id,
          code: "PROBATIONARY",
          name: "Probationary",
          allowsPayroll: true,
          allowsLeave: true,
          allowsLoans: false,
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      await tx.employmentType.upsert({
        where: {
          companyId_code: {
            companyId: company.id,
            code: "FULL_TIME",
          },
        },
        update: {},
        create: {
          companyId: company.id,
          code: "FULL_TIME",
          name: "Full Time",
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      await tx.employmentClass.upsert({
        where: {
          companyId_code: {
            companyId: company.id,
            code: "STANDARD",
          },
        },
        update: {},
        create: {
          companyId: company.id,
          code: "STANDARD",
          name: "Standard",
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      await tx.department.create({
        data: {
          companyId: company.id,
          code: setup.organization.department.code,
          name: setup.organization.department.name,
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      await tx.position.create({
        data: {
          companyId: company.id,
          code: setup.organization.position.code,
          name: setup.organization.position.name,
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      await tx.branch.create({
        data: {
          companyId: company.id,
          code: setup.organization.branch.code,
          name: setup.organization.branch.name,
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      await tx.division.create({
        data: {
          companyId: company.id,
          code: setup.organization.division.code,
          name: setup.organization.division.name,
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      await tx.rank.create({
        data: {
          companyId: company.id,
          code: setup.organization.rank.code,
          name: setup.organization.rank.name,
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      })

      await tx.workSchedule.create({
        data: {
          companyId: company.id,
          code: setup.attendance.workSchedule.code,
          name: setup.attendance.workSchedule.name,
          workStartTime: atTime(setup.attendance.workSchedule.workStartTime),
          workEndTime: atTime(setup.attendance.workSchedule.workEndTime),
          breakStartTime: atTime(setup.attendance.workSchedule.breakStartTime),
          breakEndTime: atTime(setup.attendance.workSchedule.breakEndTime),
          breakDurationMins: setup.attendance.workSchedule.breakDurationMins,
          gracePeriodMins: setup.attendance.workSchedule.gracePeriodMins,
          requiredHoursPerDay: asDecimalText(setup.attendance.workSchedule.requiredHoursPerDay),
          restDays: setup.attendance.workSchedule.restDays,
          dayOverrides: setup.attendance.workSchedule.saturdayHalfDay.enabled
            ? {
                SATURDAY: {
                  workStartTime: setup.attendance.workSchedule.saturdayHalfDay.startTime,
                  workEndTime: setup.attendance.workSchedule.saturdayHalfDay.endTime,
                  requiredHours: setup.attendance.workSchedule.saturdayHalfDay.requiredHours,
                  isRequired: true,
                },
              }
            : undefined,
        },
      })

      await tx.payPeriodPattern.create({
        data: {
          companyId: company.id,
          code: setup.payroll.payPeriodPattern.code,
          name: setup.payroll.payPeriodPattern.name,
          effectiveFrom: now,
          payFrequencyCode: setup.payroll.payPeriodPattern.payFrequencyCode,
        },
      })

      await tx.leaveType.createMany({
        data: setup.leave.leaveTypes.map((leaveType) => ({
          companyId: company.id,
          code: leaveType.code,
          name: leaveType.name,
          description: `${leaveType.name} (setup wizard default)`,
          allowHalfDay: true,
          allowHourly: false,
          requiresApproval: true,
        })),
      })

      const firstLeaveType = await tx.leaveType.findFirst({
        where: { companyId: company.id, code: setup.leave.leaveTypes[0]?.code },
        select: { id: true },
      })

      if (firstLeaveType) {
        await tx.leavePolicy.create({
          data: {
            leaveTypeId: firstLeaveType.id,
            employmentStatusId: regularStatus.id,
            annualEntitlement: asDecimalText(setup.leave.leaveTypes[0].annualEntitlementRegular),
            accrualMethodCode: "MONTHLY",
            prorationMethodCode: "PRORATED_MONTH",
            effectiveFrom: now,
          },
        })
      }

      for (const leaveType of setup.leave.leaveTypes) {
        const createdLeaveType = await tx.leaveType.findFirst({
          where: { companyId: company.id, code: leaveType.code },
          select: { id: true },
        })

        if (!createdLeaveType) {
          continue
        }

        await tx.leavePolicy.upsert({
          where: {
            leaveTypeId_employmentStatusId_effectiveFrom: {
              leaveTypeId: createdLeaveType.id,
              employmentStatusId: regularStatus.id,
              effectiveFrom: now,
            },
          },
          update: {},
          create: {
            leaveTypeId: createdLeaveType.id,
            employmentStatusId: regularStatus.id,
            annualEntitlement: asDecimalText(leaveType.annualEntitlementRegular),
            accrualMethodCode: "MONTHLY",
            prorationMethodCode: "PRORATED_MONTH",
            effectiveFrom: now,
          },
        })

      }

      await tx.holiday.createMany({
        data: setup.holidays.items.map((holiday) => ({
          companyId: holiday.applicability === "COMPANY" ? company.id : null,
          holidayDate: new Date(`${holiday.holidayDate}T00:00:00.000Z`),
          name: holiday.name,
          holidayTypeCode: holiday.holidayTypeCode,
          payMultiplier: asDecimalText(holiday.payMultiplier),
          applicability: holiday.applicability,
          region: holiday.applicability === "REGIONAL" ? holiday.region : null,
        })),
      })

      await tx.loanType.createMany({
        data: setup.loans.loanTypes.map((loanType) => ({
          companyId: company.id,
          code: loanType.code,
          name: loanType.name,
          categoryCode: loanType.categoryCode,
          interestTypeCode: loanType.interestTypeCode,
          defaultInterestRate: asDecimalText(loanType.defaultInterestRate),
          maxTermMonths: loanType.maxTermMonths,
          isActive: true,
        })),
      })

      await tx.earningType.createMany({
        data: setup.compensation.earningTypes.map((earningType) => ({
          companyId: company.id,
          code: earningType.code,
          name: earningType.name,
          isTaxable: earningType.isTaxable,
          isIncludedInGross: earningType.isIncludedInGross,
          isActive: true,
        })),
      })

      await tx.deductionType.createMany({
        data: setup.compensation.deductionTypes.map((deductionType) => ({
          companyId: company.id,
          code: deductionType.code,
          name: deductionType.name,
          isMandatory: deductionType.isMandatory,
          isPreTax: deductionType.isPreTax,
          isActive: true,
        })),
      })

      await tx.overtimeRate.createMany({
        data: setup.attendance.overtimeRates.map((overtimeRate) => ({
          overtimeTypeCode: overtimeRate.overtimeTypeCode,
          rateMultiplier: asDecimalText(overtimeRate.rateMultiplier),
          effectiveFrom: now,
        })),
      })

      await tx.attendanceDeductionRule.createMany({
        data: [
          {
            ruleType: "TARDINESS",
            calculationBasis: "PER_MINUTE",
            thresholdMins: 1,
            deductionRate: "1",
            effectiveFrom: now,
          },
          {
            ruleType: "UNDERTIME",
            calculationBasis: "PER_MINUTE",
            thresholdMins: 1,
            deductionRate: "1",
            effectiveFrom: now,
          },
        ],
      })

      await tx.sSSContributionTable.create({
        data: {
          version: setup.statutory.sss.version,
          salaryBracketMin: "0",
          salaryBracketMax: "999999",
          monthlySalaryCredit: asDecimalText(setup.statutory.sss.monthlySalaryCredit),
          employeeShare: asDecimalText(setup.statutory.sss.employeeShare),
          employerShare: asDecimalText(setup.statutory.sss.employerShare),
          ecContribution: asDecimalText(setup.statutory.sss.ecContribution),
          totalContribution: asDecimalText(
            setup.statutory.sss.employeeShare + setup.statutory.sss.employerShare + setup.statutory.sss.ecContribution
          ),
          effectiveFrom: now,
        },
      })

      await tx.philHealthContributionTable.create({
        data: {
          version: setup.statutory.philHealth.version,
          premiumRate: asDecimalText(setup.statutory.philHealth.premiumRate),
          monthlyFloor: asDecimalText(setup.statutory.philHealth.monthlyFloor),
          monthlyCeiling: asDecimalText(setup.statutory.philHealth.monthlyCeiling),
          employeeSharePercent: asDecimalText(setup.statutory.philHealth.employeeSharePercent),
          employerSharePercent: asDecimalText(setup.statutory.philHealth.employerSharePercent),
          effectiveFrom: now,
        },
      })

      await tx.pagIBIGContributionTable.create({
        data: {
          version: setup.statutory.pagIbig.version,
          salaryBracketMin: "0",
          salaryBracketMax: "999999",
          employeeRatePercent: asDecimalText(setup.statutory.pagIbig.employeeRatePercent),
          employerRatePercent: asDecimalText(setup.statutory.pagIbig.employerRatePercent),
          maxMonthlyCompensation: asDecimalText(setup.statutory.pagIbig.maxMonthlyCompensation),
          effectiveFrom: now,
        },
      })

      await tx.taxTable.create({
        data: {
          version: setup.statutory.tax.version,
          taxTableTypeCode: "MONTHLY",
          bracketOver: "0",
          bracketNotOver: asDecimalText(setup.statutory.tax.monthlyExemptThreshold),
          baseTax: "0",
          taxRatePercent: "0",
          excessOver: "0",
          effectiveYear: now.getUTCFullYear(),
          effectiveFrom: now,
        },
      })

      await tx.systemConfig.createMany({
        data: [
          {
            key: "timezone.default",
            value: setup.system.timezone,
            dataType: "STRING",
            description: "Default timezone",
            category: "system",
            createdById: superAdmin.id,
            updatedById: superAdmin.id,
          },
          {
            key: "payroll.currency.default",
            value: setup.company.defaultCurrency,
            dataType: "STRING",
            description: "Default payroll currency",
            category: "payroll",
            createdById: superAdmin.id,
            updatedById: superAdmin.id,
          },
          {
            key: "authz.roleModulePolicy",
            value: JSON.stringify(setup.system.roleModulePolicy),
            dataType: "JSON",
            description: "Module access policy map configured during setup",
            category: "authorization",
            createdById: superAdmin.id,
            updatedById: superAdmin.id,
          },
        ],
      })

      if (existingSetup?.id) {
        await tx.systemSetup.update({
          where: { id: existingSetup.id },
          data: {
            isInitialized: true,
            setupCompletedAt: now,
            setupCompletedById: superAdmin.id,
            adminUserCreated: true,
            companyCreated: true,
            governmentIdsSet: true,
            payPeriodConfigured: true,
            workScheduleConfigured: true,
            contributionTablesLoaded: true,
            taxTablesLoaded: true,
            defaultLookupsCreated: true,
            currentStep: 8,
            totalSteps: 8,
          },
        })
      } else {
        await tx.systemSetup.create({
          data: {
            isInitialized: true,
            setupCompletedAt: now,
            setupCompletedById: superAdmin.id,
            adminUserCreated: true,
            companyCreated: true,
            governmentIdsSet: true,
            payPeriodConfigured: true,
            workScheduleConfigured: true,
            contributionTablesLoaded: true,
            taxTablesLoaded: true,
            defaultLookupsCreated: true,
            currentStep: 8,
            totalSteps: 8,
          },
        })
      }
    })

    revalidatePath("/")
    revalidatePath("/setup")
    revalidatePath("/setup/summary")

    return { ok: true, message: "System setup completed successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown setup error"
    return { ok: false, error: `Setup failed: ${message}` }
  }
}
