import assert from "node:assert/strict"
import test from "node:test"

import { isDisallowedRecurringEarningType } from "../../modules/payroll/utils/recurring-earning-eligibility.ts"

test("isDisallowedRecurringEarningType returns true for variable payroll lines", () => {
  assert.equal(isDisallowedRecurringEarningType("OVERTIME", "Overtime Pay"), true)
  assert.equal(isDisallowedRecurringEarningType("NIGHT_DIFF", "Night Differential"), true)
  assert.equal(isDisallowedRecurringEarningType("HOLIDAY_PAY", "Holiday Premium"), true)
  assert.equal(isDisallowedRecurringEarningType("ADJUSTMENT", "Manual Adjustment"), true)
})

test("isDisallowedRecurringEarningType returns false for recurring allowances", () => {
  assert.equal(isDisallowedRecurringEarningType("MEAL_ALLOW", "Meal Allowance"), false)
  assert.equal(isDisallowedRecurringEarningType("TRANSPORT", "Transportation Allowance"), false)
})
