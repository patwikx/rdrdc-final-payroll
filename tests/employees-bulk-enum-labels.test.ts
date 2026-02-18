import assert from "node:assert/strict"
import test from "node:test"
import { BloodType, CivilStatus, Gender, Religion, TaxStatus } from "@prisma/client"

import {
  EMPLOYEE_BULK_BLOOD_TYPE_LABELS,
  EMPLOYEE_BULK_CIVIL_STATUS_LABELS,
  EMPLOYEE_BULK_GENDER_LABELS,
  EMPLOYEE_BULK_RELIGION_LABELS,
  EMPLOYEE_BULK_TAX_STATUS_LABELS,
} from "../modules/employees/masterlist/utils/employee-bulk-enum-labels.ts"

test("employee bulk enum label maps cover all enum values", () => {
  for (const value of Object.values(Gender)) {
    assert.equal(typeof EMPLOYEE_BULK_GENDER_LABELS[value], "string")
    assert.equal(EMPLOYEE_BULK_GENDER_LABELS[value].length > 0, true)
  }

  for (const value of Object.values(CivilStatus)) {
    assert.equal(typeof EMPLOYEE_BULK_CIVIL_STATUS_LABELS[value], "string")
    assert.equal(EMPLOYEE_BULK_CIVIL_STATUS_LABELS[value].length > 0, true)
  }

  for (const value of Object.values(Religion)) {
    assert.equal(typeof EMPLOYEE_BULK_RELIGION_LABELS[value], "string")
    assert.equal(EMPLOYEE_BULK_RELIGION_LABELS[value].length > 0, true)
  }

  for (const value of Object.values(BloodType)) {
    assert.equal(typeof EMPLOYEE_BULK_BLOOD_TYPE_LABELS[value], "string")
    assert.equal(EMPLOYEE_BULK_BLOOD_TYPE_LABELS[value].length > 0, true)
  }

  for (const value of Object.values(TaxStatus)) {
    assert.equal(typeof EMPLOYEE_BULK_TAX_STATUS_LABELS[value], "string")
    assert.equal(EMPLOYEE_BULK_TAX_STATUS_LABELS[value].length > 0, true)
  }
})

test("employee bulk blood type labels use expected clinical notation", () => {
  assert.equal(EMPLOYEE_BULK_BLOOD_TYPE_LABELS[BloodType.A_POS], "A+")
  assert.equal(EMPLOYEE_BULK_BLOOD_TYPE_LABELS[BloodType.AB_NEG], "AB-")
})
