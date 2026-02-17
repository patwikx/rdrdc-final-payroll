import { db } from "@/lib/db"
import { toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type {
  DemographicEmployeeRow,
  DemographicReportViewModel,
} from "@/modules/reports/payroll/types/report-view-models"
import {
  aggregateDemographicBreakdown,
  computeAgeInYears,
  humanizeCodeLabel,
  resolveAgeBracketLabel,
} from "@/modules/reports/payroll/utils/demographic-report-helpers"

type DemographicReportInput = {
  companyId: string
  departmentId?: string
  includeInactive?: string | boolean
}

export type DemographicReportWorkspaceViewModel = DemographicReportViewModel & {
  generatedAtLabel: string
}

const roundToTwo = (value: number): number => Math.round(value * 100) / 100

const parseBoolean = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

const toDateTimeLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const normalizeText = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const joinAddressParts = (parts: Array<string | null | undefined>): string => {
  const compact = parts
    .map((part) => normalizeText(part))
    .filter((part): part is string => part !== null)

  return compact.length > 0 ? compact.join(", ") : "N/A"
}

const formatContactNumber = (input: {
  countryCode: string | null
  areaCode: string | null
  number: string
  extension: string | null
}): string => {
  const main = [normalizeText(input.countryCode), normalizeText(input.areaCode), normalizeText(input.number)]
    .filter((part): part is string => part !== null)
    .join(" ")
  if (!main) return "N/A"

  const extension = normalizeText(input.extension)
  return extension ? `${main} ext ${extension}` : main
}

const formatExpandedList = (values: string[]): string => {
  const normalized = values
    .map((value) => normalizeText(value))
    .filter((value): value is string => value !== null)

  if (normalized.length === 0) return "N/A"
  return normalized.join("\n")
}

const formatEducationLabel = (input: {
  educationLevelId: string
  schoolName: string
  course: string | null
  yearGraduated: number | null
}): string => {
  const level = humanizeCodeLabel(input.educationLevelId, "Unspecified")
  const school = normalizeText(input.schoolName) ?? "Unspecified School"
  const course = normalizeText(input.course)
  const details = [level, school, course, input.yearGraduated ? String(input.yearGraduated) : null]
    .filter((part): part is string => part !== null)
    .join(" | ")

  return details || "N/A"
}

const mapEmployeeRows = (
  rows: Array<{
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    isActive: boolean
    birthDate: Date
    hireDate: Date
    genderId: string | null
    civilStatusId: string | null
    department: { name: string } | null
    branch: { name: string } | null
    employmentStatus: { name: string } | null
    employmentType: { name: string } | null
    employmentClass: { name: string } | null
    addresses: Array<{
      street: string | null
      barangay: string | null
      city: string | null
      municipality: string | null
      province: string | null
      postalCode: string | null
      country: string | null
      isPrimary: boolean
    }>
    contacts: Array<{
      countryCode: string | null
      areaCode: string | null
      number: string
      extension: string | null
      isPrimary: boolean
    }>
    emergencyContacts: Array<{
      name: string
      relationshipId: string
      mobileNumber: string | null
      landlineNumber: string | null
    }>
    educations: Array<{
      educationLevelId: string
      schoolName: string
      course: string | null
      yearGraduated: number | null
    }>
  }>,
  asOfDate: Date
): DemographicEmployeeRow[] => {
  return rows.map((row) => {
    const ageYears = computeAgeInYears(row.birthDate, asOfDate)
    const addressRows = row.addresses.map((address) => {
      const line = joinAddressParts([
        address.street,
        address.barangay,
        address.city,
        address.municipality,
        address.province,
        address.postalCode,
        address.country,
      ])
      return address.isPrimary ? `${line} (Primary)` : line
    })
    const addressLabel = formatExpandedList(addressRows)

    const orderedContacts = [...row.contacts].sort((a, b) => {
      if (a.isPrimary === b.isPrimary) return 0
      return a.isPrimary ? -1 : 1
    })
    const contactNumbers = orderedContacts.map((contact) => formatContactNumber(contact))
    const contactNumbersLabel = formatExpandedList(contactNumbers)

    const emergencyContactNames = row.emergencyContacts.map(
      (contact) => `${contact.name} (${humanizeCodeLabel(contact.relationshipId, "Unspecified")})`
    )
    const emergencyContactNumbers = row.emergencyContacts.map(
      (contact) => normalizeText(contact.mobileNumber) ?? normalizeText(contact.landlineNumber) ?? "N/A"
    )
    const emergencyContactName = formatExpandedList(emergencyContactNames)
    const emergencyContactNumber = formatExpandedList(emergencyContactNumbers)

    const educationRows = row.educations.map((education) => formatEducationLabel(education))
    const educationLabel = formatExpandedList(educationRows)

    return {
      employeeId: row.id,
      employeeNumber: row.employeeNumber,
      employeeName: `${row.lastName}, ${row.firstName}`,
      departmentName: row.department?.name ?? null,
      branchName: row.branch?.name ?? null,
      genderLabel: humanizeCodeLabel(row.genderId, "Unspecified"),
      civilStatusLabel: humanizeCodeLabel(row.civilStatusId, "Unspecified"),
      employmentStatusName: row.employmentStatus?.name ?? "Unspecified",
      employmentTypeName: row.employmentType?.name ?? "Unspecified",
      employmentClassName: row.employmentClass?.name ?? "Unspecified",
      hireDateValue: toPhDateInputValue(row.hireDate),
      ageYears,
      ageBracketLabel: resolveAgeBracketLabel(ageYears),
      addressLabel,
      contactNumbersLabel,
      emergencyContactName,
      emergencyContactNumber,
      educationLabel,
      isActive: row.isActive,
    }
  })
}

export const getDemographicReportCsvRows = (viewModel: DemographicReportWorkspaceViewModel): string[][] => {
  const numberFormatter = new Intl.NumberFormat("en-PH")
  const decimalFormatter = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const selectedDepartmentLabel = viewModel.filters.departmentId
    ? (viewModel.options.departments.find((item) => item.id === viewModel.filters.departmentId)?.label ?? "Unknown")
    : "All departments"

  const rows: string[][] = [
    ["Demographic Report"],
    ["Company", viewModel.companyName],
    ["As Of", viewModel.asOfDateValue],
    ["Include Inactive", viewModel.filters.includeInactive ? "Yes" : "No"],
    ["Department Filter", selectedDepartmentLabel],
    [],
    ["Summary"],
    ["Total Employees", numberFormatter.format(viewModel.totalEmployees)],
    ["Active Employees", numberFormatter.format(viewModel.activeEmployees)],
    ["Inactive Employees", numberFormatter.format(viewModel.inactiveEmployees)],
    ["Average Age", viewModel.averageAgeYears === null ? "-" : decimalFormatter.format(viewModel.averageAgeYears)],
    [],
  ]

  const appendBreakdown = (title: string, breakdownRows: DemographicReportViewModel["breakdowns"]["byGender"]) => {
    rows.push([title])
    rows.push(["Group", "Count", "Percent"])
    if (breakdownRows.length === 0) {
      rows.push(["-", "0", "0.00%"])
    } else {
      for (const row of breakdownRows) {
        rows.push([row.label, String(row.count), `${decimalFormatter.format(row.percentage)}%`])
      }
    }
    rows.push([])
  }

  appendBreakdown("Gender", viewModel.breakdowns.byGender)
  appendBreakdown("Civil Status", viewModel.breakdowns.byCivilStatus)
  appendBreakdown("Employment Status", viewModel.breakdowns.byEmploymentStatus)
  appendBreakdown("Employment Type", viewModel.breakdowns.byEmploymentType)
  appendBreakdown("Employment Class", viewModel.breakdowns.byEmploymentClass)
  appendBreakdown("Department", viewModel.breakdowns.byDepartment)
  appendBreakdown("Branch", viewModel.breakdowns.byBranch)
  rows.push(["Employee Roster"])
  rows.push([
    "Employee Number",
    "Employee Name",
    "Department",
    "Branch",
    "Gender",
    "Civil Status",
    "Employment Status",
    "Hire Date",
    "Age",
    "Address",
    "Contact Number(s)",
    "Emergency Contact",
    "Emergency Contact Number",
    "Education",
  ])

  for (const employee of viewModel.employees) {
    rows.push([
      employee.employeeNumber,
      employee.employeeName,
      employee.departmentName ?? "UNASSIGNED",
      employee.branchName ?? "UNASSIGNED",
      employee.genderLabel,
      employee.civilStatusLabel,
      employee.employmentStatusName,
      employee.hireDateValue,
      employee.ageYears === null ? "-" : String(employee.ageYears),
      employee.addressLabel,
      employee.contactNumbersLabel,
      employee.emergencyContactName,
      employee.emergencyContactNumber,
      employee.educationLabel,
    ])
  }

  return rows
}

export async function getDemographicReportWorkspaceViewModel(
  input: DemographicReportInput
): Promise<DemographicReportWorkspaceViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const includeInactive = parseBoolean(input.includeInactive)
  const departmentId = (input.departmentId ?? "").trim()
  const asOfDate = toPhDateOnlyUtc()

  const [employees, departments] = await Promise.all([
    db.employee.findMany({
      where: {
        companyId: context.companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        isActive: true,
        birthDate: true,
        hireDate: true,
        genderId: true,
        civilStatusId: true,
        department: {
          select: {
            name: true,
          },
        },
        branch: {
          select: {
            name: true,
          },
        },
        employmentStatus: {
          select: {
            name: true,
          },
        },
        employmentType: {
          select: {
            name: true,
          },
        },
        employmentClass: {
          select: {
            name: true,
          },
        },
        addresses: {
          where: {
            isActive: true,
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            street: true,
            barangay: true,
            city: true,
            municipality: true,
            province: true,
            postalCode: true,
            country: true,
            isPrimary: true,
          },
        },
        contacts: {
          where: {
            isActive: true,
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            countryCode: true,
            areaCode: true,
            number: true,
            extension: true,
            isPrimary: true,
          },
        },
        emergencyContacts: {
          where: {
            isActive: true,
          },
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
          select: {
            name: true,
            relationshipId: true,
            mobileNumber: true,
            landlineNumber: true,
          },
        },
        educations: {
          where: {
            isActive: true,
          },
          orderBy: [{ yearGraduated: "desc" }, { createdAt: "desc" }],
          select: {
            educationLevelId: true,
            schoolName: true,
            course: true,
            yearGraduated: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { employeeNumber: "asc" }],
    }),
    db.department.findMany({
      where: {
        companyId: context.companyId,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ])

  const employeeRows = mapEmployeeRows(employees, asOfDate)
  const activeEmployees = employeeRows.reduce((sum, row) => sum + (row.isActive ? 1 : 0), 0)
  const inactiveEmployees = employeeRows.length - activeEmployees
  const ageRows = employeeRows.map((row) => row.ageYears).filter((value): value is number => value !== null)
  const averageAgeYears = ageRows.length > 0 ? roundToTwo(ageRows.reduce((sum, value) => sum + value, 0) / ageRows.length) : null

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    asOfDateValue: toPhDateInputValue(asOfDate),
    totalEmployees: employeeRows.length,
    activeEmployees,
    inactiveEmployees,
    averageAgeYears,
    filters: {
      departmentId,
      includeInactive,
    },
    options: {
      departments: departments.map((department) => ({
        id: department.id,
        label: `${department.name}${department.isActive ? "" : " (Inactive)"}`,
      })),
    },
    breakdowns: {
      byGender: aggregateDemographicBreakdown(
        employeeRows,
        (row) => ({ key: row.genderLabel, label: row.genderLabel }),
        "Unspecified"
      ),
      byCivilStatus: aggregateDemographicBreakdown(
        employeeRows,
        (row) => ({ key: row.civilStatusLabel, label: row.civilStatusLabel }),
        "Unspecified"
      ),
      byEmploymentStatus: aggregateDemographicBreakdown(
        employeeRows,
        (row) => ({ key: row.employmentStatusName, label: row.employmentStatusName }),
        "Unspecified"
      ),
      byEmploymentType: aggregateDemographicBreakdown(
        employeeRows,
        (row) => ({ key: row.employmentTypeName, label: row.employmentTypeName }),
        "Unspecified"
      ),
      byEmploymentClass: aggregateDemographicBreakdown(
        employeeRows,
        (row) => ({ key: row.employmentClassName, label: row.employmentClassName }),
        "Unspecified"
      ),
      byDepartment: aggregateDemographicBreakdown(
        employeeRows,
        (row) => ({ key: row.departmentName ?? "UNASSIGNED", label: row.departmentName ?? "Unassigned" }),
        "Unassigned"
      ),
      byBranch: aggregateDemographicBreakdown(
        employeeRows,
        (row) => ({ key: row.branchName ?? "UNASSIGNED", label: row.branchName ?? "Unassigned" }),
        "Unassigned"
      ),
      byAgeBracket: aggregateDemographicBreakdown(
        employeeRows,
        (row) => ({ key: row.ageBracketLabel, label: row.ageBracketLabel }),
        "Unspecified"
      ),
    },
    employees: employeeRows,
    generatedAtLabel: toDateTimeLabel(new Date()),
  }
}
