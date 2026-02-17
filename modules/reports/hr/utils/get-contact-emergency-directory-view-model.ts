import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const roundToTwo = (value: number): number => Math.round(value * 100) / 100

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

const parseBoolean = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

const parseDirectoryScope = (
  value: string | undefined
): "all" | "missing-primary-contact" | "missing-emergency-contact" | "missing-any-critical" => {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "missing-primary-contact") return "missing-primary-contact"
  if (normalized === "missing-emergency-contact") return "missing-emergency-contact"
  if (normalized === "missing-any-critical") return "missing-any-critical"
  return "all"
}

const hasText = (value: string | null | undefined): boolean => Boolean(value && value.trim().length > 0)

const humanizeCode = (value: string): string => {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const formatContactNumber = (input: {
  countryCode: string | null
  areaCode: string | null
  number: string
  extension: string | null
}): string => {
  const parts = [input.countryCode, input.areaCode, input.number]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0)
  if (parts.length === 0) return ""
  const extension = input.extension?.trim() ?? ""
  return extension.length > 0 ? `${parts.join(" ")} ext ${extension}` : parts.join(" ")
}

type ContactEmergencyDirectoryInput = {
  companyId: string
  departmentId?: string
  includeInactive?: string | boolean
  directoryScope?: string
}

export type ContactEmergencyDirectoryRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  isActive: boolean
  primaryContactNumber: string | null
  allContactNumbersLabel: string
  primaryEmail: string | null
  allEmailsLabel: string
  primaryEmergencyContactName: string | null
  primaryEmergencyRelationship: string | null
  primaryEmergencyContactNumber: string | null
  allEmergencyContactsLabel: string
  hasPrimaryContact: boolean
  hasEmergencyContact: boolean
  missingFlags: string[]
}

