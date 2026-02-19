import assert from "node:assert/strict"
import test from "node:test"

import {
  dtrCompanyInputSchema,
  dtrDateRangeInputSchema,
  dtrEmployeeDateRangeInputSchema,
  dtrEmployeeLeaveContextInputSchema,
  dtrEmployeeScheduleInputSchema,
  updateDtrRecordInputSchema,
} from "../modules/attendance/dtr/schemas/dtr-actions-schema.ts"

const COMPANY_ID = "9b1deb4d-bcf9-4f57-9d80-b6fb3be12f3f"
const EMPLOYEE_ID = "2f3e4e58-7f58-4a6c-a1a9-2dd9e7ec6a4f"
const DTR_ID = "f7f8d5c3-8f9b-4baf-9490-5f538fca8f94"
const LEAVE_TYPE_ID = "0e3ce9cb-3f7b-49ab-baa6-e67e0f159ffa"

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

test("dtrEmployeeLeaveContextInputSchema validates leave balance context payload", () => {
  const valid = dtrEmployeeLeaveContextInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    attendanceDate: "2026-02-15",
    dtrId: DTR_ID,
  })
  assert.equal(valid.success, true)

  const invalid = dtrEmployeeLeaveContextInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    attendanceDate: "2026/02/15",
  })
  assert.equal(invalid.success, false)
})

test("updateDtrRecordInputSchema accepts optional leaveTypeId for ON_LEAVE updates", () => {
  const valid = updateDtrRecordInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    attendanceDate: "2026-02-15",
    attendanceStatus: "ON_LEAVE",
    leaveTypeId: LEAVE_TYPE_ID,
    dayFraction: "HALF",
    actualTimeIn: "",
    actualTimeOut: "",
    remarks: "Manual correction",
  })
  assert.equal(valid.success, true)

  const invalidLeaveType = updateDtrRecordInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    attendanceDate: "2026-02-15",
    attendanceStatus: "ON_LEAVE",
    leaveTypeId: "not-a-uuid",
  })
  assert.equal(invalidLeaveType.success, false)
})
