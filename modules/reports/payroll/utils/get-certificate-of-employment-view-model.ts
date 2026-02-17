import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly, toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CertificateOfEmploymentViewModel } from "@/modules/reports/payroll/types/report-view-models"
import {
  buildEmploymentDurationLabel,
  formatCertificateDateLabel,
  formatIssuedDateFormalLabel,
  type CertificateOfEmploymentPrintPayload,
} from "@/modules/reports/payroll/utils/certificate-of-employment-helpers"

type CertificateOfEmploymentInput = {
  companyId: string
  employeeId?: string
  signatoryId?: string
  signatoryDepartmentId?: string
  includeCompensation?: string | boolean
  certificateDate?: string
  purpose?: string
}

const parseBoolean = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

const roundToTwo = (value: number): number => Math.round(value * 100) / 100

const compactParts = (values: Array<string | null | undefined>): string[] =>
  values.map((value) => (value ?? "").trim()).filter((value) => value.length > 0)

const formatPhoneValue = (input: {
  countryCode: string | null
  areaCode: string | null
  number: string
  extension: string | null
}): string => {
  const parts = compactParts([input.countryCode, input.areaCode, input.number])
  const extension = (input.extension ?? "").trim()
  if (parts.length === 0) return ""
  return extension.length > 0 ? `${parts.join(" ")} ext ${extension}` : parts.join(" ")
}

