import { db } from "@/lib/db"
import { BloodType, EducationLevel, RelationshipType, Religion } from "@prisma/client"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import {
  civilStatusOptions,
  genderOptions,
  taxStatusOptions,
} from "@/modules/employees/onboarding/schemas/employee-onboarding-schema"

type Option = {
  id: string
  code: string
  name: string
}

type WorkScheduleOption = Option & {
  workStart: string
  workEnd: string
  hoursPerDay: string
  gracePeriod: string
}

const formatDate = (value: Date | null | undefined): string => {
  if (!value) return "-"

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toDateInputValue = (value: Date | null | undefined): string => {
  if (!value) return ""
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const formatTime = (value: Date | null | undefined): string => {
  if (!value) return "-"

  const hour = value.getUTCHours()
  const minute = value.getUTCMinutes()
  const normalizedHour = ((hour + 11) % 12) + 1
  const period = hour >= 12 ? "PM" : "AM"

  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "-"

  const formatted = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

  return `PHP ${formatted}`
}

const humanizeCode = (value: string): string => {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const bytesToSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getTenureLabel = (hireDate: Date): string => {
  const now = new Date()
  const diffInMonths = (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth())
  const safe = Math.max(0, diffInMonths)
  const years = Math.floor(safe / 12)
  const months = safe % 12
  return `${years}y ${months}m`
}

const formatTaxStatusLabel = (code: string): string => {
  const labels: Record<string, string> = {
    S: "Single",
    S1: "Single (1 Dependent)",
    S2: "Single (2 Dependents)",
    S3: "Single (3 Dependents)",
    S4: "Single (4 Dependents)",
    ME: "Married",
    ME1: "Married (1 Dependent)",
    ME2: "Married (2 Dependents)",
    ME3: "Married (3 Dependents)",
    ME4: "Married (4 Dependents)",
    Z: "Zero Exemption",
  }

  return labels[code] ?? humanizeCode(code)
}

export type EmployeeProfileViewModel = {
  companyId: string
  companyName: string
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
    workSchedules: WorkScheduleOption[]
    payPeriodPatterns: Option[]
    genders: Array<{ id: string; name: string }>
    civilStatuses: Array<{ id: string; name: string }>
    religions: Array<{ id: string; name: string }>
    bloodTypes: Array<{ id: string; name: string }>
    taxStatuses: Array<{ id: string; name: string }>
    relationshipTypes: Array<{ id: string; name: string }>
    educationLevels: Array<{ id: string; name: string }>
  }
  employee: {
    id: string
    employeeNumber: string
    fullName: string
    firstName: string
    lastName: string
    middleName: string
    suffix: string
    maidenName: string
    nickname: string
    photoUrl: string | null
    signatureUrl: string | null
    isActive: boolean
    tenure: string

    hireDate: string
    hireDateValue: string
    applicationDate: string
    applicationDateValue: string
    interviewDate: string
    interviewDateValue: string
    jobOfferDate: string
    jobOfferDateValue: string
    probationStartDate: string
    probationStartDateValue: string
    probationEndDate: string
    probationEndDateValue: string
    regularizationDate: string
    regularizationDateValue: string
    contractStartDate: string
    contractStartDateValue: string
    contractEndDate: string
    contractEndDateValue: string
    separationDate: string
    lastWorkingDay: string
    separationReason: string

    birthDate: string
    birthDateValue: string
    birthPlace: string
    gender: string
    civilStatus: string
    nationality: string
    citizenship: string
    religion: string
    religionId: string
    bloodType: string
    bloodTypeId: string
    heightCm: string
    weightKg: string
    biometricId: string
    rfidNumber: string

    employmentStatus: string
    employmentType: string
    employmentClass: string
    department: string
    division: string
    position: string
    rank: string
    branch: string
    reportingManager: string

    workSchedule: string
    workStart: string
    workEnd: string
    workHours: string
    gracePeriod: string

    monthlyRate: string
    currency: string
    salaryRateType: string
    dailyRate: string
    hourlyRate: string
    monthlyDivisor: string
    hoursPerDay: string
    salaryGrade: string
    salaryBand: string
    minimumWageRegion: string
    payPeriodPattern: string

    taxStatus: string
    dependentsCount: string
    substitutedFiling: string
    previousEmployerIncome: string
    previousEmployerTaxWithheld: string
    overtimeEligible: string
    nightDiffEligible: string
    authorizedSignatory: string
    wfhEligible: string
    wfhSchedule: string

    tinNumber: string
    sssNumber: string
    philHealthNumber: string
    pagIbigNumber: string
    umidNumber: string

    genderId: string
    civilStatusId: string
    employmentStatusId: string
    employmentTypeId: string
    employmentClassId: string
    departmentId: string
    divisionId: string
    positionId: string
    rankId: string
    branchId: string
    reportingManagerId: string
    workScheduleId: string
    payPeriodPatternId: string
    taxStatusId: string

    contacts: Array<{ type: string; value: string; isPrimary: boolean }>
    emails: Array<{ type: string; value: string; isPrimary: boolean }>
    addresses: Array<{ type: string; line: string; isPrimary: boolean }>
    emergencyContacts: Array<{ name: string; relationship: string; mobile: string; email: string; priority: string }>
    dependents: Array<{
      id: string
      name: string
      firstName: string
      middleName: string
      lastName: string
      relationship: string
      relationshipId: string
      birthDate: string
      birthDateValue: string
      taxDependent: string
      isTaxDependent: boolean
    }>
    beneficiaries: Array<{
      id: string
      name: string
      relationship: string
      relationshipId: string
      percentage: string
      percentageValue: number
      contact: string
    }>
    educations: Array<{
      id: string
      level: string
      educationLevelId: string
      school: string
      course: string
      yearGraduated: string
      yearGraduatedValue: number | null
    }>
    trainings: Array<{
      id: string
      trainingName: string
      provider: string
      providerValue: string
      trainingDate: string
      trainingDateValue: string
      trainingEndDate: string
      trainingEndDateValue: string
      durationHours: string
      durationHoursValue: number | null
      location: string
      locationValue: string
    }>
    medicalRecords: Array<{
      id: string
      examYear: string
      examYearValue: number
      examDate: string
      examDateValue: string
      examType: string
      clinicName: string
      clinicNameValue: string
      physician: string
      physicianValue: string
      findings: string
      findingsValue: string
      remarks: string
      remarksValue: string
      result: string
      resultValue: string
      attachments: Array<{
        id: string
        fileName: string
        fileType: string
        fileSize: string
        fileSizeValue: number
        description: string
        descriptionValue: string
        uploadedAt: string
      }>
    }>
    qualifications: Array<{ category: string; name: string; details: string; dateLabel: string }>
    salaryHistory: Array<{
      id: string
      effectiveDate: string
      effectiveDateValue: string
      previous: string
      current: string
      adjustment: string
      reason: string
      reasonValue: string
      newSalaryValue: number
      adjustmentTypeCode: string
    }>
    positionHistory: Array<{
      id: string
      effectiveDate: string
      effectiveDateValue: string
      previous: string
      current: string
      movement: string
      reason: string
      reasonValue: string
      newPositionId: string
      newDepartmentId: string
      newBranchId: string
      movementType: string
    }>
    statusHistory: Array<{
      id: string
      effectiveDate: string
      effectiveDateValue: string
      previous: string
      current: string
      reason: string
      reasonValue: string
      newStatusId: string
    }>
    rankHistory: Array<{
      id: string
      effectiveDate: string
      effectiveDateValue: string
      previous: string
      current: string
      movement: string
      reason: string
      reasonValue: string
      newRankId: string
      movementType: string
    }>
    previousEmployments: Array<{
      id: string
      company: string
      position: string
      positionValue: string
      startDate: string
      startDateValue: string
      endDate: string
      endDateValue: string
      salary: string
      salaryValue: number | null
    }>
    documents: Array<{ id: string; title: string; type: string; fileName: string; fileUrl: string; fileSize: string; uploadedAt: string }>
  }
}

export async function getEmployeeProfileViewModel(companyId: string, employeeId: string): Promise<EmployeeProfileViewModel | null> {
  const context = await getActiveCompanyContext({ companyId })

  const [employmentStatuses, employmentTypes, employmentClasses, departments, divisions, positions, ranks, branches, managers, workSchedules, payPeriodPatterns] =
    await Promise.all([
      db.employmentStatus.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.employmentType.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.employmentClass.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.department.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.division.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.position.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.rank.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.branch.findMany({ where: { companyId: context.companyId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      db.employee.findMany({
        where: { companyId: context.companyId, isActive: true, deletedAt: null },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, employeeNumber: true, firstName: true, lastName: true },
        take: 300,
      }),
      db.workSchedule.findMany({
        where: { OR: [{ companyId: context.companyId }, { companyId: null }], isActive: true },
        orderBy: { name: "asc" },
      }),
      db.payPeriodPattern.findMany({
        where: { OR: [{ companyId: context.companyId }, { companyId: null }], isActive: true },
        orderBy: { name: "asc" },
      }),
    ])

  const mapOptions = (rows: Array<{ id: string; code: string; name: string }>): Option[] =>
    rows.map((row) => ({ id: row.id, code: row.code, name: row.name }))

  const employee = await db.employee.findFirst({
    where: { id: employeeId, companyId: context.companyId, deletedAt: null },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
      maidenName: true,
      nickname: true,
      photoUrl: true,
      signatureUrl: true,
      isActive: true,
      birthDate: true,
      birthPlace: true,
      genderId: true,
      civilStatusId: true,
      nationality: true,
      citizenship: true,
      religionId: true,
      bloodTypeId: true,
      heightCm: true,
      weightKg: true,
      biometricId: true,
      rfidNumber: true,
      employmentStatusId: true,
      employmentTypeId: true,
      employmentClassId: true,
      departmentId: true,
      divisionId: true,
      positionId: true,
      rankId: true,
      branchId: true,
      reportingManagerId: true,
      workScheduleId: true,
      payPeriodPatternId: true,

      hireDate: true,
      applicationDate: true,
      interviewDate: true,
      jobOfferDate: true,
      probationStartDate: true,
      probationEndDate: true,
      regularizationDate: true,
      contractStartDate: true,
      contractEndDate: true,
      separationDate: true,
      lastWorkingDay: true,
      separationReasonCode: true,

      employmentStatus: { select: { name: true } },
      employmentType: { select: { name: true } },
      employmentClass: { select: { name: true } },
      department: { select: { name: true } },
      division: { select: { name: true } },
      position: { select: { name: true } },
      rank: { select: { name: true } },
      branch: { select: { name: true } },
      reportingManager: { select: { employeeNumber: true, firstName: true, lastName: true } },

      workSchedule: {
        select: {
          name: true,
          workStartTime: true,
          workEndTime: true,
          requiredHoursPerDay: true,
          gracePeriodMins: true,
        },
      },
      payPeriodPattern: { select: { name: true } },

      salary: {
        select: {
          baseSalary: true,
          currency: true,
          salaryRateTypeCode: true,
          dailyRate: true,
          hourlyRate: true,
          monthlyDivisor: true,
          hoursPerDay: true,
          salaryGrade: true,
          salaryBand: true,
          minimumWageRegion: true,
        },
      },

      taxStatusId: true,
      numberOfDependents: true,
      isSubstitutedFiling: true,
      previousEmployerIncome: true,
      previousEmployerTaxWithheld: true,
      isOvertimeEligible: true,
      isNightDiffEligible: true,
      isAuthorizedSignatory: true,
      isWfhEligible: true,
      wfhSchedule: true,

      contacts: { where: { isActive: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { contactTypeId: true, number: true, isPrimary: true } },
      emails: { where: { isActive: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { emailTypeId: true, email: true, isPrimary: true } },
      addresses: {
        where: { isActive: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: { addressTypeId: true, street: true, barangay: true, city: true, province: true, postalCode: true, isPrimary: true },
      },
      governmentIds: { where: { isActive: true }, select: { idTypeId: true, idNumberMasked: true } },
      emergencyContacts: {
        where: { isActive: true },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        select: { name: true, relationshipId: true, mobileNumber: true, email: true, priority: true },
      },
      dependents: {
        where: { isActive: true },
        orderBy: [{ createdAt: "desc" }],
        select: { id: true, firstName: true, middleName: true, lastName: true, relationshipId: true, birthDate: true, isTaxDependent: true },
      },
      beneficiaries: {
        where: { isActive: true },
        orderBy: [{ createdAt: "desc" }],
        select: { id: true, name: true, relationshipId: true, percentage: true, contactNumber: true },
      },
      educations: {
        where: { isActive: true },
        orderBy: [{ yearGraduated: "desc" }],
        select: { id: true, educationLevelId: true, schoolName: true, course: true, yearGraduated: true },
      },
      licenses: {
        where: { isActive: true },
        orderBy: [{ createdAt: "desc" }],
        select: { licenseTypeCode: true, licenseNumber: true, issuingBody: true, expiryDate: true },
      },
      certifications: {
        where: { isActive: true },
        orderBy: [{ createdAt: "desc" }],
        select: { certificationName: true, issuingOrganization: true, issueDate: true, expiryDate: true },
      },
      trainings: {
        where: { isActive: true },
        orderBy: [{ createdAt: "desc" }],
        select: { id: true, trainingName: true, provider: true, trainingDate: true, trainingEndDate: true, durationHours: true, location: true },
      },
      medicalRecords: {
        where: { isActive: true },
        orderBy: [{ examDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          examYear: true,
          examDate: true,
          examType: true,
          clinicName: true,
          physician: true,
          findings: true,
          remarks: true,
          result: true,
          attachments: {
            orderBy: [{ uploadedAt: "desc" }],
            select: {
              id: true,
              fileName: true,
              fileType: true,
              fileSize: true,
              description: true,
              uploadedAt: true,
            },
          },
        },
      },
      skills: {
        where: { isActive: true },
        orderBy: [{ createdAt: "desc" }],
        select: { skillName: true, proficiencyLevel: true, yearsExperience: true },
      },
      salaryHistory: {
        orderBy: [{ effectiveDate: "desc" }],
        take: 20,
        select: {
          id: true,
          effectiveDate: true,
          previousSalary: true,
          newSalary: true,
          adjustmentTypeCode: true,
          adjustmentPercent: true,
          adjustmentAmount: true,
          reason: true,
        },
      },
      positionHistory: {
        orderBy: [{ effectiveDate: "desc" }],
        take: 20,
        select: {
          id: true,
          effectiveDate: true,
          previousPosition: { select: { name: true } },
          newPosition: { select: { name: true } },
          newPositionId: true,
          newDepartmentId: true,
          newBranchId: true,
          movementType: true,
          reason: true,
        },
      },
      statusHistory: {
        orderBy: [{ effectiveDate: "desc" }],
        take: 20,
        select: {
          id: true,
          effectiveDate: true,
          previousStatus: { select: { name: true } },
          newStatus: { select: { name: true } },
          newStatusId: true,
          reason: true,
        },
      },
      rankHistory: {
        orderBy: [{ effectiveDate: "desc" }],
        take: 20,
        select: {
          id: true,
          effectiveDate: true,
          previousRank: { select: { name: true } },
          newRank: { select: { name: true } },
          newRankId: true,
          movementType: true,
          reason: true,
        },
      },
      previousEmployments: {
        where: { isActive: true },
        orderBy: [{ endDate: "desc" }],
        select: { id: true, companyName: true, position: true, startDate: true, endDate: true, lastSalary: true },
      },
      documents: {
        where: { isActive: true },
        orderBy: [{ createdAt: "desc" }],
        select: { id: true, title: true, documentTypeId: true, fileName: true, fileUrl: true, fileSize: true, createdAt: true },
      },
    },
  })

  if (!employee) return null

  const middleInitial = employee.middleName ? ` ${employee.middleName.charAt(0)}.` : ""
  const suffix = employee.suffix ? ` ${employee.suffix}` : ""

  const idMap = new Map(employee.governmentIds.map((item) => [item.idTypeId, item.idNumberMasked ?? "-"]))

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    options: {
      employmentStatuses: mapOptions(employmentStatuses),
      employmentTypes: mapOptions(employmentTypes),
      employmentClasses: mapOptions(employmentClasses),
      departments: mapOptions(departments),
      divisions: mapOptions(divisions),
      positions: mapOptions(positions),
      ranks: mapOptions(ranks),
      branches: mapOptions(branches),
      managers: managers.map((row) => ({ id: row.id, code: row.employeeNumber, name: `${row.lastName}, ${row.firstName}` })),
      workSchedules: workSchedules.map((schedule) => ({
        id: schedule.id,
        code: schedule.code,
        name: schedule.name,
        workStart: formatTime(schedule.workStartTime),
        workEnd: formatTime(schedule.workEndTime),
        hoursPerDay: Number(schedule.requiredHoursPerDay).toString(),
        gracePeriod: `${schedule.gracePeriodMins} mins`,
      })),
      payPeriodPatterns: mapOptions(payPeriodPatterns),
      genders: genderOptions.map((id) => ({ id, name: humanizeCode(id) })),
      civilStatuses: civilStatusOptions.map((id) => ({ id, name: humanizeCode(id) })),
      religions: Object.values(Religion).map((id) => ({ id, name: humanizeCode(id) })),
      bloodTypes: Object.values(BloodType).map((id) => ({ id, name: humanizeCode(id) })),
      taxStatuses: taxStatusOptions.map((id) => ({ id, name: formatTaxStatusLabel(id) })),
      relationshipTypes: Object.values(RelationshipType).map((id) => ({ id, name: humanizeCode(id) })),
      educationLevels: Object.values(EducationLevel).map((id) => ({ id, name: humanizeCode(id) })),
    },
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      fullName: `${employee.lastName}, ${employee.firstName}${middleInitial}${suffix}`,
      firstName: employee.firstName,
      lastName: employee.lastName,
      middleName: employee.middleName ?? "-",
      suffix: employee.suffix ?? "-",
      maidenName: employee.maidenName ?? "-",
      nickname: employee.nickname ?? "-",
      photoUrl: employee.photoUrl,
      signatureUrl: employee.signatureUrl,
      isActive: employee.isActive,
      tenure: getTenureLabel(employee.hireDate),

      hireDate: formatDate(employee.hireDate),
      hireDateValue: toDateInputValue(employee.hireDate),
      applicationDate: formatDate(employee.applicationDate),
      applicationDateValue: toDateInputValue(employee.applicationDate),
      interviewDate: formatDate(employee.interviewDate),
      interviewDateValue: toDateInputValue(employee.interviewDate),
      jobOfferDate: formatDate(employee.jobOfferDate),
      jobOfferDateValue: toDateInputValue(employee.jobOfferDate),
      probationStartDate: formatDate(employee.probationStartDate),
      probationStartDateValue: toDateInputValue(employee.probationStartDate),
      probationEndDate: formatDate(employee.probationEndDate),
      probationEndDateValue: toDateInputValue(employee.probationEndDate),
      regularizationDate: formatDate(employee.regularizationDate),
      regularizationDateValue: toDateInputValue(employee.regularizationDate),
      contractStartDate: formatDate(employee.contractStartDate),
      contractStartDateValue: toDateInputValue(employee.contractStartDate),
      contractEndDate: formatDate(employee.contractEndDate),
      contractEndDateValue: toDateInputValue(employee.contractEndDate),
      separationDate: formatDate(employee.separationDate),
      lastWorkingDay: formatDate(employee.lastWorkingDay),
      separationReason: employee.separationReasonCode ? humanizeCode(employee.separationReasonCode) : "-",

      birthDate: formatDate(employee.birthDate),
      birthDateValue: toDateInputValue(employee.birthDate),
      birthPlace: employee.birthPlace ?? "-",
      gender: employee.genderId ? humanizeCode(employee.genderId) : "-",
      civilStatus: employee.civilStatusId ? humanizeCode(employee.civilStatusId) : "-",
      nationality: employee.nationality ?? "-",
      citizenship: employee.citizenship ?? "-",
      religion: employee.religionId ? humanizeCode(employee.religionId) : "-",
      religionId: employee.religionId ?? "",
      bloodType: employee.bloodTypeId ? humanizeCode(employee.bloodTypeId) : "-",
      bloodTypeId: employee.bloodTypeId ?? "",
      heightCm: employee.heightCm ? Number(employee.heightCm).toString() : "-",
      weightKg: employee.weightKg ? Number(employee.weightKg).toString() : "-",
      biometricId: employee.biometricId ?? "-",
      rfidNumber: employee.rfidNumber ?? "-",

      employmentStatus: employee.employmentStatus?.name ?? "-",
      employmentType: employee.employmentType?.name ?? "-",
      employmentClass: employee.employmentClass?.name ?? "-",
      department: employee.department?.name ?? "-",
      division: employee.division?.name ?? "-",
      position: employee.position?.name ?? "-",
      rank: employee.rank?.name ?? "-",
      branch: employee.branch?.name ?? "-",
      reportingManager: employee.reportingManager
        ? `${employee.reportingManager.lastName}, ${employee.reportingManager.firstName} (${employee.reportingManager.employeeNumber})`
        : "-",

      workSchedule: employee.workSchedule?.name ?? "-",
      workStart: formatTime(employee.workSchedule?.workStartTime),
      workEnd: formatTime(employee.workSchedule?.workEndTime),
      workHours: employee.workSchedule?.requiredHoursPerDay ? Number(employee.workSchedule.requiredHoursPerDay).toString() : "-",
      gracePeriod: employee.workSchedule ? `${employee.workSchedule.gracePeriodMins} mins` : "-",

      monthlyRate: employee.salary ? formatCurrency(Number(employee.salary.baseSalary)) : "-",
      currency: employee.salary?.currency ?? "PHP",
      salaryRateType: employee.salary ? humanizeCode(employee.salary.salaryRateTypeCode) : "-",
      dailyRate: employee.salary?.dailyRate ? formatCurrency(Number(employee.salary.dailyRate)) : "-",
      hourlyRate: employee.salary?.hourlyRate ? formatCurrency(Number(employee.salary.hourlyRate)) : "-",
      monthlyDivisor: employee.salary ? String(employee.salary.monthlyDivisor) : "-",
      hoursPerDay: employee.salary ? Number(employee.salary.hoursPerDay).toString() : "-",
      salaryGrade: employee.salary?.salaryGrade ?? "-",
      salaryBand: employee.salary?.salaryBand ?? "-",
      minimumWageRegion: employee.salary?.minimumWageRegion ?? "-",
      payPeriodPattern: employee.payPeriodPattern?.name ?? "-",

      taxStatus: employee.taxStatusId ? formatTaxStatusLabel(employee.taxStatusId) : "-",
      dependentsCount: String(employee.numberOfDependents),
      substitutedFiling: employee.isSubstitutedFiling ? "Yes" : "No",
      previousEmployerIncome: employee.previousEmployerIncome ? formatCurrency(Number(employee.previousEmployerIncome)) : "-",
      previousEmployerTaxWithheld: employee.previousEmployerTaxWithheld ? formatCurrency(Number(employee.previousEmployerTaxWithheld)) : "-",
      overtimeEligible: employee.isOvertimeEligible ? "Yes" : "No",
      nightDiffEligible: employee.isNightDiffEligible ? "Yes" : "No",
      authorizedSignatory: employee.isAuthorizedSignatory ? "Yes" : "No",
      wfhEligible: employee.isWfhEligible ? "Yes" : "No",
      wfhSchedule: employee.wfhSchedule ?? "-",

      tinNumber: idMap.get("TIN") ?? "-",
      sssNumber: idMap.get("SSS") ?? "-",
      philHealthNumber: idMap.get("PHILHEALTH") ?? "-",
      pagIbigNumber: idMap.get("PAGIBIG") ?? "-",
      umidNumber: idMap.get("UMID") ?? "-",

      genderId: employee.genderId ?? "",
      civilStatusId: employee.civilStatusId ?? "",
      employmentStatusId: employee.employmentStatusId ?? "",
      employmentTypeId: employee.employmentTypeId ?? "",
      employmentClassId: employee.employmentClassId ?? "",
      departmentId: employee.departmentId ?? "",
      divisionId: employee.divisionId ?? "",
      positionId: employee.positionId ?? "",
      rankId: employee.rankId ?? "",
      branchId: employee.branchId ?? "",
      reportingManagerId: employee.reportingManagerId ?? "",
      workScheduleId: employee.workScheduleId ?? "",
      payPeriodPatternId: employee.payPeriodPatternId ?? "",
      taxStatusId: employee.taxStatusId ?? "",

      contacts: employee.contacts.map((contact) => ({ type: humanizeCode(contact.contactTypeId), value: contact.number, isPrimary: contact.isPrimary })),
      emails: employee.emails.map((email) => ({ type: humanizeCode(email.emailTypeId), value: email.email, isPrimary: email.isPrimary })),
      addresses: employee.addresses.map((address) => ({
        type: humanizeCode(address.addressTypeId),
        line: [address.street, address.barangay, address.city, address.province, address.postalCode]
          .filter((part) => Boolean(part && part.trim().length > 0))
          .join(", "),
        isPrimary: address.isPrimary,
      })),
      emergencyContacts: employee.emergencyContacts.map((record) => ({
        name: record.name,
        relationship: humanizeCode(record.relationshipId),
        mobile: record.mobileNumber ?? "-",
        email: record.email ?? "-",
        priority: String(record.priority),
      })),
      dependents: employee.dependents.map((dep) => ({
        id: dep.id,
        name: `${dep.lastName}, ${dep.firstName}${dep.middleName ? ` ${dep.middleName.charAt(0)}.` : ""}`,
        firstName: dep.firstName,
        middleName: dep.middleName ?? "",
        lastName: dep.lastName,
        relationship: humanizeCode(dep.relationshipId),
        relationshipId: dep.relationshipId,
        birthDate: formatDate(dep.birthDate),
        birthDateValue: toDateInputValue(dep.birthDate),
        taxDependent: dep.isTaxDependent ? "Yes" : "No",
        isTaxDependent: dep.isTaxDependent,
      })),
      beneficiaries: employee.beneficiaries.map((item) => ({
        id: item.id,
        name: item.name,
        relationship: humanizeCode(item.relationshipId),
        relationshipId: item.relationshipId,
        percentage: `${Number(item.percentage).toFixed(2)}%`,
        percentageValue: Number(item.percentage),
        contact: item.contactNumber ?? "-",
      })),
      educations: employee.educations.map((edu) => ({
        id: edu.id,
        level: humanizeCode(edu.educationLevelId),
        educationLevelId: edu.educationLevelId,
        school: edu.schoolName,
        course: edu.course ?? "-",
        yearGraduated: edu.yearGraduated ? String(edu.yearGraduated) : "-",
        yearGraduatedValue: edu.yearGraduated ?? null,
      })),
      trainings: employee.trainings.map((item) => ({
        id: item.id,
        trainingName: item.trainingName,
        provider: item.provider ?? "-",
        providerValue: item.provider ?? "",
        trainingDate: formatDate(item.trainingDate),
        trainingDateValue: toDateInputValue(item.trainingDate),
        trainingEndDate: formatDate(item.trainingEndDate),
        trainingEndDateValue: toDateInputValue(item.trainingEndDate),
        durationHours: item.durationHours !== null && item.durationHours !== undefined ? Number(item.durationHours).toString() : "-",
        durationHoursValue: item.durationHours !== null && item.durationHours !== undefined ? Number(item.durationHours) : null,
        location: item.location ?? "-",
        locationValue: item.location ?? "",
      })),
      medicalRecords: employee.medicalRecords.map((record) => ({
        id: record.id,
        examYear: String(record.examYear),
        examYearValue: record.examYear,
        examDate: formatDate(record.examDate),
        examDateValue: toDateInputValue(record.examDate),
        examType: record.examType,
        clinicName: record.clinicName ?? "-",
        clinicNameValue: record.clinicName ?? "",
        physician: record.physician ?? "-",
        physicianValue: record.physician ?? "",
        findings: record.findings ?? "-",
        findingsValue: record.findings ?? "",
        remarks: record.remarks ?? "-",
        remarksValue: record.remarks ?? "",
        result: record.result ?? "-",
        resultValue: record.result ?? "",
        attachments: record.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: bytesToSize(attachment.fileSize),
          fileSizeValue: attachment.fileSize,
          description: attachment.description ?? "-",
          descriptionValue: attachment.description ?? "",
          uploadedAt: formatDate(attachment.uploadedAt),
        })),
      })),
      qualifications: [
        ...employee.licenses.map((item) => ({ category: "License", name: humanizeCode(item.licenseTypeCode), details: `${item.licenseNumber}${item.issuingBody ? ` • ${item.issuingBody}` : ""}`, dateLabel: item.expiryDate ? `Expires ${formatDate(item.expiryDate)}` : "-" })),
        ...employee.certifications.map((item) => ({ category: "Certification", name: item.certificationName, details: item.issuingOrganization ?? "-", dateLabel: item.issueDate ? `Issued ${formatDate(item.issueDate)}` : "-" })),
        ...employee.trainings.map((item) => ({ category: "Training", name: item.trainingName, details: item.provider ?? "-", dateLabel: item.trainingDate ? `Started ${formatDate(item.trainingDate)}` : "-" })),
        ...employee.skills.map((item) => ({ category: "Skill", name: item.skillName, details: item.proficiencyLevel ?? "-", dateLabel: item.yearsExperience ? `${Number(item.yearsExperience)} years` : "-" })),
      ],
      salaryHistory: employee.salaryHistory.map((item) => ({
        id: item.id,
        effectiveDate: formatDate(item.effectiveDate),
        effectiveDateValue: toDateInputValue(item.effectiveDate),
        previous: item.previousSalary ? formatCurrency(Number(item.previousSalary)) : "-",
        current: formatCurrency(Number(item.newSalary)),
        adjustment:
          item.adjustmentAmount
            ? formatCurrency(Number(item.adjustmentAmount))
            : item.adjustmentPercent
              ? `${Number(item.adjustmentPercent).toFixed(2)}%`
              : "-",
        reason: item.reason ?? "-",
        reasonValue: item.reason ?? "",
        newSalaryValue: Number(item.newSalary),
        adjustmentTypeCode: item.adjustmentTypeCode ?? "OTHER",
      })),
      positionHistory: employee.positionHistory.map((item) => ({
        id: item.id,
        effectiveDate: formatDate(item.effectiveDate),
        effectiveDateValue: toDateInputValue(item.effectiveDate),
        previous: item.previousPosition?.name ?? "-",
        current: item.newPosition?.name ?? "Unassigned",
        movement: humanizeCode(item.movementType),
        reason: item.reason ?? "-",
        reasonValue: item.reason ?? "",
        newPositionId: item.newPositionId ?? "",
        newDepartmentId: item.newDepartmentId ?? "",
        newBranchId: item.newBranchId ?? "",
        movementType: item.movementType,
      })),
      statusHistory: employee.statusHistory.map((item) => ({
        id: item.id,
        effectiveDate: formatDate(item.effectiveDate),
        effectiveDateValue: toDateInputValue(item.effectiveDate),
        previous: item.previousStatus?.name ?? "-",
        current: item.newStatus?.name ?? "Unassigned",
        reason: item.reason ?? "-",
        reasonValue: item.reason ?? "",
        newStatusId: item.newStatusId ?? "",
      })),
      rankHistory: employee.rankHistory.map((item) => ({
        id: item.id,
        effectiveDate: formatDate(item.effectiveDate),
        effectiveDateValue: toDateInputValue(item.effectiveDate),
        previous: item.previousRank?.name ?? "-",
        current: item.newRank?.name ?? "Unassigned",
        movement: humanizeCode(item.movementType),
        reason: item.reason ?? "-",
        reasonValue: item.reason ?? "",
        newRankId: item.newRankId ?? "",
        movementType: item.movementType,
      })),
      previousEmployments: employee.previousEmployments.map((item) => ({
        id: item.id,
        company: item.companyName,
        position: item.position ?? "-",
        positionValue: item.position ?? "",
        startDate: formatDate(item.startDate),
        startDateValue: toDateInputValue(item.startDate),
        endDate: formatDate(item.endDate),
        endDateValue: toDateInputValue(item.endDate),
        salary: item.lastSalary ? formatCurrency(Number(item.lastSalary)) : "-",
        salaryValue: item.lastSalary ? Number(item.lastSalary) : null,
      })),
      documents: employee.documents.map((item) => ({
        id: item.id,
        title: item.title,
        type: humanizeCode(item.documentTypeId),
        fileName: item.fileName,
        fileUrl: item.fileUrl,
        fileSize: bytesToSize(item.fileSize),
        uploadedAt: formatDate(item.createdAt),
      })),
    },
  }
}
