import assert from "node:assert/strict"
import test from "node:test"

import {
  computeThirteenthMonthPay,
  parseThirteenthMonthFormula,
} from "../../modules/payroll/utils/thirteenth-month-policy.ts"

test("parseThirteenthMonthFormula resolves defaults and legacy aliases", () => {
  assert.equal(parseThirteenthMonthFormula(undefined), "BASIC_YTD_OR_PRORATED")
  assert.equal(parseThirteenthMonthFormula("gross_earned_to_date"), "GROSS_EARNED_TO_DATE")
  assert.equal(parseThirteenthMonthFormula("GROSS_PAYSLIP_EARNINGS"), "GROSS_EARNED_TO_DATE")
  assert.equal(
    parseThirteenthMonthFormula({ thirteenthMonthFormula: "GROSS_EARNED_TO_DATE" }),
    "GROSS_EARNED_TO_DATE"
  )
})

test("default formula uses YTD regular basic when available", () => {
  const result = computeThirteenthMonthPay({
    formula: "BASIC_YTD_OR_PRORATED",
    ytdRegularBasic: 240000,
    ytdGrossEarnings: 300000,
  })

  assert.equal(result.amount, 20000)
  assert.equal(result.appliedFormula, "(ytdRegularBasic) / 12")
})

test("default formula returns zero when YTD regular basic is zero", () => {
  const result = computeThirteenthMonthPay({
    formula: "BASIC_YTD_OR_PRORATED",
    ytdRegularBasic: 0,
    ytdGrossEarnings: 0,
  })

  assert.equal(result.amount, 0)
  assert.equal(result.appliedFormula, "(ytdRegularBasic) / 12")
})

test("twc formula uses earned-to-date gross payslip earnings / 12", () => {
  const result = computeThirteenthMonthPay({
    formula: "GROSS_EARNED_TO_DATE",
    ytdRegularBasic: 240000,
    ytdGrossEarnings: 264000,
  })

  assert.equal(result.amount, 22000)
  assert.equal(result.appliedFormula, "(ytdGrossPayslipEarningsEarnedToDate) / 12")
})
