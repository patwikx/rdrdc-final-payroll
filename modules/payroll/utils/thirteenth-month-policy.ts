export const THIRTEENTH_MONTH_FORMULA_OPTIONS = [
  "BASIC_YTD_OR_PRORATED",
  "GROSS_EARNED_TO_DATE",
] as const

export type ThirteenthMonthFormula = (typeof THIRTEENTH_MONTH_FORMULA_OPTIONS)[number]

export const DEFAULT_THIRTEENTH_MONTH_FORMULA: ThirteenthMonthFormula = "BASIC_YTD_OR_PRORATED"

const isThirteenthMonthFormula = (value: unknown): value is ThirteenthMonthFormula => {
  return typeof value === "string" && THIRTEENTH_MONTH_FORMULA_OPTIONS.includes(value as ThirteenthMonthFormula)
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100

export const parseThirteenthMonthFormula = (value: unknown): ThirteenthMonthFormula => {
  if (isThirteenthMonthFormula(value)) {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase()
    if (isThirteenthMonthFormula(normalized)) {
      return normalized
    }

    if (normalized === "GROSS_PAYSLIP_EARNINGS" || normalized === "GROSS_PAYSLIP_EARNED_TO_DATE") {
      return "GROSS_EARNED_TO_DATE"
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return parseThirteenthMonthFormula(record.thirteenthMonthFormula)
  }

  return DEFAULT_THIRTEENTH_MONTH_FORMULA
}

type ComputeThirteenthMonthInput = {
  formula: ThirteenthMonthFormula
  ytdRegularBasic: number
  ytdGrossEarnings: number
}

type ComputeThirteenthMonthResult = {
  amount: number
  appliedFormula: string
  policy: ThirteenthMonthFormula
  basisAmount: number
}

export const computeThirteenthMonthPay = (
  input: ComputeThirteenthMonthInput
): ComputeThirteenthMonthResult => {
  if (input.formula === "GROSS_EARNED_TO_DATE") {
    const basisAmount = Math.max(input.ytdGrossEarnings, 0)
    return {
      amount: roundCurrency(basisAmount / 12),
      appliedFormula: "(ytdGrossPayslipEarningsEarnedToDate) / 12",
      policy: input.formula,
      basisAmount: roundCurrency(basisAmount),
    }
  }

  const basisAmount = Math.max(input.ytdRegularBasic, 0)
  return {
    amount: roundCurrency(basisAmount / 12),
    appliedFormula: "(ytdRegularBasic) / 12",
    policy: input.formula,
    basisAmount: roundCurrency(basisAmount),
  }
}
