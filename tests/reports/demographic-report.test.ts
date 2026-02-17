import assert from "node:assert/strict"
import test from "node:test"

import {
  aggregateDemographicBreakdown,
  computeAgeInYears,
  humanizeCodeLabel,
  resolveAgeBracketLabel,
} from "../../modules/reports/payroll/utils/demographic-report-helpers.ts"

test("computeAgeInYears respects birthday boundaries in PH date semantics", () => {
  const birthDate = new Date("2000-02-20T00:00:00.000Z")

  const beforeBirthday = computeAgeInYears(birthDate, new Date("2026-02-16T00:00:00.000Z"))
  const afterBirthday = computeAgeInYears(birthDate, new Date("2026-02-21T00:00:00.000Z"))

  assert.equal(beforeBirthday, 25)
  assert.equal(afterBirthday, 26)
})

test("resolveAgeBracketLabel returns expected bracket labels", () => {
  assert.equal(resolveAgeBracketLabel(null), "Unspecified")
  assert.equal(resolveAgeBracketLabel(20), "20 and below")
  assert.equal(resolveAgeBracketLabel(30), "21-30")
  assert.equal(resolveAgeBracketLabel(40), "31-40")
  assert.equal(resolveAgeBracketLabel(50), "41-50")
  assert.equal(resolveAgeBracketLabel(60), "51-60")
  assert.equal(resolveAgeBracketLabel(61), "61 and above")
})

test("aggregateDemographicBreakdown groups values and sorts by count then label", () => {
  const rows = [
    { label: "Finance" },
    { label: "HR" },
    { label: "Finance" },
    { label: "IT" },
    { label: "HR" },
  ]

  const result = aggregateDemographicBreakdown(
    rows,
    (row) => ({
      key: row.label,
      label: row.label,
    }),
    "Unspecified"
  )

  assert.equal(result.length, 3)
  assert.equal(result[0]?.label, "Finance")
  assert.equal(result[0]?.count, 2)
  assert.equal(result[1]?.label, "HR")
  assert.equal(result[1]?.count, 2)
  assert.equal(result[2]?.label, "IT")
  assert.equal(result[2]?.count, 1)
  assert.equal(result[0]?.percentage, 40)
  assert.equal(result[2]?.percentage, 20)
})

test("humanizeCodeLabel formats enum-like codes", () => {
  assert.equal(humanizeCodeLabel("FULL_TIME", "Unspecified"), "Full Time")
  assert.equal(humanizeCodeLabel(null, "Unspecified"), "Unspecified")
  assert.equal(humanizeCodeLabel(" ", "Unspecified"), "Unspecified")
})

