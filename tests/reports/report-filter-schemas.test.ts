import assert from "node:assert/strict"
import test from "node:test"

import {
  reportDateRangeFilterSchema,
  reportMonthFilterSchema,
  reportPayPeriodFilterSchema,
  reportQueryFilterSchema,
} from "../../modules/reports/payroll/schemas/report-filter-schemas.ts"

const companyId = "550e8400-e29b-41d4-a716-446655440000"
const payPeriodId = "660e8400-e29b-41d4-a716-556655440000"

test("reportQueryFilterSchema applies defaults and accepts optional fields", () => {
  const parsed = reportQueryFilterSchema.safeParse({ companyId })
  assert.equal(parsed.success, true)
  if (!parsed.success) return

  assert.equal(parsed.data.includeTrialRuns, false)
  assert.equal(parsed.data.topN, 10)
  assert.equal(parsed.data.year, undefined)
  assert.equal(parsed.data.month, undefined)
  assert.equal(parsed.data.startDate, undefined)
  assert.equal(parsed.data.endDate, undefined)
  assert.equal(parsed.data.payPeriodId, undefined)
})

test("reportQueryFilterSchema rejects month without year", () => {
  const parsed = reportQueryFilterSchema.safeParse({
    companyId,
    month: 2,
  })

  assert.equal(parsed.success, false)
})

test("reportDateRangeFilterSchema rejects end date earlier than start date", () => {
  const parsed = reportDateRangeFilterSchema.safeParse({
    companyId,
    startDate: "2026-02-16",
    endDate: "2026-02-15",
  })

  assert.equal(parsed.success, false)
})

test("reportMonthFilterSchema validates year and month bounds", () => {
  const valid = reportMonthFilterSchema.safeParse({
    companyId,
    year: 2026,
    month: 2,
  })
  assert.equal(valid.success, true)

  const invalid = reportMonthFilterSchema.safeParse({
    companyId,
    year: 2026,
    month: 13,
  })
  assert.equal(invalid.success, false)
})

test("reportPayPeriodFilterSchema requires UUID payPeriodId", () => {
  const valid = reportPayPeriodFilterSchema.safeParse({
    companyId,
    payPeriodId,
  })
  assert.equal(valid.success, true)

  const invalid = reportPayPeriodFilterSchema.safeParse({
    companyId,
    payPeriodId: "not-a-uuid",
  })
  assert.equal(invalid.success, false)
})
