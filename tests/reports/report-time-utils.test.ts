import assert from "node:assert/strict"
import test from "node:test"

import {
  getPhMonthDateBoundsUtc,
  normalizeReportDateRange,
  parseReportYearMonthKey,
  resolveReportYearMonth,
  toReportDateRangeLabel,
  toReportYearMonthKey,
} from "../../modules/reports/payroll/utils/report-time-utils.ts"

test("resolveReportYearMonth falls back to PH current year-month when input is invalid", () => {
  const now = new Date("2026-02-16T01:00:00.000Z")
  const resolved = resolveReportYearMonth({ year: 1999, month: 13 }, now)
  assert.deepEqual(resolved, { year: 2026, month: 2 })
})

test("toReportYearMonthKey and parseReportYearMonthKey round-trip valid values", () => {
  const key = toReportYearMonthKey({ year: 2026, month: 2 })
  assert.equal(key, "2026-02")
  assert.deepEqual(parseReportYearMonthKey(key), { year: 2026, month: 2 })
})

test("parseReportYearMonthKey rejects invalid values", () => {
  assert.equal(parseReportYearMonthKey("2026/02"), null)
  assert.equal(parseReportYearMonthKey("2026-13"), null)
})

test("getPhMonthDateBoundsUtc returns UTC date-only month bounds", () => {
  const bounds = getPhMonthDateBoundsUtc({ year: 2026, month: 2 })
  assert.equal(bounds.startUtcDateOnly.toISOString(), "2026-02-01T00:00:00.000Z")
  assert.equal(bounds.endUtcDateOnly.toISOString(), "2026-02-28T00:00:00.000Z")
})

test("normalizeReportDateRange validates date ordering and format", () => {
  const valid = normalizeReportDateRange({
    startDate: "2026-02-01",
    endDate: "2026-02-28",
  })
  assert.equal(valid.ok, true)
  if (valid.ok) {
    assert.equal(valid.startUtcDateOnly?.toISOString(), "2026-02-01T00:00:00.000Z")
    assert.equal(valid.endUtcDateOnly?.toISOString(), "2026-02-28T00:00:00.000Z")
  }

  const reversed = normalizeReportDateRange({
    startDate: "2026-02-10",
    endDate: "2026-02-09",
  })
  assert.equal(reversed.ok, false)

  const invalid = normalizeReportDateRange({
    startDate: "2026/02/10",
    endDate: "2026-02-11",
  })
  assert.equal(invalid.ok, false)
})

test("toReportDateRangeLabel uses PH date input formatting", () => {
  const label = toReportDateRangeLabel(
    new Date("2026-02-01T00:00:00.000Z"),
    new Date("2026-02-28T00:00:00.000Z")
  )
  assert.equal(label, "2026-02-01 to 2026-02-28")
})
