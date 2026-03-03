import type { ContributionType } from "@prisma/client"

const PAG_IBIG_PATTERN = /PAG[\s_-]*IBIG/i

export type PagIbigMappingCandidate = {
  deductionTypeId: string
  employeeId: string
  deductionTypeCode: string
  deductionTypeName: string
  reportingContributionType: ContributionType | null
}

export type PagIbigMappingIssue = {
  deductionTypeId: string
  deductionTypeCode: string
  deductionTypeName: string
  reportingContributionType: ContributionType | null
  recurringCount: number
  affectedEmployeeCount: number
}

const byRecurringCountThenCode = (a: PagIbigMappingIssue, b: PagIbigMappingIssue): number => {
  if (a.recurringCount !== b.recurringCount) {
    return b.recurringCount - a.recurringCount
  }

  return a.deductionTypeCode.localeCompare(b.deductionTypeCode)
}

export const isPagIbigLikeDeductionType = (deductionTypeCode: string, deductionTypeName: string): boolean => {
  return PAG_IBIG_PATTERN.test(deductionTypeCode) || PAG_IBIG_PATTERN.test(deductionTypeName)
}

export const buildPagIbigMappingIssues = (
  candidates: PagIbigMappingCandidate[]
): PagIbigMappingIssue[] => {
  const issueByDeductionTypeId = new Map<
    string,
    {
      issue: PagIbigMappingIssue
      employeeIds: Set<string>
    }
  >()

  for (const candidate of candidates) {
    if (!isPagIbigLikeDeductionType(candidate.deductionTypeCode, candidate.deductionTypeName)) {
      continue
    }

    if (candidate.reportingContributionType === "PAGIBIG") {
      continue
    }

    const existing = issueByDeductionTypeId.get(candidate.deductionTypeId)
    if (!existing) {
      issueByDeductionTypeId.set(candidate.deductionTypeId, {
        issue: {
          deductionTypeId: candidate.deductionTypeId,
          deductionTypeCode: candidate.deductionTypeCode,
          deductionTypeName: candidate.deductionTypeName,
          reportingContributionType: candidate.reportingContributionType,
          recurringCount: 1,
          affectedEmployeeCount: 1,
        },
        employeeIds: new Set([candidate.employeeId]),
      })
      continue
    }

    existing.issue.recurringCount += 1
    existing.employeeIds.add(candidate.employeeId)
    existing.issue.affectedEmployeeCount = existing.employeeIds.size
  }

  return Array.from(issueByDeductionTypeId.values())
    .map((entry) => entry.issue)
    .sort(byRecurringCountThenCode)
}

export const formatPagIbigMappingIssue = (issue: PagIbigMappingIssue): string => {
  const mappedType = issue.reportingContributionType ?? "NONE"
  return `[${issue.deductionTypeCode}] ${issue.deductionTypeName}: mapped to ${mappedType}; expected PAGIBIG (${issue.recurringCount} recurring record(s), ${issue.affectedEmployeeCount} employee(s)).`
}

export const formatPagIbigMappingIssues = (
  issues: PagIbigMappingIssue[],
  options?: { maxItems?: number }
): string[] => {
  const maxItems = Math.max(1, options?.maxItems ?? 5)
  if (issues.length <= maxItems) {
    return issues.map(formatPagIbigMappingIssue)
  }

  const visible = issues.slice(0, maxItems).map(formatPagIbigMappingIssue)
  visible.push(`...and ${issues.length - maxItems} more Pag-IBIG mapping issue(s).`)
  return visible
}
