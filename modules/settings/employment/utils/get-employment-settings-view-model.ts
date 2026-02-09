import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

export type EmploymentSettingsViewModel = {
  companyId: string
  companyName: string
  companyCode: string
  companyRole: string
  positions: Array<{
    id: string
    code: string
    name: string
    description: string | null
    level: number
    jobFamily: string | null
    jobGrade: string | null
    salaryGradeMin: number | null
    salaryGradeMax: number | null
    minExperienceYears: number | null
    educationRequired: string | null
    displayOrder: number
    isActive: boolean
  }>
  employmentStatuses: Array<{
    id: string
    code: string
    name: string
    description: string | null
    allowsPayroll: boolean
    allowsLeave: boolean
    allowsLoans: boolean
    triggersOffboarding: boolean
    displayOrder: number
    isActive: boolean
  }>
  employmentTypes: Array<{
    id: string
    code: string
    name: string
    description: string | null
    hasBenefits: boolean
    hasLeaveCredits: boolean
    has13thMonth: boolean
    hasMandatoryDeductions: boolean
    maxContractMonths: number | null
    displayOrder: number
    isActive: boolean
  }>
  employmentClasses: Array<{
    id: string
    code: string
    name: string
    description: string | null
    standardHoursPerDay: number
    standardDaysPerWeek: number
    isOvertimeEligible: boolean
    isHolidayPayEligible: boolean
    displayOrder: number
    isActive: boolean
  }>
}

const toNumber = (value: { toString(): string } | null): number | null => {
  if (!value) {
    return null
  }

  return Number(value.toString())
}

export async function getEmploymentSettingsViewModel(companyId: string): Promise<EmploymentSettingsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    throw new Error("You do not have access to employment settings.")
  }

  const [positions, employmentStatuses, employmentTypes, employmentClasses] = await Promise.all([
    db.position.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        level: true,
        jobFamily: true,
        jobGrade: true,
        salaryGradeMin: true,
        salaryGradeMax: true,
        minExperienceYears: true,
        educationRequired: true,
        displayOrder: true,
        isActive: true,
      },
    }),
    db.employmentStatus.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        allowsPayroll: true,
        allowsLeave: true,
        allowsLoans: true,
        triggersOffboarding: true,
        displayOrder: true,
        isActive: true,
      },
    }),
    db.employmentType.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        hasBenefits: true,
        hasLeaveCredits: true,
        has13thMonth: true,
        hasMandatoryDeductions: true,
        maxContractMonths: true,
        displayOrder: true,
        isActive: true,
      },
    }),
    db.employmentClass.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        standardHoursPerDay: true,
        standardDaysPerWeek: true,
        isOvertimeEligible: true,
        isHolidayPayEligible: true,
        displayOrder: true,
        isActive: true,
      },
    }),
  ])

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    positions: positions.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      level: row.level,
      jobFamily: row.jobFamily,
      jobGrade: row.jobGrade,
      salaryGradeMin: toNumber(row.salaryGradeMin),
      salaryGradeMax: toNumber(row.salaryGradeMax),
      minExperienceYears: row.minExperienceYears,
      educationRequired: row.educationRequired,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
    })),
    employmentStatuses,
    employmentTypes: employmentTypes.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      hasBenefits: row.hasBenefits,
      hasLeaveCredits: row.hasLeaveCredits,
      has13thMonth: row.has13thMonth,
      hasMandatoryDeductions: row.hasMandatoryDeductions,
      maxContractMonths: row.maxContractMonths,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
    })),
    employmentClasses: employmentClasses.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      standardHoursPerDay: Number(row.standardHoursPerDay),
      standardDaysPerWeek: row.standardDaysPerWeek,
      isOvertimeEligible: row.isOvertimeEligible,
      isHolidayPayEligible: row.isHolidayPayEligible,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
    })),
  }
}
