import { toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

export type ComplianceScope = "all" | "expiring-30" | "expired-only" | "missing-records"

type TrainingCertificationComplianceInput = {
  companyId: string
  departmentId?: string
  includeInactive?: string | boolean
  complianceScope?: string
}

export type TrainingCertificationComplianceRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  isActive: boolean
  trainingCount: number
  certificationCount: number
  licenseCount: number
  latestTrainingDateValue: string | null
  latestCredentialExpiryDateValue: string | null
  expiredCredentialsCount: number
  expiringSoonCredentialsCount: number
  complianceStatus: "COMPLIANT" | "EXPIRING_SOON" | "EXPIRED" | "NO_RECORD"
  complianceNotes: string
}

export type TrainingCertificationComplianceViewModel = {
  companyId: string
  companyName: string
  asOfDateValue: string
  generatedAtLabel: string
  filters: {
    departmentId: string
    includeInactive: boolean
    complianceScope: ComplianceScope
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  summary: {
    totalEmployees: number
    compliantCount: number
    expiringSoonCount: number
    expiredCount: number
    noRecordCount: number
  }
  rows: TrainingCertificationComplianceRow[]
}

const parseBoolean = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

const parseComplianceScope = (value: string | undefined): ComplianceScope => {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "expiring-30") return "expiring-30"
  if (normalized === "expired-only") return "expired-only"
  if (normalized === "missing-records") return "missing-records"
  return "all"
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

const toDayDifference = (targetDate: Date, referenceDate: Date): number => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((targetDate.getTime() - referenceDate.getTime()) / MS_PER_DAY)
}

const toComplianceScopeLabel = (scope: ComplianceScope): string => {
  if (scope === "expiring-30") return "Expiring in 30 Days"
  if (scope === "expired-only") return "Expired Only"
  if (scope === "missing-records") return "Missing Records"
  return "All Records"
}

export const complianceScopeToLabel = toComplianceScopeLabel

const mapRows = (
  rows: Array<{
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    isActive: boolean
    department: { name: string } | null
    trainings: Array<{
      trainingDate: Date | null
      trainingEndDate: Date | null
    }>
    certifications: Array<{
      expiryDate: Date | null
    }>
    licenses: Array<{
      expiryDate: Date | null
    }>
  }>,
  asOfDate: Date
): TrainingCertificationComplianceRow[] => {
  return rows
    .map((row) => {
      const trainingCount = row.trainings.length
      const certificationCount = row.certifications.length
      const licenseCount = row.licenses.length
      const credentialExpiries = [...row.certifications, ...row.licenses]
        .map((item) => item.expiryDate)
        .filter((date): date is Date => date !== null)

      let latestTrainingDate: Date | null = null
      for (const item of row.trainings) {
        const candidate = item.trainingEndDate ?? item.trainingDate
        if (!candidate) continue
        if (!latestTrainingDate || candidate.getTime() > latestTrainingDate.getTime()) {
          latestTrainingDate = candidate
        }
      }

      let latestCredentialExpiryDate: Date | null = null
      for (const expiryDate of credentialExpiries) {
        if (!latestCredentialExpiryDate || expiryDate.getTime() > latestCredentialExpiryDate.getTime()) {
          latestCredentialExpiryDate = expiryDate
        }
      }

      let expiredCredentialsCount = 0
      let expiringSoonCredentialsCount = 0
      for (const expiryDate of credentialExpiries) {
        const diffDays = toDayDifference(expiryDate, asOfDate)
        if (diffDays < 0) {
          expiredCredentialsCount += 1
        } else if (diffDays <= 30) {
          expiringSoonCredentialsCount += 1
        }
      }

      const hasAnyRecord = trainingCount + certificationCount + licenseCount > 0
      const complianceStatus: TrainingCertificationComplianceRow["complianceStatus"] = !hasAnyRecord
        ? "NO_RECORD"
        : expiredCredentialsCount > 0
          ? "EXPIRED"
          : expiringSoonCredentialsCount > 0
            ? "EXPIRING_SOON"
            : "COMPLIANT"

      let complianceNotes = "No expired or expiring credentials."
      if (!hasAnyRecord) {
        complianceNotes = "No training, certification, or license records."
      } else if (expiredCredentialsCount > 0 && expiringSoonCredentialsCount > 0) {
        complianceNotes = `${expiredCredentialsCount} expired and ${expiringSoonCredentialsCount} expiring in 30 days.`
      } else if (expiredCredentialsCount > 0) {
        complianceNotes = `${expiredCredentialsCount} expired credential(s).`
      } else if (expiringSoonCredentialsCount > 0) {
        complianceNotes = `${expiringSoonCredentialsCount} credential(s) expiring in 30 days.`
      }

      return {
        employeeId: row.id,
        employeeNumber: row.employeeNumber,
        employeeName: `${row.lastName}, ${row.firstName}`,
        departmentName: row.department?.name ?? null,
        isActive: row.isActive,
        trainingCount,
        certificationCount,
        licenseCount,
        latestTrainingDateValue: latestTrainingDate ? toPhDateInputValue(latestTrainingDate) : null,
        latestCredentialExpiryDateValue: latestCredentialExpiryDate ? toPhDateInputValue(latestCredentialExpiryDate) : null,
        expiredCredentialsCount,
        expiringSoonCredentialsCount,
        complianceStatus,
        complianceNotes,
      }
    })
    .sort((a, b) => {
      const order = { EXPIRED: 0, EXPIRING_SOON: 1, NO_RECORD: 2, COMPLIANT: 3 }
      const statusDiff = order[a.complianceStatus] - order[b.complianceStatus]
      if (statusDiff !== 0) return statusDiff
      return a.employeeName.localeCompare(b.employeeName)
    })
}

