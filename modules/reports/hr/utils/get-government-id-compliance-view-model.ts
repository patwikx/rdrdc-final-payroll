import { db } from "@/lib/db"
import { toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

type GovernmentIdComplianceInput = {
  companyId: string
  departmentId?: string
  includeInactive?: string | boolean
  complianceScope?: string
}

type GovernmentIdStatus = "VALID" | "MISSING" | "LOW_QUALITY"

export type GovernmentIdComplianceScope = "all" | "compliant" | "incomplete" | "missing-any" | "quality-issues"

export type GovernmentIdComplianceRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  isActive: boolean
  tinStatus: GovernmentIdStatus
  tinValue: string | null
  sssStatus: GovernmentIdStatus
  sssValue: string | null
  philHealthStatus: GovernmentIdStatus
  philHealthValue: string | null
  pagIbigStatus: GovernmentIdStatus
  pagIbigValue: string | null
  completionRate: number
  isCompliant: boolean
  missingIdLabels: string[]
  qualityIssueLabels: string[]
}

export type GovernmentIdComplianceViewModel = {
  companyId: string
  companyName: string
  asOfDateValue: string
  generatedAtLabel: string
  filters: {
    departmentId: string
    includeInactive: boolean
    complianceScope: GovernmentIdComplianceScope
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  summary: {
    totalEmployees: number
    compliantCount: number
    incompleteCount: number
    missingAnyCount: number
    qualityIssueCount: number
    averageCompletionRate: number
  }
  rows: GovernmentIdComplianceRow[]
}

const REQUIRED_IDS = [
  { idTypeCode: "TIN", label: "TIN" },
  { idTypeCode: "SSS", label: "SSS" },
  { idTypeCode: "PHILHEALTH", label: "PhilHealth" },
  { idTypeCode: "PAGIBIG", label: "Pag-IBIG" },
] as const

const parseBoolean = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

const parseComplianceScope = (value: string | undefined): GovernmentIdComplianceScope => {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "compliant") return "compliant"
  if (normalized === "incomplete") return "incomplete"
  if (normalized === "missing-any") return "missing-any"
  if (normalized === "quality-issues") return "quality-issues"
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

const toScopeLabel = (scope: GovernmentIdComplianceScope): string => {
  if (scope === "compliant") return "Compliant Only"
  if (scope === "incomplete") return "Incomplete Only"
  if (scope === "missing-any") return "Missing Any Required ID"
  if (scope === "quality-issues") return "Low-Quality ID Values"
  return "All Records"
}

export const governmentIdComplianceScopeToLabel = toScopeLabel

const hasText = (value: string | null | undefined): boolean => Boolean(value && value.trim().length > 0)

const normalizeIdValue = (value: string): string => value.trim()

const evaluateGovernmentIdStatus = (value: string | null | undefined): GovernmentIdStatus => {
  if (!hasText(value)) return "MISSING"
  const normalized = normalizeIdValue(value as string)
  const visibleToken = normalized.replace(/[^0-9A-Za-z]/g, "")
  const hasDigit = /\d/.test(normalized)
  if (!hasDigit || visibleToken.length < 4) return "LOW_QUALITY"
  return "VALID"
}

const resolveIdValue = (
  records: Array<{ idTypeId: string; idNumberMasked: string | null }>,
  idTypeCode: string
): string | null => {
  const matched = records.filter((item) => item.idTypeId === idTypeCode)
  if (matched.length === 0) return null
  const candidateWithValue = matched.find((item) => hasText(item.idNumberMasked))
  return candidateWithValue?.idNumberMasked ?? matched[0]?.idNumberMasked ?? null
}

const roundToTwo = (value: number): number => Math.round(value * 100) / 100

const mapRows = (
  rows: Array<{
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    isActive: boolean
    department: { name: string } | null
    governmentIds: Array<{ idTypeId: string; idNumberMasked: string | null }>
  }>
): GovernmentIdComplianceRow[] => {
  return rows
    .map((row) => {
      const tinValue = resolveIdValue(row.governmentIds, "TIN")
      const sssValue = resolveIdValue(row.governmentIds, "SSS")
      const philHealthValue = resolveIdValue(row.governmentIds, "PHILHEALTH")
      const pagIbigValue = resolveIdValue(row.governmentIds, "PAGIBIG")

      const tinStatus = evaluateGovernmentIdStatus(tinValue)
      const sssStatus = evaluateGovernmentIdStatus(sssValue)
      const philHealthStatus = evaluateGovernmentIdStatus(philHealthValue)
      const pagIbigStatus = evaluateGovernmentIdStatus(pagIbigValue)

      const statuses: Array<{ label: string; status: GovernmentIdStatus }> = [
        { label: "TIN", status: tinStatus },
        { label: "SSS", status: sssStatus },
        { label: "PhilHealth", status: philHealthStatus },
        { label: "Pag-IBIG", status: pagIbigStatus },
      ]

      const validCount = statuses.filter((item) => item.status === "VALID").length
      const completionRate = roundToTwo((validCount / REQUIRED_IDS.length) * 100)
      const missingIdLabels = statuses.filter((item) => item.status === "MISSING").map((item) => item.label)
      const qualityIssueLabels = statuses.filter((item) => item.status === "LOW_QUALITY").map((item) => item.label)
      const isCompliant = statuses.every((item) => item.status === "VALID")

      return {
        employeeId: row.id,
        employeeNumber: row.employeeNumber,
        employeeName: `${row.lastName}, ${row.firstName}`,
        departmentName: row.department?.name ?? null,
        isActive: row.isActive,
        tinStatus,
        tinValue,
        sssStatus,
        sssValue,
        philHealthStatus,
        philHealthValue,
        pagIbigStatus,
        pagIbigValue,
        completionRate,
        isCompliant,
        missingIdLabels,
        qualityIssueLabels,
      }
    })
    .sort((a, b) => {
      if (a.isCompliant !== b.isCompliant) {
        return a.isCompliant ? 1 : -1
      }
      if (a.completionRate !== b.completionRate) {
        return a.completionRate - b.completionRate
      }
      return a.employeeName.localeCompare(b.employeeName)
    })
}

const scopeMatches = (scope: GovernmentIdComplianceScope, row: GovernmentIdComplianceRow): boolean => {
  if (scope === "all") return true
  if (scope === "compliant") return row.isCompliant
  if (scope === "incomplete") return !row.isCompliant
  if (scope === "missing-any") return row.missingIdLabels.length > 0
  return row.qualityIssueLabels.length > 0
}

export const getGovernmentIdComplianceCsvRows = (rows: GovernmentIdComplianceRow[]): string[][] => {
  return rows.map((row) => [
    row.employeeNumber,
    row.employeeName,
    row.departmentName ?? "UNASSIGNED",
    row.isActive ? "ACTIVE" : "INACTIVE",
    row.tinStatus,
    row.tinValue ?? "",
    row.sssStatus,
    row.sssValue ?? "",
    row.philHealthStatus,
    row.philHealthValue ?? "",
    row.pagIbigStatus,
    row.pagIbigValue ?? "",
    `${row.completionRate.toFixed(2)}%`,
    row.missingIdLabels.join(" | "),
    row.qualityIssueLabels.join(" | "),
  ])
}

export async function getGovernmentIdComplianceViewModel(
  input: GovernmentIdComplianceInput
): Promise<GovernmentIdComplianceViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const departmentId = (input.departmentId ?? "").trim()
  const includeInactive = parseBoolean(input.includeInactive)
  const complianceScope = parseComplianceScope(input.complianceScope)
  const asOfDate = toPhDateOnlyUtc()

  const [rows, departments] = await Promise.all([
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
        governmentIds: {
          where: { isActive: true },
          select: { idTypeId: true, idNumberMasked: true },
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

  const mappedRows = mapRows(rows).filter((row) => scopeMatches(complianceScope, row))
  const totalEmployees = mappedRows.length
  const compliantCount = mappedRows.filter((row) => row.isCompliant).length
  const incompleteCount = totalEmployees - compliantCount
  const missingAnyCount = mappedRows.filter((row) => row.missingIdLabels.length > 0).length
  const qualityIssueCount = mappedRows.filter((row) => row.qualityIssueLabels.length > 0).length
  const averageCompletionRate =
    totalEmployees === 0
      ? 0
      : roundToTwo(mappedRows.reduce((sum, row) => sum + row.completionRate, 0) / totalEmployees)

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
      totalEmployees,
      compliantCount,
      incompleteCount,
      missingAnyCount,
      qualityIssueCount,
      averageCompletionRate,
    },
    rows: mappedRows,
  }
}
