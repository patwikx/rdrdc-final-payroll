import assert from "node:assert/strict"
import test from "node:test"

import {
  dtrCompanyInputSchema,
  dtrDateRangeInputSchema,
  dtrEmployeeDateRangeInputSchema,
  dtrEmployeeScheduleInputSchema,
} from "../modules/attendance/dtr/schemas/dtr-actions-schema.ts"

const COMPANY_ID = "9b1deb4d-bcf9-4f57-9d80-b6fb3be12f3f"
const EMPLOYEE_ID = "2f3e4e58-7f58-4a6c-a1a9-2dd9e7ec6a4f"

test("dtrCompanyInputSchema accepts valid UUID and rejects invalid value", () => {
  assert.equal(dtrCompanyInputSchema.safeParse({ companyId: COMPANY_ID }).success, true)
  assert.equal(dtrCompanyInputSchema.safeParse({ companyId: "not-a-uuid" }).success, false)
})

test("dtrDateRangeInputSchema rejects when startDate is after endDate", () => {
  const result = dtrDateRangeInputSchema.safeParse({
    companyId: COMPANY_ID,
    startDate: "2026-02-20",
    endDate: "2026-02-01",
  })

  assert.equal(result.success, false)
})

test("dtrEmployeeDateRangeInputSchema validates employee-scoped date ranges", () => {
  const result = dtrEmployeeDateRangeInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    startDate: "2026-02-01",
    endDate: "2026-02-20",
  })

  assert.equal(result.success, true)
})

test("dtrEmployeeScheduleInputSchema validates schedule lookup payload", () => {
  const valid = dtrEmployeeScheduleInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    attendanceDate: "2026-02-15",
  })
  assert.equal(valid.success, true)

  const invalid = dtrEmployeeScheduleInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    attendanceDate: "2026/02/15",
  })
  assert.equal(invalid.success, false)
})
