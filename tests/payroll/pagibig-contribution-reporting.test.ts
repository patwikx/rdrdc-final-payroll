import assert from "node:assert/strict"
import test from "node:test"

import {
  getAdditionalPagIbigEmployeeShareFromDeductions,
  getTotalPagIbigEmployeeShare,
  isAdditionalPagIbigContributionDeductionLine,
} from "../../modules/payroll/utils/pagibig-contribution-reporting.ts"

test("getAdditionalPagIbigEmployeeShareFromDeductions excludes mandatory government PAGIBIG line", () => {
  const deductions = [
    {
      amount: 200,
      referenceType: "GOVERNMENT",
      deductionType: {
        code: "PAGIBIG",
        reportingContributionType: "PAGIBIG" as const,
      },
    },
    {
      amount: 300,
      referenceType: "RECURRING",
      deductionType: {
        code: "PAGIBIG_VOLUNTARY",
        reportingContributionType: "PAGIBIG" as const,
      },
    },
  ]

  const additional = getAdditionalPagIbigEmployeeShareFromDeductions(deductions)
  assert.equal(additional, 300)
})

test("getAdditionalPagIbigEmployeeShareFromDeductions falls back to code pattern when contribution type is missing", () => {
  const deductions = [
    {
      amount: 150,
      referenceType: "RECURRING",
      deductionType: {
        code: "PAG_IBIG_TOPUP",
        reportingContributionType: null,
      },
    },
    {
      amount: 80,
      referenceType: "RECURRING",
      deductionType: {
        code: "CASH_ADVANCE",
        reportingContributionType: null,
      },
    },
  ]

  const additional = getAdditionalPagIbigEmployeeShareFromDeductions(deductions)
  assert.equal(additional, 150)
})

test("getTotalPagIbigEmployeeShare returns mandatory plus additional PAGIBIG", () => {
  const deductions = [
    {
      amount: 75.556,
      referenceType: "RECURRING",
      deductionType: {
        code: "PAGIBIG_PLUS",
        reportingContributionType: "PAGIBIG" as const,
      },
    },
  ]

  const total = getTotalPagIbigEmployeeShare(200, deductions)
  assert.equal(total, 275.56)
})

test("isAdditionalPagIbigContributionDeductionLine returns false for non-PAGIBIG lines", () => {
  const line = {
    amount: 400,
    referenceType: "RECURRING",
    deductionType: {
      code: "INSURANCE",
      reportingContributionType: null,
    },
  }

  assert.equal(isAdditionalPagIbigContributionDeductionLine(line), false)
})
