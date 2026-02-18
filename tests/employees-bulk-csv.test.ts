import assert from "node:assert/strict"
import test from "node:test"

import {
  buildEmployeeBulkTemplateCsv,
  EMPLOYEE_BULK_UPDATE_REQUIRED_HEADERS,
  EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS,
  isClearToken,
  normalizeBulkHeaderKey,
  parseCsvRows,
} from "../modules/employees/masterlist/utils/employee-bulk-csv.ts"

test("employee bulk CSV headers include employeeNumber and core identity fields", () => {
  assert.equal(EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS.includes("employeeNumber"), true)
  assert.equal(EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS.includes("firstName"), true)
  assert.equal(EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS.includes("lastName"), true)
  assert.equal((EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS as readonly string[]).includes("signatureUrl"), false)
  assert.deepEqual(EMPLOYEE_BULK_UPDATE_REQUIRED_HEADERS, ["employeeNumber"])
})

test("parseCsvRows parses quoted commas and escaped quotes", () => {
  const csv = 'employeeNumber,firstName,lastName\nE-001,"Jane, ""JJ""",Doe'
  const rows = parseCsvRows(csv)

  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    lineNumber: 1,
    cells: ["employeeNumber", "firstName", "lastName"],
  })
  assert.deepEqual(rows[1], {
    lineNumber: 2,
    cells: ["E-001", 'Jane, "JJ"', "Doe"],
  })
})

test("parseCsvRows tracks line numbers when quoted values contain new lines", () => {
  const csv = 'employeeNumber,nickname\nE-001,"Line 1\nLine 2"\nE-002,Alpha'
  const rows = parseCsvRows(csv)

  assert.equal(rows.length, 3)
  assert.equal(rows[1]?.lineNumber, 2)
  assert.equal(rows[2]?.lineNumber, 4)
  assert.equal(rows[1]?.cells[1], "Line 1\nLine 2")
})

test("parseCsvRows rejects unterminated quoted field", () => {
  assert.throws(() => parseCsvRows('employeeNumber,firstName\nE-001,"Jane'), /Unterminated quoted field/)
})

test("isClearToken is case-insensitive and space-tolerant", () => {
  assert.equal(isClearToken("__CLEAR__"), true)
  assert.equal(isClearToken("  __clear__  "), true)
  assert.equal(isClearToken("__clear"), false)
})

test("normalizeBulkHeaderKey strips required markers", () => {
  assert.equal(normalizeBulkHeaderKey("employeeNumber *"), "employeenumber")
  assert.equal(normalizeBulkHeaderKey("employeeNumber (required)"), "employeenumber")
  assert.equal(normalizeBulkHeaderKey("employeeNumber [required]"), "employeenumber")
})

test("buildEmployeeBulkTemplateCsv marks required headers with asterisk", () => {
  const csv = buildEmployeeBulkTemplateCsv([], {
    requiredHeaders: EMPLOYEE_BULK_UPDATE_REQUIRED_HEADERS,
  })
  const [headerRow] = csv.split("\n")

  assert.equal(headerRow?.includes("employeeNumber *"), true)
})