export type ContactEmergencyDirectoryViewModel = {
  companyId: string
  companyName: string
  generatedAtLabel: string
  filters: {
    departmentId: string
    includeInactive: boolean
    directoryScope: "all" | "missing-primary-contact" | "missing-emergency-contact" | "missing-any-critical"
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  summary: {
    totalEmployees: number
    withPrimaryContact: number
    missingPrimaryContact: number
    withEmergencyContact: number
    missingEmergencyContact: number
    readinessRate: number
  }
  rows: ContactEmergencyDirectoryRow[]
}

const mapRows = (
  rows: Array<{
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    isActive: boolean
    department: { name: string } | null
    contacts: Array<{
      contactTypeId: string
      countryCode: string | null
      areaCode: string | null
      number: string
      extension: string | null
      isPrimary: boolean
    }>
    emails: Array<{
      email: string
      isPrimary: boolean
    }>
    emergencyContacts: Array<{
      name: string
      relationshipId: string
      mobileNumber: string | null
      landlineNumber: string | null
      priority: number
    }>
  }>
): ContactEmergencyDirectoryRow[] => {
  return rows
    .map((row) => {
      const orderedContacts = [...row.contacts].sort((a, b) => {
        if (a.isPrimary === b.isPrimary) return 0
        return a.isPrimary ? -1 : 1
      })
      const primaryContact = orderedContacts.find((item) => item.isPrimary) ?? orderedContacts[0] ?? null
      const primaryContactNumber = primaryContact ? formatContactNumber(primaryContact) : null
      const hasPrimaryContact = hasText(primaryContactNumber)
      const allContactNumbers = orderedContacts
        .map((contact) => {
          const formatted = formatContactNumber(contact)
          if (!hasText(formatted)) return null
          const contactType = humanizeCode(contact.contactTypeId)
          return `${contactType}: ${formatted}${contact.isPrimary ? " (Primary)" : ""}`
        })
        .filter((value): value is string => value !== null)
      const allContactNumbersLabel = allContactNumbers.length > 0 ? allContactNumbers.join("\n") : "N/A"

      const orderedEmails = [...row.emails].sort((a, b) => {
        if (a.isPrimary === b.isPrimary) return 0
        return a.isPrimary ? -1 : 1
      })
      const primaryEmail = orderedEmails.find((item) => item.isPrimary)?.email ?? orderedEmails[0]?.email ?? null
      const allEmails = orderedEmails
        .map((item) => {
          const email = item.email.trim()
          if (!email) return null
          return `${email}${item.isPrimary ? " (Primary)" : ""}`
        })
        .filter((value): value is string => value !== null)
      const allEmailsLabel = allEmails.length > 0 ? allEmails.join("\n") : "N/A"

      const orderedEmergencyContacts = [...row.emergencyContacts].sort((a, b) => a.priority - b.priority)
      const primaryEmergency = orderedEmergencyContacts[0] ?? null
      const primaryEmergencyContactNumber = primaryEmergency
        ? [primaryEmergency.mobileNumber, primaryEmergency.landlineNumber]
            .map((value) => value?.trim() ?? "")
            .find((value) => value.length > 0) ?? null
        : null
      const hasEmergencyContact =
        orderedEmergencyContacts.length > 0 &&
        orderedEmergencyContacts.some(
          (contact) => hasText(contact.mobileNumber) || hasText(contact.landlineNumber)
        )
      const primaryEmergencyContactName = primaryEmergency?.name ?? null
      const primaryEmergencyRelationship = primaryEmergency ? humanizeCode(primaryEmergency.relationshipId) : null
      const allEmergencyContacts = orderedEmergencyContacts.map((contact) => {
        const numbers = [contact.mobileNumber?.trim(), contact.landlineNumber?.trim()]
          .filter((value): value is string => Boolean(value && value.length > 0))
          .join(" / ")
        const relation = humanizeCode(contact.relationshipId)
        const details = numbers.length > 0 ? ` - ${numbers}` : " - N/A"
        return `${contact.name} (${relation})${details}`
      })
      const allEmergencyContactsLabel = allEmergencyContacts.length > 0 ? allEmergencyContacts.join("\n") : "N/A"

      const missingFlags: string[] = []
      if (!hasPrimaryContact) missingFlags.push("Primary Contact Number")
      if (!hasEmergencyContact) missingFlags.push("Emergency Contact Number")

      return {
        employeeId: row.id,
        employeeNumber: row.employeeNumber,
        employeeName: `${row.lastName}, ${row.firstName}`,
        departmentName: row.department?.name ?? null,
        isActive: row.isActive,
        primaryContactNumber,
        allContactNumbersLabel,
        primaryEmail,
        allEmailsLabel,
        primaryEmergencyContactName,
        primaryEmergencyRelationship,
        primaryEmergencyContactNumber,
        allEmergencyContactsLabel,
        hasPrimaryContact,
        hasEmergencyContact,
        missingFlags,
      }
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
}

export const getContactEmergencyDirectoryCsvRows = (rows: ContactEmergencyDirectoryRow[]): string[][] => {
  return rows.map((row) => [
    row.employeeNumber,
    row.employeeName,
    row.departmentName ?? "UNASSIGNED",
    row.isActive ? "ACTIVE" : "INACTIVE",
    row.primaryContactNumber ?? "N/A",
    row.allContactNumbersLabel.replace(/\n/g, " | "),
    row.primaryEmail ?? "N/A",
    row.allEmailsLabel.replace(/\n/g, " | "),
    row.primaryEmergencyContactName ?? "N/A",
    row.primaryEmergencyRelationship ?? "N/A",
    row.primaryEmergencyContactNumber ?? "N/A",
    row.allEmergencyContactsLabel.replace(/\n/g, " | "),
    row.missingFlags.join(" | "),
  ])
}

export async function getContactEmergencyDirectoryViewModel(
  input: ContactEmergencyDirectoryInput
): Promise<ContactEmergencyDirectoryViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const departmentId = (input.departmentId ?? "").trim()
  const includeInactive = parseBoolean(input.includeInactive)
  const directoryScope = parseDirectoryScope(input.directoryScope)

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
        department: {
          select: {
            name: true,
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
            isPrimary: true,
          },
        },
        emails: {
          where: { isActive: true },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            email: true,
            isPrimary: true,
          },
        },
        emergencyContacts: {
          where: { isActive: true },
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
          select: {
            name: true,
            relationshipId: true,
            mobileNumber: true,
            landlineNumber: true,
            priority: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { employeeNumber: "asc" }],
    }),
    db.department.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ])

  const mappedRows = mapRows(employees)
  const scopedRows =
    directoryScope === "all"
      ? mappedRows
      : mappedRows.filter((row) => {
          if (directoryScope === "missing-primary-contact") return !row.hasPrimaryContact
          if (directoryScope === "missing-emergency-contact") return !row.hasEmergencyContact
          return !row.hasPrimaryContact || !row.hasEmergencyContact
        })

  const totalEmployees = scopedRows.length
  const withPrimaryContact = scopedRows.filter((row) => row.hasPrimaryContact).length
  const missingPrimaryContact = totalEmployees - withPrimaryContact
  const withEmergencyContact = scopedRows.filter((row) => row.hasEmergencyContact).length
  const missingEmergencyContact = totalEmployees - withEmergencyContact
  const readinessRate =
    totalEmployees === 0
      ? 0
      : roundToTwo(
          (scopedRows.filter((row) => row.hasPrimaryContact && row.hasEmergencyContact).length / totalEmployees) *
            100
        )

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    generatedAtLabel: toDateTimeLabel(new Date()),
    filters: {
      departmentId,
      includeInactive,
      directoryScope,
    },
    options: {
      departments: departments.map((department) => ({
        id: department.id,
        label: `${department.name}${department.isActive ? "" : " (Inactive)"}`,
      })),
    },
    summary: {
      totalEmployees,
      withPrimaryContact,
      missingPrimaryContact,
      withEmergencyContact,
      missingEmergencyContact,
      readinessRate,
    },
    rows: scopedRows,
  }
}
