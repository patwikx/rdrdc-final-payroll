"use server"

import { BloodType, CivilStatus, Gender, Prisma, Religion, TaxStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly, toPhDateInputValue } from "@/lib/ph-time"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { updateEmployeeProfileAction } from "@/modules/employees/profile/actions/update-employee-profile-action"
import type { UpdateEmployeeProfileInput } from "@/modules/employees/profile/schemas/update-employee-profile-schema"
import {
  bulkUpdateEmployeesInputSchema,
  type BulkUpdateEmployeesInput,
} from "@/modules/employees/masterlist/schemas/bulk-update-employees-schema"
import {
  EMPLOYEE_BULK_UPDATE_REQUIRED_HEADERS,
  EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS,
  type EmployeeBulkUpdateTemplateHeader,
  isClearToken,
  isCsvRowBlank,
  normalizeBulkHeaderKey,
  normalizeBulkKey,
  parseCsvRows,
  type ParsedCsvRow,
} from "@/modules/employees/masterlist/utils/employee-bulk-csv"
import {
  EMPLOYEE_BULK_BLOOD_TYPE_LABELS,
  EMPLOYEE_BULK_CIVIL_STATUS_LABELS,
  EMPLOYEE_BULK_GENDER_LABELS,
  EMPLOYEE_BULK_RELIGION_LABELS,
  EMPLOYEE_BULK_TAX_STATUS_LABELS,
} from "@/modules/employees/masterlist/utils/employee-bulk-enum-labels"

type LookupRow = {
  id: string
  code: string
  name: string
}

type BulkUpdateRowError = {
  rowNumber: number
  employeeNumber: string
  message: string
}

type BulkUpdateEmployeesActionResult =
  | {
      ok: true
      message: string
      summary: {
        dryRun: boolean
        totalRows: number
        processedRows: number
        updatedRows: number
        skippedRows: number
        errorRows: number
      }
      errors: BulkUpdateRowError[]
    }
  | {
      ok: false
      error: string
    }

const MAX_CSV_ROWS = 2_000
const MAX_RETURNED_ERRORS = 200
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const employeeBaselineSelect = {
  id: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  middleName: true,
  suffix: true,
  maidenName: true,
  nickname: true,
  birthDate: true,
  birthPlace: true,
  nationality: true,
  citizenship: true,
  genderId: true,
  civilStatusId: true,
  religionId: true,
  bloodTypeId: true,
  heightCm: true,
  weightKg: true,
  biometricId: true,
  rfidNumber: true,
  hireDate: true,
  applicationDate: true,
  interviewDate: true,
  jobOfferDate: true,
  probationStartDate: true,
  probationEndDate: true,
  regularizationDate: true,
  contractStartDate: true,
  contractEndDate: true,
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
  taxStatusId: true,
  numberOfDependents: true,
  previousEmployerIncome: true,
  previousEmployerTaxWithheld: true,
  isSubstitutedFiling: true,
  isOvertimeEligible: true,
  isNightDiffEligible: true,
  isAuthorizedSignatory: true,
  isWfhEligible: true,
  wfhSchedule: true,
  signatureUrl: true,
} satisfies Prisma.EmployeeSelect

type EmployeeBaselineRow = Prisma.EmployeeGetPayload<{
  select: typeof employeeBaselineSelect
}>

