import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import {
  civilStatusOptions,
  type EmployeeOnboardingInput,
  genderOptions,
  relationshipOptions,
  taxStatusOptions,
} from "@/modules/employees/onboarding/schemas/employee-onboarding-schema"

type Option = {
  id: string
  code: string
  name: string
}

export type EmployeeOnboardingViewModel = {
  companyName: string
  companyCode: string
  companyRole: string
  options: {
    employmentStatuses: Option[]
    employmentTypes: Option[]
    employmentClasses: Option[]
    departments: Option[]
    divisions: Option[]
    positions: Option[]
    ranks: Option[]
    branches: Option[]
    managers: Option[]
    workSchedules: Option[]
    payPeriodPatterns: Option[]
    genders: Array<{ id: (typeof genderOptions)[number]; name: string }>
    civilStatuses: Array<{ id: (typeof civilStatusOptions)[number]; name: string }>
    relationships: Array<{ id: (typeof relationshipOptions)[number]; name: string }>
    taxStatuses: Array<{ id: (typeof taxStatusOptions)[number]; name: string }>
  }
  form: EmployeeOnboardingInput
}

const toDateInputValue = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const getTaxStatusLabel = (code: (typeof taxStatusOptions)[number]): string => {
  switch (code) {
    case "S":
      return "Single"
    case "S1":
      return "Single with 1 dependent"
    case "S2":
      return "Single with 2 dependents"
    case "S3":
      return "Single with 3 dependents"
    case "S4":
      return "Single with 4 dependents"
    case "ME":
      return "Married"
    case "ME1":
      return "Married with 1 dependent"
    case "ME2":
      return "Married with 2 dependents"
    case "ME3":
      return "Married with 3 dependents"
    case "ME4":
      return "Married with 4 dependents"
    case "Z":
      return "Zero exemption"
    default:
      return code
  }
}

const startOfPhDate = (): string => {
  return toDateInputValue(new Date())
}

export async function getEmployeeOnboardingViewModel(companyId: string): Promise<EmployeeOnboardingViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const [employmentStatuses, employmentTypes, employmentClasses, departments, divisions, positions, ranks, branches, managers, workSchedules, payPeriodPatterns] =
    await Promise.all([
      db.employmentStatus.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.employmentType.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.employmentClass.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.department.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.division.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.position.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.rank.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.branch.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.employee.findMany({
        where: { companyId: context.companyId, isActive: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, employeeNumber: true, firstName: true, lastName: true },
        take: 200,
      }),
      db.workSchedule.findMany({
        where: {
          OR: [{ companyId: context.companyId }, { companyId: null }],
          isActive: true,
        },
        orderBy: { name: "asc" },
      }),
      db.payPeriodPattern.findMany({
        where: {
          OR: [{ companyId: context.companyId }, { companyId: null }],
          isActive: true,
        },
        orderBy: { name: "asc" },
      }),
    ])

  const map = (rows: Array<{ id: string; code: string; name: string }>): Option[] => rows.map((row) => ({ id: row.id, code: row.code, name: row.name }))

  const today = startOfPhDate()

  return {
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    options: {
      employmentStatuses: map(employmentStatuses),
      employmentTypes: map(employmentTypes),
      employmentClasses: map(employmentClasses),
      departments: map(departments),
      divisions: map(divisions),
      positions: map(positions),
      ranks: map(ranks),
      branches: map(branches),
      managers: managers.map((row) => ({
        id: row.id,
        code: row.employeeNumber,
        name: `${row.lastName}, ${row.firstName}`,
      })),
      workSchedules: map(workSchedules),
      payPeriodPatterns: map(payPeriodPatterns),
      genders: genderOptions.map((id) => ({ id, name: id.replace(/_/g, " ") })),
      civilStatuses: civilStatusOptions.map((id) => ({ id, name: id.replace(/_/g, " ") })),
      relationships: relationshipOptions.map((id) => ({ id, name: id.replace(/_/g, " ") })),
      taxStatuses: taxStatusOptions.map((id) => ({ id, name: getTaxStatusLabel(id) })),
    },
    form: {
      companyId: context.companyId,
      identity: {
        employeeNumber: "",
        firstName: "",
        middleName: undefined,
        lastName: "",
        suffix: undefined,
        nickname: undefined,
        birthDate: today,
        birthPlace: undefined,
        genderId: "MALE",
        civilStatusId: undefined,
        nationality: "Filipino",
        citizenship: "Filipino",
      },
      contact: {
        mobileNumber: "",
        personalEmail: "",
        workEmail: undefined,
        street: undefined,
        barangay: undefined,
        city: undefined,
        province: undefined,
        postalCode: undefined,
        emergencyContactName: undefined,
        emergencyContactNumber: undefined,
        emergencyRelationshipId: undefined,
      },
      employment: {
        hireDate: today,
        employmentStatusId: employmentStatuses[0]?.id ?? "",
        employmentTypeId: employmentTypes[0]?.id ?? "",
        employmentClassId: employmentClasses[0]?.id ?? "",
        departmentId: departments[0]?.id ?? "",
        divisionId: divisions[0]?.id,
        positionId: positions[0]?.id ?? "",
        rankId: ranks[0]?.id,
        branchId: branches[0]?.id,
        reportingManagerId: undefined,
        probationEndDate: undefined,
        regularizationDate: undefined,
      },
      payroll: {
        monthlyRate: 0,
        workScheduleId: workSchedules[0]?.id ?? "",
        payPeriodPatternId: payPeriodPatterns[0]?.id ?? "",
        monthlyDivisor: 365,
        hoursPerDay: 8,
        minimumWageRegion: undefined,
        isNightDiffEligible: false,
        isOvertimeEligible: true,
        isWfhEligible: false,
        wfhSchedule: undefined,
      },
      tax: {
        taxStatusId: "S",
        numberOfDependents: 0,
        isSubstitutedFiling: false,
        tin: undefined,
        sssNumber: undefined,
        philHealthNumber: undefined,
        pagIbigNumber: undefined,
        previousEmployerIncome: undefined,
        previousEmployerTaxWithheld: undefined,
        notes: undefined,
      },
      uploads: {
        profilePhotoDataUrl: undefined,
        profilePhotoFileName: undefined,
        scannedDocuments: [],
      },
    },
  }
}
