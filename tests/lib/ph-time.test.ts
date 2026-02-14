import assert from "node:assert/strict"
import test from "node:test"

import {
  toPhDateOnlyUtc,
  toPhDayEndUtcInstant,
  toPhDayStartUtcInstant,
} from "../../lib/ph-time.ts"

test("toPhDayStartUtcInstant converts PH date-only string to UTC instant at PH midnight", () => {
  const value = toPhDayStartUtcInstant("2026-02-14")
  assert.ok(value)
  assert.equal(value.toISOString(), "2026-02-13T16:00:00.000Z")
})

test("toPhDayEndUtcInstant converts PH date-only string to UTC instant at PH day end", () => {
  const value = toPhDayEndUtcInstant("2026-02-14")
  assert.ok(value)
  assert.equal(value.toISOString(), "2026-02-14T15:59:59.999Z")
})

test("toPhDayStartUtcInstant and toPhDayEndUtcInstant reject invalid date format", () => {
  assert.equal(toPhDayStartUtcInstant("2026/02/14"), null)
  assert.equal(toPhDayEndUtcInstant("2026/02/14"), null)
})

test("toPhDateOnlyUtc normalizes to PH local day in UTC date-only storage format", () => {
  const value = new Date("2026-02-13T18:00:00.000Z")
  const normalized = toPhDateOnlyUtc(value)
  assert.equal(normalized.toISOString(), "2026-02-14T00:00:00.000Z")
})
