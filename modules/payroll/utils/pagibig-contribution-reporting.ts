import type { ContributionType } from "@prisma/client"

type DecimalLike = { toString(): string } | number | null | undefined

export type PagIbigContributionDeductionLine = {
  amount: DecimalLike
  referenceType: string | null
  deductionType: {
    code?: string | null
    reportingContributionType?: ContributionType | null
  } | null
}

const PAG_IBIG_CODE_PATTERN = /PAG[\s_-]*IBIG/i

const toNumber = (value: DecimalLike): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  return Number(value.toString())
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100

const normalizeCode = (value: string | null | undefined): string => value?.trim().toUpperCase() ?? ""

export const isPagIbigContributionDeductionLine = (
  line: PagIbigContributionDeductionLine
): boolean => {
  const contributionType = line.deductionType?.reportingContributionType
  if (contributionType === "PAGIBIG") {
    return true
  }

  return PAG_IBIG_CODE_PATTERN.test(normalizeCode(line.deductionType?.code))
}

export const isMandatoryPagIbigGovernmentDeductionLine = (
  line: PagIbigContributionDeductionLine
): boolean => {
  return line.referenceType === "GOVERNMENT" && normalizeCode(line.deductionType?.code) === "PAGIBIG"
}

export const isAdditionalPagIbigContributionDeductionLine = (
  line: PagIbigContributionDeductionLine
): boolean => {
  if (!isPagIbigContributionDeductionLine(line)) {
    return false
  }

  if (isMandatoryPagIbigGovernmentDeductionLine(line)) {
    return false
  }

  return toNumber(line.amount) > 0
}

export const getAdditionalPagIbigEmployeeShareFromDeductions = (
  deductions: PagIbigContributionDeductionLine[]
): number => {
  let total = 0
  for (const deduction of deductions) {
    if (!isAdditionalPagIbigContributionDeductionLine(deduction)) {
      continue
    }

    total += toNumber(deduction.amount)
  }

  return roundCurrency(total)
}

export const getTotalPagIbigEmployeeShare = (
  mandatoryEmployeeShare: DecimalLike,
  deductions: PagIbigContributionDeductionLine[]
): number => {
  return roundCurrency(toNumber(mandatoryEmployeeShare) + getAdditionalPagIbigEmployeeShareFromDeductions(deductions))
}
