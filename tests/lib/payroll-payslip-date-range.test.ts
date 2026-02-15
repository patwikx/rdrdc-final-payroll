import assert from "node:assert/strict"
import test from "node:test"

import { resolvePayslipGeneratedAtRange } from "../../lib/payroll-payslip-date-range.ts"

test("resolvePayslipGeneratedAtRange maps PH date inputs to inclusive UTC generatedAt bounds", () => {
  const result = resolvePayslipGeneratedAtRange("2026-02-14", "2026-02-14")

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.startDate.toISOString(), "2026-02-13T16:00:00.000Z")
  assert.equal(result.endDate.toISOString(), "2026-02-14T15:59:59.999Z")
})

test("resolvePayslipGeneratedAtRange rejects invalid date format", () => {
  const result = resolvePayslipGeneratedAtRange("2026/02/14", "2026-02-14")

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.error, "Invalid startDate or endDate.")
})

test("resolvePayslipGeneratedAtRange rejects reversed range", () => {
  const result = resolvePayslipGeneratedAtRange("2026-02-15", "2026-02-14")

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.error, "Invalid startDate or endDate.")
})
