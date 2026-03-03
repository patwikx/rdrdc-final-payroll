import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPagIbigMappingIssues,
  formatPagIbigMappingIssues,
  isPagIbigLikeDeductionType,
} from "../../modules/payroll/utils/pagibig-mapping-validator.ts"

test("buildPagIbigMappingIssues returns unmapped PAG-IBIG-like deduction types only", () => {
  const issues = buildPagIbigMappingIssues([
    {
      deductionTypeId: "ded-1",
      employeeId: "emp-1",
      deductionTypeCode: "PAGIBIG_PLUS",
      deductionTypeName: "Pag-IBIG Plus",
      reportingContributionType: null,
    },
    {
      deductionTypeId: "ded-1",
      employeeId: "emp-2",
      deductionTypeCode: "PAGIBIG_PLUS",
      deductionTypeName: "Pag-IBIG Plus",
      reportingContributionType: null,
    },
    {
      deductionTypeId: "ded-2",
      employeeId: "emp-1",
      deductionTypeCode: "PAGIBIG_TOPUP",
      deductionTypeName: "Pag-Ibig Topup",
      reportingContributionType: "PAGIBIG",
    },
    {
      deductionTypeId: "ded-3",
      employeeId: "emp-3",
      deductionTypeCode: "HMO",
      deductionTypeName: "HMO Contribution",
      reportingContributionType: null,
    },
  ])

  assert.equal(issues.length, 1)
  assert.equal(issues[0]?.deductionTypeId, "ded-1")
  assert.equal(issues[0]?.recurringCount, 2)
  assert.equal(issues[0]?.affectedEmployeeCount, 2)
})

test("formatPagIbigMappingIssues truncates with a summary line", () => {
  const formatted = formatPagIbigMappingIssues(
    [
      {
        deductionTypeId: "ded-1",
        deductionTypeCode: "PAGIBIG_A",
        deductionTypeName: "Pag-Ibig A",
        reportingContributionType: null,
        recurringCount: 2,
        affectedEmployeeCount: 2,
      },
      {
        deductionTypeId: "ded-2",
        deductionTypeCode: "PAGIBIG_B",
        deductionTypeName: "Pag-Ibig B",
        reportingContributionType: "TAX",
        recurringCount: 1,
        affectedEmployeeCount: 1,
      },
      {
        deductionTypeId: "ded-3",
        deductionTypeCode: "PAGIBIG_C",
        deductionTypeName: "Pag-Ibig C",
        reportingContributionType: "PHILHEALTH",
        recurringCount: 1,
        affectedEmployeeCount: 1,
      },
    ],
    { maxItems: 2 }
  )

  assert.equal(formatted.length, 3)
  assert.match(formatted[0] ?? "", /\[PAGIBIG_A\]/)
  assert.match(formatted[2] ?? "", /\.\.\.and 1 more/)
})

test("isPagIbigLikeDeductionType detects PAG-IBIG by code or name", () => {
  assert.equal(isPagIbigLikeDeductionType("PAGIBIG_VOLUNTARY", "Voluntary"), true)
  assert.equal(isPagIbigLikeDeductionType("VOL_TOPUP", "Pag-Ibig Additional"), true)
  assert.equal(isPagIbigLikeDeductionType("HMO", "HMO Contribution"), false)
})
