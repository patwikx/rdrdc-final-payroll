import type { ContributionType } from "@prisma/client"

const PAG_IBIG_PATTERN = /PAG[\s_-]*IBIG/i
const PHIL_HEALTH_PATTERN = /PHIL[\s_-]*HEALTH/i
const WITHHOLDING_TAX_PATTERN = /(WHTAX|WTAX|WITHHOLDING[\s_-]*TAX)/i

export const inferReportingContributionType = (
  deductionTypeCode: string,
  deductionTypeName: string
): ContributionType | null => {
  const code = deductionTypeCode.trim().toUpperCase()
  const name = deductionTypeName.trim()

  if (code === "SSS") {
    return "SSS"
  }

  if (code === "PHILHEALTH") {
    return "PHILHEALTH"
  }

  if (code === "PAGIBIG") {
    return "PAGIBIG"
  }

  if (code === "WTAX" || code === "WHTAX") {
    return "TAX"
  }

  if (PAG_IBIG_PATTERN.test(code) || PAG_IBIG_PATTERN.test(name)) {
    return "PAGIBIG"
  }

  if (PHIL_HEALTH_PATTERN.test(code) || PHIL_HEALTH_PATTERN.test(name)) {
    return "PHILHEALTH"
  }

  if (WITHHOLDING_TAX_PATTERN.test(code) || WITHHOLDING_TAX_PATTERN.test(name)) {
    return "TAX"
  }

  return null
}