const scopeMatches = (scope: ComplianceScope, row: TrainingCertificationComplianceRow): boolean => {
  if (scope === "all") return true
  if (scope === "expiring-30") return row.expiringSoonCredentialsCount > 0
  if (scope === "expired-only") return row.expiredCredentialsCount > 0
  return row.complianceStatus === "NO_RECORD"
}

export const getTrainingCertificationComplianceCsvRows = (
  rows: TrainingCertificationComplianceRow[]
): string[][] => {
  return rows.map((row) => [
    row.employeeNumber,
    row.employeeName,
    row.departmentName ?? "UNASSIGNED",
    row.isActive ? "ACTIVE" : "INACTIVE",
    row.complianceStatus,
    String(row.trainingCount),
    String(row.certificationCount),
    String(row.licenseCount),
    row.latestTrainingDateValue ?? "",
    row.latestCredentialExpiryDateValue ?? "",
    String(row.expiredCredentialsCount),
    String(row.expiringSoonCredentialsCount),
    row.complianceNotes,
  ])
}

export async function getTrainingCertificationComplianceViewModel(
  input: TrainingCertificationComplianceInput
): Promise<TrainingCertificationComplianceViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const asOfDate = toPhDateOnlyUtc()
  const departmentId = (input.departmentId ?? "").trim()
  const includeInactive = parseBoolean(input.includeInactive)
  const complianceScope = parseComplianceScope(input.complianceScope)

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
        trainings: {
          where: { isActive: true },
          select: {
            trainingDate: true,
            trainingEndDate: true,
          },
        },
        certifications: {
          where: { isActive: true },
          select: {
            expiryDate: true,
          },
        },
        licenses: {
          where: { isActive: true },
          select: {
            expiryDate: true,
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

  const mappedRows = mapRows(employees, asOfDate).filter((row) => scopeMatches(complianceScope, row))

  const compliantCount = mappedRows.filter((row) => row.complianceStatus === "COMPLIANT").length
  const expiringSoonCount = mappedRows.filter((row) => row.complianceStatus === "EXPIRING_SOON").length
  const expiredCount = mappedRows.filter((row) => row.complianceStatus === "EXPIRED").length
  const noRecordCount = mappedRows.filter((row) => row.complianceStatus === "NO_RECORD").length

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    asOfDateValue: toPhDateInputValue(asOfDate),
    generatedAtLabel: toDateTimeLabel(new Date()),
    filters: {
      departmentId,
      includeInactive,
      complianceScope,
    },
    options: {
      departments: departments.map((department) => ({
        id: department.id,
        label: `${department.name}${department.isActive ? "" : " (Inactive)"}`,
      })),
    },
    summary: {
      totalEmployees: mappedRows.length,
      compliantCount,
      expiringSoonCount,
      expiredCount,
      noRecordCount,
    },
    rows: mappedRows,
  }
}