const resolveIssueLocationLabel = (input: {
  city: string | null
  municipality: string | null
  province: string | null
  country: string
}): string => {
  const cityLike = input.city?.trim() || input.municipality?.trim() || input.province?.trim() || "City"
  const country = input.country.trim() || "Philippines"
  return `${cityLike}, ${country}`
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

const humanizeCodeLabel = (value: string | null | undefined, fallback: string): string => {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const toRateTypeLabel = (value: string | null | undefined): string => {
  const label = humanizeCodeLabel(value, "Monthly")
  return `${label} rate`
}
const SIGNATORY_POSITION_LABEL = "Admin Manager"

const resolveSignatorySignatureUrl = (input: {
  signatureUrl: string | null
  companyId: string
  employeeId: string
}): string | null => {
  const raw = input.signatureUrl?.trim() ?? ""
  if (!raw) return null

  if (raw.startsWith("private/")) {
    const url = new URL("/api/employee-signature", "http://localhost")
    url.searchParams.set("companyId", input.companyId)
    url.searchParams.set("employeeId", input.employeeId)
    url.searchParams.set("key", raw)
    return `${url.pathname}${url.search}`
  }

  return raw
}

const buildPersonName = (input: {
  firstName: string
  middleName?: string | null
  lastName: string
  suffix?: string | null
}): string =>
  [input.firstName, input.middleName?.trim() ?? "", input.lastName, input.suffix?.trim() ?? ""]
    .filter((part) => part.length > 0)
    .join(" ")

export type CertificateOfEmploymentWorkspaceViewModel = CertificateOfEmploymentViewModel

export type CertificateOfEmploymentPrintViewModel = {
  payload: CertificateOfEmploymentPrintPayload
  selectedEmployeeId: string
  includeCompensation: boolean
  purpose: string
}

export async function getCertificateOfEmploymentWorkspaceViewModel(
  input: CertificateOfEmploymentInput
): Promise<CertificateOfEmploymentWorkspaceViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const includeCompensation = parseBoolean(input.includeCompensation)
  const requestedEmployeeId = (input.employeeId ?? "").trim()
  const requestedSignatoryId = (input.signatoryId ?? "").trim()
  const purpose = (input.purpose ?? "").slice(0, 300)

  const parsedDate = input.certificateDate ? parsePhDateInputToUtcDateOnly(input.certificateDate) : null
  const certificateDate = parsedDate ?? toPhDateOnlyUtc()
  const certificateDateValue = toPhDateInputValue(certificateDate)

  const [company, employees] = await Promise.all([
    db.company.findUnique({
      where: { id: context.companyId },
      select: {
        name: true,
        legalName: true,
        logoUrl: true,
        websiteUrl: true,
        addresses: {
          where: { isPrimary: true, isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            street: true,
            barangay: true,
            city: true,
            municipality: true,
            province: true,
            country: true,
            postalCode: true,
          },
        },
        contacts: {
          where: { isActive: true },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            contactTypeId: true,
            countryCode: true,
            areaCode: true,
            number: true,
            extension: true,
          },
          take: 10,
        },
        emails: {
          where: { isActive: true },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            email: true,
          },
          take: 3,
        },
      },
    }),
    db.employee.findMany({
      where: {
        companyId: context.companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        departmentId: true,
        department: {
          select: {
            name: true,
          },
        },
        isActive: true,
        isAuthorizedSignatory: true,
        signatureUrl: true,
      },
      orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    }),
  ])

  const selectedEmployeeId =
    employees.find((employee) => employee.id === requestedEmployeeId)?.id ?? employees[0]?.id ?? ""

  const signatoryEmployees = employees.filter((employee) => employee.isActive && employee.isAuthorizedSignatory)

  const selectedSignatoryId =
    signatoryEmployees.find((signatory) => signatory.id === requestedSignatoryId)?.id ??
    signatoryEmployees[0]?.id ??
    ""

  const selectedSignatoryEmployee =
    signatoryEmployees.find((signatory) => signatory.id === selectedSignatoryId) ?? null

  const selectedSignatoryDepartmentId = ""
  const signatoryDepartmentName = SIGNATORY_POSITION_LABEL

  const signatoryName = selectedSignatoryEmployee
    ? buildPersonName({
        firstName: selectedSignatoryEmployee.firstName,
        middleName: selectedSignatoryEmployee.middleName,
        lastName: selectedSignatoryEmployee.lastName,
        suffix: selectedSignatoryEmployee.suffix,
      })
    : "Authorized Signatory"
  const signatorySignatureUrl = selectedSignatoryEmployee
    ? resolveSignatorySignatureUrl({
        signatureUrl: selectedSignatoryEmployee.signatureUrl,
        companyId: context.companyId,
        employeeId: selectedSignatoryEmployee.id,
      })
    : null

  const primaryAddress = company?.addresses[0] ?? null
  const primaryPhone =
    company?.contacts.find((contact) => contact.contactTypeId === "LANDLINE") ??
    company?.contacts.find((contact) => contact.contactTypeId === "MOBILE") ??
    company?.contacts[0] ??
    null
  const faxContact = company?.contacts.find((contact) => contact.contactTypeId === "FAX") ?? null
  const primaryEmail = company?.emails[0]?.email ?? null

  const addressLine1 = compactParts([primaryAddress?.street, primaryAddress?.barangay]).join(", ")
  const addressLine2 = compactParts([primaryAddress?.city, primaryAddress?.municipality, primaryAddress?.province]).join(", ")
  const addressLine3 = compactParts([primaryAddress?.postalCode, primaryAddress?.country ?? "Philippines"]).join(", ")
  const companyAddressLines = [addressLine1, addressLine2, addressLine3].filter((line) => line.length > 0)

  const companyContactLines = compactParts([
    primaryPhone ? `Tel ${formatPhoneValue(primaryPhone)}` : null,
    faxContact ? `Fax ${formatPhoneValue(faxContact)}` : null,
    primaryEmail ? `Email ${primaryEmail}` : null,
    company?.websiteUrl ? company.websiteUrl : null,
  ])

  const issueLocationLabel = resolveIssueLocationLabel({
    city: primaryAddress?.city ?? null,
    municipality: primaryAddress?.municipality ?? null,
    province: primaryAddress?.province ?? null,
    country: primaryAddress?.country ?? "Philippines",
  })

  const employee = selectedEmployeeId
    ? await db.employee.findFirst({
        where: {
          id: selectedEmployeeId,
          companyId: context.companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
          hireDate: true,
          separationDate: true,
          position: {
            select: {
              name: true,
            },
          },
          department: {
            select: {
              name: true,
            },
          },
          salary: {
            select: {
              baseSalary: true,
              currency: true,
              salaryRateTypeCode: true,
              isActive: true,
            },
          },
        },
      })
    : null

  const employeeName = employee
    ? buildPersonName({
        firstName: employee.firstName,
        middleName: employee.middleName,
        lastName: employee.lastName,
        suffix: employee.suffix,
      })
    : ""

  const monthlySalaryAmount = employee?.salary && employee.salary.isActive ? Number(employee.salary.baseSalary) : null
  const annualSalaryAmount = monthlySalaryAmount === null ? null : roundToTwo(monthlySalaryAmount * 12)
  const midYearBonusAmount = monthlySalaryAmount === null ? null : roundToTwo(monthlySalaryAmount * 0.5)
  const thirteenthMonthBonusAmount = monthlySalaryAmount === null ? null : roundToTwo(monthlySalaryAmount)

  return {
    companyId: context.companyId,
    companyName: company?.name ?? context.companyName,
    companyLegalName: company?.legalName ?? null,
    companyLogoUrl: company?.logoUrl ?? null,
    companyAddressLines,
    companyContactLines,
    issueLocationLabel,
    certificateDateValue,
    includeCompensation,
    purpose,
    selectedEmployeeId,
    selectedSignatoryId,
    selectedSignatoryDepartmentId,
    signatoryName,
    signatorySignatureUrl,
    signatoryDepartmentName,
    generatedAtLabel: toDateTimeLabel(new Date()),
    options: {
      employees: employees.map((employeeOption) => ({
        id: employeeOption.id,
        label: `${employeeOption.employeeNumber} - ${employeeOption.lastName}, ${employeeOption.firstName}${
          employeeOption.isActive ? "" : " (Inactive)"
        }`,
      })),
      signatories: signatoryEmployees.map((signatory) => ({
        id: signatory.id,
        label: buildPersonName({
          firstName: signatory.firstName,
          middleName: signatory.middleName,
          lastName: signatory.lastName,
          suffix: signatory.suffix,
        }),
        defaultDepartmentId: signatory.departmentId,
      })),
      signatoryDepartments: [],
    },
    employee: employee
      ? {
          employeeId: employee.id,
          employeeNumber: employee.employeeNumber,
          employeeName,
          positionName: employee.position?.name ?? "Unassigned Position",
          departmentName: employee.department?.name ?? "Unassigned Department",
          hireDateValue: toPhDateInputValue(employee.hireDate),
          separationDateValue: employee.separationDate ? toPhDateInputValue(employee.separationDate) : null,
          employmentDurationLabel: buildEmploymentDurationLabel(
            employee.hireDate,
            certificateDate,
            employee.separationDate ?? null
          ),
          monthlySalaryAmount,
          annualSalaryAmount,
          midYearBonusAmount,
          thirteenthMonthBonusAmount,
          compensationCurrency: employee.salary?.currency ?? "PHP",
          compensationRateTypeLabel: toRateTypeLabel(employee.salary?.salaryRateTypeCode ?? null),
        }
      : null,
  }
}