const decimalToNumber = (value: Prisma.Decimal | null | undefined): number | undefined => {
  if (value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const dateToInput = (value: Date | null | undefined): string | undefined => {
  if (!value) return undefined
  return toPhDateInputValue(value)
}

const toOptionalString = (value: string | null | undefined): string | undefined => {
  return value ?? undefined
}

const buildBasePayload = (companyId: string, employee: EmployeeBaselineRow): UpdateEmployeeProfileInput => {
  return {
    companyId,
    employeeId: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    middleName: toOptionalString(employee.middleName),
    suffix: toOptionalString(employee.suffix),
    maidenName: toOptionalString(employee.maidenName),
    nickname: toOptionalString(employee.nickname),
    birthDate: dateToInput(employee.birthDate),
    birthPlace: toOptionalString(employee.birthPlace),
    nationality: toOptionalString(employee.nationality),
    citizenship: toOptionalString(employee.citizenship),
    genderId: toOptionalString(employee.genderId),
    civilStatusId: toOptionalString(employee.civilStatusId),
    religionId: toOptionalString(employee.religionId),
    bloodTypeId: toOptionalString(employee.bloodTypeId),
    heightCm: decimalToNumber(employee.heightCm),
    weightKg: decimalToNumber(employee.weightKg),
    mobileNumber: undefined,
    personalEmail: undefined,
    biometricId: toOptionalString(employee.biometricId),
    rfidNumber: toOptionalString(employee.rfidNumber),
    numberOfDependents: employee.numberOfDependents,
    previousEmployerIncome: decimalToNumber(employee.previousEmployerIncome),
    previousEmployerTaxWithheld: decimalToNumber(employee.previousEmployerTaxWithheld),
    wfhSchedule: toOptionalString(employee.wfhSchedule),
    employmentStatusId: toOptionalString(employee.employmentStatusId),
    employmentTypeId: toOptionalString(employee.employmentTypeId),
    employmentClassId: toOptionalString(employee.employmentClassId),
    departmentId: toOptionalString(employee.departmentId),
    divisionId: toOptionalString(employee.divisionId),
    positionId: toOptionalString(employee.positionId),
    rankId: toOptionalString(employee.rankId),
    branchId: toOptionalString(employee.branchId),
    reportingManagerId: toOptionalString(employee.reportingManagerId),
    workScheduleId: toOptionalString(employee.workScheduleId),
    payPeriodPatternId: toOptionalString(employee.payPeriodPatternId),
    taxStatusId: toOptionalString(employee.taxStatusId),
    hireDate: dateToInput(employee.hireDate),
    applicationDate: dateToInput(employee.applicationDate),
    interviewDate: dateToInput(employee.interviewDate),
    jobOfferDate: dateToInput(employee.jobOfferDate),
    probationStartDate: dateToInput(employee.probationStartDate),
    probationEndDate: dateToInput(employee.probationEndDate),
    regularizationDate: dateToInput(employee.regularizationDate),
    contractStartDate: dateToInput(employee.contractStartDate),
    contractEndDate: dateToInput(employee.contractEndDate),
    monthlyRate: undefined,
    dailyRate: undefined,
    hourlyRate: undefined,
    monthlyDivisor: undefined,
    hoursPerDay: undefined,
    salaryGrade: undefined,
    salaryBand: undefined,
    minimumWageRegion: undefined,
    tinNumber: undefined,
    sssNumber: undefined,
    philHealthNumber: undefined,
    pagIbigNumber: undefined,
    umidNumber: undefined,
    isSubstitutedFiling: employee.isSubstitutedFiling,
    isOvertimeEligible: employee.isOvertimeEligible,
    isNightDiffEligible: employee.isNightDiffEligible,
    isAuthorizedSignatory: employee.isAuthorizedSignatory,
    isWfhEligible: employee.isWfhEligible,
    signatureUrl: toOptionalString(employee.signatureUrl),
  }
}

const getCellValue = (
  row: ParsedCsvRow,
  headerIndexMap: Map<string, number>,
  header: EmployeeBulkUpdateTemplateHeader
): string => {
  const index = headerIndexMap.get(normalizeBulkHeaderKey(header))
  if (index === undefined) return ""
  return row.cells[index] ?? ""
}

const buildLookupResolver = (label: string, rows: LookupRow[]) => {
  const index = new Map<string, string>()
  const ambiguousKeys = new Set<string>()

  const register = (rawValue: string, id: string) => {
    const key = normalizeBulkKey(rawValue)
    if (!key) return

    const existing = index.get(key)
    if (existing && existing !== id) {
      ambiguousKeys.add(key)
      return
    }

    index.set(key, id)
  }

  for (const row of rows) {
    register(row.code, row.id)
    register(row.name, row.id)
  }

  return (rawValue: string): { ok: true; id: string } | { ok: false; error: string } => {
    const key = normalizeBulkKey(rawValue)
    if (!key) {
      return { ok: false, error: `${label} is required.` }
    }

    if (ambiguousKeys.has(key)) {
      return { ok: false, error: `Ambiguous ${label} "${rawValue}". Use the exact code instead of name.` }
    }

    const id = index.get(key)
    if (!id) {
      return { ok: false, error: `Unknown ${label} "${rawValue}".` }
    }

    return { ok: true, id }
  }
}

const buildEnumResolver = <TValue extends string>(
  label: string,
  values: TValue[],
  labelMap?: Partial<Record<TValue, string>>
) => {
  const index = new Map<string, TValue>()

  for (const value of values) {
    index.set(normalizeBulkKey(value), value)
    const mappedLabel = labelMap?.[value]
    if (mappedLabel) {
      index.set(normalizeBulkKey(mappedLabel), value)
    }
  }

  return (rawValue: string): { ok: true; value: TValue } | { ok: false; error: string } => {
    const key = normalizeBulkKey(rawValue)
    const resolved = index.get(key)
    if (!resolved) {
      return { ok: false, error: `Unknown ${label} "${rawValue}".` }
    }
    return { ok: true, value: resolved }
  }
}

const buildTaxStatusResolver = () => {
  const index = new Map<string, TaxStatus>()
  const values = Object.values(TaxStatus)

  for (const value of values) {
    index.set(normalizeBulkKey(value), value)
    index.set(normalizeBulkKey(EMPLOYEE_BULK_TAX_STATUS_LABELS[value]), value)
  }

  return (rawValue: string): { ok: true; value: TaxStatus } | { ok: false; error: string } => {
    const key = normalizeBulkKey(rawValue)
    const resolved = index.get(key)
    if (!resolved) {
      return { ok: false, error: `Unknown tax status "${rawValue}".` }
    }
    return { ok: true, value: resolved }
  }
}

const parseBooleanCell = (rawValue: string): { ok: true; value: boolean } | { ok: false } => {
  const normalized = normalizeBulkKey(rawValue)

  if (["true", "yes", "y", "1"].includes(normalized)) {
    return { ok: true, value: true }
  }

  if (["false", "no", "n", "0"].includes(normalized)) {
    return { ok: true, value: false }
  }

  return { ok: false }
}

const parseNumberCell = (rawValue: string): number | null => {
  const normalized = rawValue.replace(/,/g, "").trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const parseDateCell = (rawValue: string): string | null => {
  const normalized = rawValue.trim()
  if (!DATE_INPUT_PATTERN.test(normalized)) return null
  return parsePhDateInputToUtcDateOnly(normalized) ? normalized : null
}

const fieldIsPresent = (value: string): boolean => {
  return value.trim().length > 0
}

const isCommentRow = (row: ParsedCsvRow): boolean => {
  const firstNonBlankCell = row.cells.find((cell) => cell.trim().length > 0)
  if (!firstNonBlankCell) return false
  return firstNonBlankCell.trim().startsWith("#")
}

const hasAnyUpdatableCell = (row: ParsedCsvRow, headerIndexMap: Map<string, number>): boolean => {
  for (const header of EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS) {
    if (header === "employeeNumber") continue
    if (fieldIsPresent(getCellValue(row, headerIndexMap, header))) {
      return true
    }
  }
  return false
}

export async function bulkUpdateEmployeesAction(
  input: BulkUpdateEmployeesInput
): Promise<BulkUpdateEmployeesActionResult> {
  const parsed = bulkUpdateEmployeesInputSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? "Invalid bulk update payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return { ok: false, error: "You do not have permission to bulk update employees in this company." }
  }

  let parsedRows: ParsedCsvRow[]
  try {
    parsedRows = parseCsvRows(payload.csvContent)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid CSV file."
    return { ok: false, error: message }
  }

  if (parsedRows.length === 0) {
    return { ok: false, error: "CSV file is empty." }
  }

  const [headerRow, ...rawDataRows] = parsedRows
  if (!headerRow) {
    return { ok: false, error: "CSV file is missing headers." }
  }

  const headerIndexMap = new Map<string, number>()
  headerRow.cells.forEach((cell, index) => {
    const key = normalizeBulkHeaderKey(cell)
    if (!key || headerIndexMap.has(key)) return
    headerIndexMap.set(key, index)
  })

  const missingRequiredHeaders = EMPLOYEE_BULK_UPDATE_REQUIRED_HEADERS.filter(
    (requiredHeader) => !headerIndexMap.has(normalizeBulkHeaderKey(requiredHeader))
  )

  if (missingRequiredHeaders.length > 0) {
    return {
      ok: false,
      error: `CSV is missing required column(s): ${missingRequiredHeaders.join(", ")}.`,
    }
  }

  const dataRows: ParsedCsvRow[] = []
  let skippedRows = 0

  for (const row of rawDataRows) {
    if (isCsvRowBlank(row.cells) || isCommentRow(row)) {
      skippedRows += 1
      continue
    }

    dataRows.push(row)
  }

  if (dataRows.length === 0) {
    return { ok: false, error: "No data rows found. Add at least one employee row." }
  }

  if (dataRows.length > MAX_CSV_ROWS) {
    return { ok: false, error: `CSV has too many rows. Maximum allowed is ${MAX_CSV_ROWS}.` }
  }

  const [
    employees,
    managerOptions,
    employmentStatuses,
    employmentTypes,
    employmentClasses,
    departments,
    divisions,
    positions,
    ranks,
    branches,
    workSchedules,
    payPeriodPatterns,
  ] = await Promise.all([
    db.employee.findMany({
      where: {
        companyId: context.companyId,
        deletedAt: null,
        employeeNumber: { not: "admin" },
      },
      select: employeeBaselineSelect,
    }),
    db.employee.findMany({
      where: {
        companyId: context.companyId,
        deletedAt: null,
        isActive: true,
        employeeNumber: { not: "admin" },
      },
      select: {
        id: true,
        employeeNumber: true,
      },
    }),
    db.employmentStatus.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, code: true, name: true },
    }),
    db.employmentType.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, code: true, name: true },
    }),
    db.employmentClass.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, code: true, name: true },
    }),
    db.department.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, code: true, name: true },
    }),
    db.division.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, code: true, name: true },
    }),
    db.position.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, code: true, name: true },
    }),
    db.rank.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, code: true, name: true },
    }),
    db.branch.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, code: true, name: true },
    }),
    db.workSchedule.findMany({
      where: { isActive: true, OR: [{ companyId: context.companyId }, { companyId: null }] },
      select: { id: true, code: true, name: true },
    }),
    db.payPeriodPattern.findMany({
      where: { isActive: true, OR: [{ companyId: context.companyId }, { companyId: null }] },
      select: { id: true, code: true, name: true },
    }),
  ])

  const employeeByNumber = new Map<string, EmployeeBaselineRow>()
  for (const employee of employees) {
    employeeByNumber.set(normalizeBulkKey(employee.employeeNumber), employee)
  }

  const managerIdByEmployeeNumber = new Map<string, string>()
  for (const manager of managerOptions) {
    managerIdByEmployeeNumber.set(normalizeBulkKey(manager.employeeNumber), manager.id)
  }

  const resolveEmploymentStatus = buildLookupResolver("employment status", employmentStatuses)
  const resolveEmploymentType = buildLookupResolver("employment type", employmentTypes)
  const resolveEmploymentClass = buildLookupResolver("employment class", employmentClasses)
  const resolveDepartment = buildLookupResolver("department", departments)
  const resolveDivision = buildLookupResolver("division", divisions)
  const resolvePosition = buildLookupResolver("position", positions)
  const resolveRank = buildLookupResolver("rank", ranks)
  const resolveBranch = buildLookupResolver("branch", branches)
  const resolveWorkSchedule = buildLookupResolver("work schedule", workSchedules)
  const resolvePayPeriodPattern = buildLookupResolver("pay period pattern", payPeriodPatterns)
  const resolveGender = buildEnumResolver("gender", Object.values(Gender), EMPLOYEE_BULK_GENDER_LABELS)
  const resolveCivilStatus = buildEnumResolver("civil status", Object.values(CivilStatus), EMPLOYEE_BULK_CIVIL_STATUS_LABELS)
  const resolveReligion = buildEnumResolver("religion", Object.values(Religion), EMPLOYEE_BULK_RELIGION_LABELS)
  const resolveBloodType = buildEnumResolver("blood type", Object.values(BloodType), EMPLOYEE_BULK_BLOOD_TYPE_LABELS)
  const resolveTaxStatus = buildTaxStatusResolver()

  const errors: BulkUpdateRowError[] = []
  let errorRows = 0
  let processedRows = 0
  let updatedRows = 0

  const addRowError = (rowNumber: number, employeeNumber: string, message: string) => {
    errorRows += 1
    if (errors.length < MAX_RETURNED_ERRORS) {
      errors.push({ rowNumber, employeeNumber, message })
    }
  }

  const seenEmployeeNumbers = new Set<string>()

  for (const row of dataRows) {
    const rawEmployeeNumber = getCellValue(row, headerIndexMap, "employeeNumber").trim()
    const normalizedEmployeeNumber = normalizeBulkKey(rawEmployeeNumber)
    const rowMessages: string[] = []

    if (!normalizedEmployeeNumber) {
      addRowError(row.lineNumber, "", "employeeNumber is required.")
      continue
    }

    if (seenEmployeeNumbers.has(normalizedEmployeeNumber)) {
      addRowError(row.lineNumber, rawEmployeeNumber, "Duplicate employeeNumber in CSV upload.")
      continue
    }
    seenEmployeeNumbers.add(normalizedEmployeeNumber)

    const employee = employeeByNumber.get(normalizedEmployeeNumber)
    if (!employee) {
      addRowError(row.lineNumber, rawEmployeeNumber, "Employee not found in the selected company.")
      continue
    }

    if (!hasAnyUpdatableCell(row, headerIndexMap)) {
      skippedRows += 1
      continue
    }

    const updatePayload = buildBasePayload(context.companyId, employee)

    const applyRequiredText = (
      header: EmployeeBulkUpdateTemplateHeader,
      label: string,
      setValue: (value: string) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        rowMessages.push(`${label} cannot be cleared.`)
        return
      }
      setValue(raw)
    }

    const applyOptionalEmployeeText = (
      header: EmployeeBulkUpdateTemplateHeader,
      setValue: (value: string | undefined) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        setValue(undefined)
        return
      }
      setValue(raw)
    }

    const applyOptionalSalaryText = (
      header: EmployeeBulkUpdateTemplateHeader,
      setValue: (value: string | undefined) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        setValue("")
        return
      }
      setValue(raw)
    }

    const applyOptionalDate = (
      header: EmployeeBulkUpdateTemplateHeader,
      label: string,
      allowClear: boolean,
      setValue: (value: string | undefined) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        if (!allowClear) {
          rowMessages.push(`${label} cannot be cleared.`)
          return
        }
        setValue("")
        return
      }

      const parsedDate = parseDateCell(raw)
      if (!parsedDate) {
        rowMessages.push(`${label} must use YYYY-MM-DD format.`)
        return
      }
      setValue(parsedDate)
    }

    const applyOptionalNumber = (
      header: EmployeeBulkUpdateTemplateHeader,
      label: string,
      setValue: (value: number | undefined) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        setValue(undefined)
        return
      }

      const parsedNumber = parseNumberCell(raw)
      if (parsedNumber === null) {
        rowMessages.push(`${label} must be a valid number.`)
        return
      }

      setValue(parsedNumber)
    }

    const applyPositiveNumber = (
      header: EmployeeBulkUpdateTemplateHeader,
      label: string,
      setValue: (value: number | undefined) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        rowMessages.push(`${label} cannot be cleared.`)
        return
      }

      const parsedNumber = parseNumberCell(raw)
      if (parsedNumber === null || parsedNumber <= 0) {
        rowMessages.push(`${label} must be greater than zero.`)
        return
      }

      setValue(parsedNumber)
    }

    const applyIntegerNumber = (
      header: EmployeeBulkUpdateTemplateHeader,
      label: string,
      allowClear: boolean,
      setValue: (value: number | undefined) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        if (!allowClear) {
          rowMessages.push(`${label} cannot be cleared.`)
          return
        }
        setValue(undefined)
        return
      }

      const parsedNumber = parseNumberCell(raw)
      if (parsedNumber === null || !Number.isInteger(parsedNumber)) {
        rowMessages.push(`${label} must be a whole number.`)
        return
      }

      setValue(parsedNumber)
    }

    const applyBoolean = (
      header: EmployeeBulkUpdateTemplateHeader,
      label: string,
      setValue: (value: boolean) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        rowMessages.push(`${label} cannot be cleared.`)
        return
      }

      const parsedBoolean = parseBooleanCell(raw)
      if (!parsedBoolean.ok) {
        rowMessages.push(`${label} must be TRUE/FALSE, YES/NO, Y/N, or 1/0.`)
        return
      }

      setValue(parsedBoolean.value)
    }

    const applyLookup = (
      header: EmployeeBulkUpdateTemplateHeader,
      label: string,
      allowClear: boolean,
      resolver: (rawValue: string) => { ok: true; id: string } | { ok: false; error: string },
      setValue: (value: string | undefined) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        if (!allowClear) {
          rowMessages.push(`${label} cannot be cleared.`)
          return
        }
        setValue(undefined)
        return
      }

      const resolved = resolver(raw)
      if (!resolved.ok) {
        rowMessages.push(resolved.error)
        return
      }

      setValue(resolved.id)
    }

    applyRequiredText("firstName", "First Name", (value) => {
      updatePayload.firstName = value
    })
    applyRequiredText("lastName", "Last Name", (value) => {
      updatePayload.lastName = value
    })

    applyOptionalEmployeeText("middleName", (value) => {
      updatePayload.middleName = value
    })
    applyOptionalEmployeeText("suffix", (value) => {
      updatePayload.suffix = value
    })
    applyOptionalEmployeeText("maidenName", (value) => {
      updatePayload.maidenName = value
    })
    applyOptionalEmployeeText("nickname", (value) => {
      updatePayload.nickname = value
    })
    applyOptionalEmployeeText("birthPlace", (value) => {
      updatePayload.birthPlace = value
    })
    applyOptionalEmployeeText("nationality", (value) => {
      updatePayload.nationality = value
    })
    applyOptionalEmployeeText("citizenship", (value) => {
      updatePayload.citizenship = value
    })
    applyOptionalEmployeeText("biometricId", (value) => {
      updatePayload.biometricId = value
    })
    applyOptionalEmployeeText("rfidNumber", (value) => {
      updatePayload.rfidNumber = value
    })
    applyOptionalEmployeeText("wfhSchedule", (value) => {
      updatePayload.wfhSchedule = value
    })
    applyOptionalDate("birthDate", "Birth date", false, (value) => {
      updatePayload.birthDate = value
    })
    applyOptionalDate("hireDate", "Hire date", false, (value) => {
      updatePayload.hireDate = value
    })
    applyOptionalDate("applicationDate", "Application date", true, (value) => {
      updatePayload.applicationDate = value
    })
    applyOptionalDate("interviewDate", "Interview date", true, (value) => {
      updatePayload.interviewDate = value
    })
    applyOptionalDate("jobOfferDate", "Job offer date", true, (value) => {
      updatePayload.jobOfferDate = value
    })
    applyOptionalDate("probationStartDate", "Probation start date", true, (value) => {
      updatePayload.probationStartDate = value
    })
    applyOptionalDate("probationEndDate", "Probation end date", true, (value) => {
      updatePayload.probationEndDate = value
    })
    applyOptionalDate("regularizationDate", "Regularization date", true, (value) => {
      updatePayload.regularizationDate = value
    })
    applyOptionalDate("contractStartDate", "Contract start date", true, (value) => {
      updatePayload.contractStartDate = value
    })
    applyOptionalDate("contractEndDate", "Contract end date", true, (value) => {
      updatePayload.contractEndDate = value
    })

    applyOptionalNumber("heightCm", "Height (cm)", (value) => {
      updatePayload.heightCm = value
    })
    applyOptionalNumber("weightKg", "Weight (kg)", (value) => {
      updatePayload.weightKg = value
    })
    applyOptionalNumber("previousEmployerIncome", "Previous employer income", (value) => {
      updatePayload.previousEmployerIncome = value
    })
    applyOptionalNumber("previousEmployerTaxWithheld", "Previous employer tax withheld", (value) => {
      updatePayload.previousEmployerTaxWithheld = value
    })

    applyPositiveNumber("monthlyRate", "Monthly rate", (value) => {
      updatePayload.monthlyRate = value
    })
    applyIntegerNumber("monthlyDivisor", "Monthly divisor", false, (value) => {
      updatePayload.monthlyDivisor = value
    })
    applyPositiveNumber("hoursPerDay", "Hours per day", (value) => {
      updatePayload.hoursPerDay = value
    })
    applyIntegerNumber("numberOfDependents", "Number of dependents", false, (value) => {
      if (value !== undefined) {
        updatePayload.numberOfDependents = value
      }
    })

    applyOptionalSalaryText("salaryGrade", (value) => {
      updatePayload.salaryGrade = value
    })
    applyOptionalSalaryText("salaryBand", (value) => {
      updatePayload.salaryBand = value
    })
    applyOptionalSalaryText("minimumWageRegion", (value) => {
      updatePayload.minimumWageRegion = value
    })

    applyLookup("employmentStatus", "Employment status", false, resolveEmploymentStatus, (value) => {
      updatePayload.employmentStatusId = value
    })
    applyLookup("employmentType", "Employment type", false, resolveEmploymentType, (value) => {
      updatePayload.employmentTypeId = value
    })
    applyLookup("employmentClass", "Employment class", false, resolveEmploymentClass, (value) => {
      updatePayload.employmentClassId = value
    })
    applyLookup("department", "Department", false, resolveDepartment, (value) => {
      updatePayload.departmentId = value
    })
    applyLookup("division", "Division", true, resolveDivision, (value) => {
      updatePayload.divisionId = value
    })
    applyLookup("position", "Position", false, resolvePosition, (value) => {
      updatePayload.positionId = value
    })
    applyLookup("rank", "Rank", true, resolveRank, (value) => {
      updatePayload.rankId = value
    })
    applyLookup("branch", "Branch", true, resolveBranch, (value) => {
      updatePayload.branchId = value
    })
    applyLookup("workSchedule", "Work schedule", true, resolveWorkSchedule, (value) => {
      updatePayload.workScheduleId = value
    })
    applyLookup("payPeriodPattern", "Pay period pattern", true, resolvePayPeriodPattern, (value) => {
      updatePayload.payPeriodPatternId = value
    })

    const rawManager = getCellValue(row, headerIndexMap, "reportingManagerEmployeeNumber").trim()
    if (rawManager) {
      if (isClearToken(rawManager)) {
        updatePayload.reportingManagerId = undefined
      } else {
        const managerId = managerIdByEmployeeNumber.get(normalizeBulkKey(rawManager))
        if (!managerId) {
          rowMessages.push(`Unknown manager employee number "${rawManager}".`)
        } else if (managerId === employee.id) {
          rowMessages.push("Reporting manager cannot be the same employee.")
        } else {
          updatePayload.reportingManagerId = managerId
        }
      }
    }

    const rawGender = getCellValue(row, headerIndexMap, "gender").trim()
    if (rawGender) {
      if (isClearToken(rawGender)) {
        updatePayload.genderId = undefined
      } else {
        const resolved = resolveGender(rawGender.toUpperCase())
        if (!resolved.ok) {
          rowMessages.push(resolved.error)
        } else {
          updatePayload.genderId = resolved.value
        }
      }
    }

    const rawCivilStatus = getCellValue(row, headerIndexMap, "civilStatus").trim()
    if (rawCivilStatus) {
      if (isClearToken(rawCivilStatus)) {
        updatePayload.civilStatusId = undefined
      } else {
        const resolved = resolveCivilStatus(rawCivilStatus.toUpperCase())
        if (!resolved.ok) {
          rowMessages.push(resolved.error)
        } else {
          updatePayload.civilStatusId = resolved.value
        }
      }
    }

    const rawReligion = getCellValue(row, headerIndexMap, "religion").trim()
    if (rawReligion) {
      if (isClearToken(rawReligion)) {
        updatePayload.religionId = undefined
      } else {
        const resolved = resolveReligion(rawReligion.toUpperCase())
        if (!resolved.ok) {
          rowMessages.push(resolved.error)
        } else {
          updatePayload.religionId = resolved.value
        }
      }
    }

    const rawBloodType = getCellValue(row, headerIndexMap, "bloodType").trim()
    if (rawBloodType) {
      if (isClearToken(rawBloodType)) {
        updatePayload.bloodTypeId = undefined
      } else {
        const resolved = resolveBloodType(rawBloodType.toUpperCase())
        if (!resolved.ok) {
          rowMessages.push(resolved.error)
        } else {
          updatePayload.bloodTypeId = resolved.value
        }
      }
    }

    const rawTaxStatus = getCellValue(row, headerIndexMap, "taxStatus").trim()
    if (rawTaxStatus) {
      if (isClearToken(rawTaxStatus)) {
        updatePayload.taxStatusId = undefined
      } else {
        const resolved = resolveTaxStatus(rawTaxStatus)
        if (!resolved.ok) {
          rowMessages.push(resolved.error)
        } else {
          updatePayload.taxStatusId = resolved.value
        }
      }
    }

    const applySensitiveIdField = (
      header: EmployeeBulkUpdateTemplateHeader,
      label: string,
      setValue: (value: string | undefined) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        rowMessages.push(`${label} cannot be cleared via CSV. Leave blank to keep the current value.`)
        return
      }
      setValue(raw)
    }

    applySensitiveIdField("tinNumber", "TIN number", (value) => {
      updatePayload.tinNumber = value
    })
    applySensitiveIdField("sssNumber", "SSS number", (value) => {
      updatePayload.sssNumber = value
    })
    applySensitiveIdField("philHealthNumber", "PhilHealth number", (value) => {
      updatePayload.philHealthNumber = value
    })
    applySensitiveIdField("pagIbigNumber", "Pag-IBIG number", (value) => {
      updatePayload.pagIbigNumber = value
    })
    applySensitiveIdField("umidNumber", "UMID number", (value) => {
      updatePayload.umidNumber = value
    })

    const applyContactField = (
      header: EmployeeBulkUpdateTemplateHeader,
      label: string,
      setValue: (value: string | undefined) => void
    ) => {
      const raw = getCellValue(row, headerIndexMap, header).trim()
      if (!raw) return
      if (isClearToken(raw)) {
        rowMessages.push(`${label} cannot be cleared via CSV. Leave blank to keep the current value.`)
        return
      }
      setValue(raw)
    }

    applyContactField("mobileNumber", "Mobile number", (value) => {
      updatePayload.mobileNumber = value
    })
    applyContactField("personalEmail", "Personal email", (value) => {
      updatePayload.personalEmail = value
    })

    applyBoolean("isSubstitutedFiling", "Substituted filing", (value) => {
      updatePayload.isSubstitutedFiling = value
    })
    applyBoolean("isOvertimeEligible", "Overtime eligible", (value) => {
      updatePayload.isOvertimeEligible = value
    })
    applyBoolean("isNightDiffEligible", "Night diff eligible", (value) => {
      updatePayload.isNightDiffEligible = value
    })
    applyBoolean("isAuthorizedSignatory", "Authorized signatory", (value) => {
      updatePayload.isAuthorizedSignatory = value
    })
    applyBoolean("isWfhEligible", "WFH eligible", (value) => {
      updatePayload.isWfhEligible = value
    })

    if (rowMessages.length > 0) {
      addRowError(row.lineNumber, employee.employeeNumber, rowMessages.join(" "))
      continue
    }

    processedRows += 1

    if (payload.dryRun) {
      updatedRows += 1
      continue
    }

    const result = await updateEmployeeProfileAction(updatePayload)
    if (!result.ok) {
      addRowError(row.lineNumber, employee.employeeNumber, result.error)
      continue
    }

    updatedRows += 1
  }

  if (!payload.dryRun && updatedRows > 0) {
    revalidatePath(`/${context.companyId}/employees`)
  }

  await createAuditLog({
    tableName: "Employee",
    recordId: context.companyId,
    action: "UPDATE",
    userId: context.userId,
    reason: payload.dryRun ? "EMPLOYEE_BULK_UPDATE_CSV_DRY_RUN" : "EMPLOYEE_BULK_UPDATE_CSV_APPLY",
    changes: [
      { fieldName: "totalRows", newValue: dataRows.length },
      { fieldName: "processedRows", newValue: processedRows },
      { fieldName: "updatedRows", newValue: updatedRows },
      { fieldName: "errorRows", newValue: errorRows },
      { fieldName: "skippedRows", newValue: skippedRows },
      { fieldName: "dryRun", newValue: payload.dryRun },
    ],
  })

  const successMessage = payload.dryRun
    ? `Dry run complete. ${updatedRows} row(s) validated${errorRows > 0 ? `, ${errorRows} row(s) with errors` : ""}.`
    : `Bulk update complete. ${updatedRows} employee row(s) updated${errorRows > 0 ? `, ${errorRows} row(s) failed` : ""}.`

  return {
    ok: true,
    message: successMessage,
    summary: {
      dryRun: payload.dryRun,
      totalRows: dataRows.length,
      processedRows,
      updatedRows,
      skippedRows,
      errorRows,
    },
    errors,
  }
}
