import assert from "node:assert/strict"
import test from "node:test"

import { parsePhDateInputToUtcDateOnly } from "../../lib/ph-time.ts"
import { holidaySettingsInputSchema } from "../../modules/settings/holidays/schemas/holiday-settings-schema.ts"

const validBasePayload = {
  companyId: "11111111-1111-4111-8111-111111111111",
  holidayDate: "2026-06-12",
  name: "Independence Day",
  description: "National holiday",
  holidayTypeCode: "REGULAR" as const,
  payMultiplier: 2,
  applicability: "NATIONWIDE" as const,
  region: undefined,
  isActive: true,
}

test("holidaySettingsInputSchema accepts a valid payload", () => {
  const result = holidaySettingsInputSchema.safeParse(validBasePayload)

  assert.equal(result.success, true)
  if (!result.success) return

  assert.equal(result.data.holidayTypeCode, "REGULAR")
  assert.equal(result.data.payMultiplier, 2)
})

test("holidaySettingsInputSchema requires region for regional holidays", () => {
  const result = holidaySettingsInputSchema.safeParse({
    ...validBasePayload,
    applicability: "REGIONAL",
    region: "   ",
  })

  assert.equal(result.success, false)
  if (result.success) return

  assert.equal(result.error.issues[0]?.path.join("."), "region")
})

test("holidaySettingsInputSchema trims optional fields to undefined", () => {
  const result = holidaySettingsInputSchema.safeParse({
    ...validBasePayload,
    description: "   ",
    region: "   ",
  })

  assert.equal(result.success, true)
  if (!result.success) return

  assert.equal(result.data.description, undefined)
  assert.equal(result.data.region, undefined)
})

test("parsePhDateInputToUtcDateOnly preserves PH date-only semantics", () => {
  const converted = parsePhDateInputToUtcDateOnly("2026-01-01")

  assert.notEqual(converted, null)
  assert.equal(converted?.toISOString(), "2026-01-01T00:00:00.000Z")
})