export const toCertificateOfEmploymentPrintPayload = (
  viewModel: CertificateOfEmploymentWorkspaceViewModel
): CertificateOfEmploymentPrintViewModel | null => {
  if (!viewModel.employee) return null

  const certificateDate = parsePhDateInputToUtcDateOnly(viewModel.certificateDateValue) ?? toPhDateOnlyUtc()
  const hireDate = parsePhDateInputToUtcDateOnly(viewModel.employee.hireDateValue)
  if (!hireDate) return null

  const separationDate = viewModel.employee.separationDateValue
    ? parsePhDateInputToUtcDateOnly(viewModel.employee.separationDateValue)
    : null

  const payload: CertificateOfEmploymentPrintPayload = {
    companyName: viewModel.companyName,
    companyLegalName: viewModel.companyLegalName,
    companyLogoUrl: viewModel.companyLogoUrl,
    companyAddressLines: viewModel.companyAddressLines,
    companyContactLines: viewModel.companyContactLines,
    issueLocationLabel: viewModel.issueLocationLabel,
    employeeName: viewModel.employee.employeeName,
    employeeNumber: viewModel.employee.employeeNumber,
    positionName: viewModel.employee.positionName,
    departmentName: viewModel.employee.departmentName,
    hireDateLabel: formatCertificateDateLabel(hireDate),
    separationDateLabel: separationDate ? formatCertificateDateLabel(separationDate) : null,
    employmentDurationLabel: viewModel.employee.employmentDurationLabel,
    certificateDateLabel: formatCertificateDateLabel(certificateDate),
    issuedDateFormalLabel: formatIssuedDateFormalLabel(certificateDate),
    purpose: viewModel.purpose,
    includeCompensation: viewModel.includeCompensation,
    monthlySalaryAmount: viewModel.employee.monthlySalaryAmount,
    annualSalaryAmount: viewModel.employee.annualSalaryAmount,
    midYearBonusAmount: viewModel.employee.midYearBonusAmount,
    thirteenthMonthBonusAmount: viewModel.employee.thirteenthMonthBonusAmount,
    totalAnnualCompensationAmount:
      viewModel.employee.annualSalaryAmount !== null &&
      viewModel.employee.midYearBonusAmount !== null &&
      viewModel.employee.thirteenthMonthBonusAmount !== null
        ? roundToTwo(
            viewModel.employee.annualSalaryAmount +
              viewModel.employee.midYearBonusAmount +
              viewModel.employee.thirteenthMonthBonusAmount
          )
        : null,
    compensationCurrency: viewModel.employee.compensationCurrency,
    compensationRateTypeLabel: viewModel.employee.compensationRateTypeLabel,
    signatoryName: viewModel.signatoryName,
    signatorySignatureUrl: viewModel.signatorySignatureUrl,
    signatoryDepartmentName: viewModel.signatoryDepartmentName,
  }

  return {
    payload,
    selectedEmployeeId: viewModel.employee.employeeId,
    includeCompensation: viewModel.includeCompensation,
    purpose: viewModel.purpose,
  }
}
