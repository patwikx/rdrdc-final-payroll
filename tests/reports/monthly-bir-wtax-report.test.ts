import assert from "node:assert/strict"
import test from "node:test"

import { PayrollRunType } from "@prisma/client"

import {
  aggregateMonthlyBirWTaxRows,
  getMonthlyBirWTaxCsvRows,
  selectMonthlyBirWTaxRows,
} from "../../modules/reports/payroll/utils/monthly-bir-wtax-report-helpers.ts"

type SourceRow = Parameters<typeof selectMonthlyBirWTaxRows>[0][number]

const row = (overrides: Partial<SourceRow>): SourceRow => ({
  employeeId: "emp-1",
  employeeNumber: "E-001",
  employeeName: "Doe, Jane",
  departmentName: "Finance",
  tinNumberMasked: "123-***-***",
  runNumber: "RUN-001",
  runCreatedAt: new Date("2026-02-10T01:00:00.000Z"),
  payPeriodId: "period-1",
  runTypeCode: PayrollRunType.REGULAR,
  isTrialRun: false,
  withholdingTaxAmount: 100,
  ...overrides,
})

test("selectMonthlyBirWTaxRows returns only regular rows when includeTrialRuns is false", () => {
  const rows: SourceRow[] = [
    row({ runNumber: "RUN-REG", runTypeCode: PayrollRunType.REGULAR, isTrialRun: false }),
    row({ runNumber: "RUN-TRIAL-1", runTypeCode: PayrollRunType.TRIAL_RUN, isTrialRun: true }),
  ]

  const selected = selectMonthlyBirWTaxRows(rows, false)
  assert.equal(selected.length, 1)
  assert.equal(selected[0]?.runNumber, "RUN-REG")
})

test("selectMonthlyBirWTaxRows includes only latest trial run per pay period when includeTrialRuns is true", () => {
  const rows: SourceRow[] = [
    row({ runNumber: "RUN-REG-P1", payPeriodId: "period-1", withholdingTaxAmount: 100 }),
    row({
      runNumber: "RUN-TRIAL-P1-OLD",
      payPeriodId: "period-1",
      runTypeCode: PayrollRunType.TRIAL_RUN,
      isTrialRun: true,
      runCreatedAt: new Date("2026-02-12T01:00:00.000Z"),
      withholdingTaxAmount: 90,
    }),
    row({
      runNumber: "RUN-TRIAL-P1-LATEST",
      payPeriodId: "period-1",
      runTypeCode: PayrollRunType.TRIAL_RUN,
      isTrialRun: true,
      runCreatedAt: new Date("2026-02-13T01:00:00.000Z"),
      withholdingTaxAmount: 95,
    }),
    row({ runNumber: "RUN-REG-P2", payPeriodId: "period-2", withholdingTaxAmount: 120 }),
    row({
      runNumber: "RUN-TRIAL-P2-LATEST",
      payPeriodId: "period-2",
      runTypeCode: PayrollRunType.TRIAL_RUN,
      isTrialRun: true,
      runCreatedAt: new Date("2026-02-14T01:00:00.000Z"),
      withholdingTaxAmount: 110,
    }),
  ]

  const selected = selectMonthlyBirWTaxRows(rows, true)
  assert.equal(selected.length, 4)
  assert.deepEqual(
    selected.map((item) => item.runNumber).sort((a, b) => a.localeCompare(b)),
    ["RUN-REG-P1", "RUN-REG-P2", "RUN-TRIAL-P1-LATEST", "RUN-TRIAL-P2-LATEST"]
  )
})

test("aggregateMonthlyBirWTaxRows groups by employee, sums amounts, and sorts by highest withholding tax", () => {
  const rows: SourceRow[] = [
    row({
      employeeId: "emp-1",
      employeeName: "Doe, Jane",
      employeeNumber: "E-001",
      runNumber: "RUN-001",
      withholdingTaxAmount: 101.255,
    }),
    row({
      employeeId: "emp-1",
      employeeName: "Doe, Jane",
      employeeNumber: "E-001",
      runNumber: "RUN-002",
      withholdingTaxAmount: 50.119,
    }),
    row({
      employeeId: "emp-2",
      employeeName: "Ramos, John",
      employeeNumber: "E-002",
      runNumber: "RUN-001",
      withholdingTaxAmount: 220,
    }),
  ]

  const aggregated = aggregateMonthlyBirWTaxRows(rows)

  assert.equal(aggregated.length, 2)
  assert.equal(aggregated[0]?.employeeId, "emp-2")
  assert.equal(aggregated[0]?.withholdingTaxAmount, 220)
  assert.equal(aggregated[1]?.employeeId, "emp-1")
  assert.equal(aggregated[1]?.withholdingTaxAmount, 151.37)
  assert.deepEqual(aggregated[1]?.runNumbers, ["RUN-001", "RUN-002"])
})

test("getMonthlyBirWTaxCsvRows formats rows with fixed decimal places", () => {
  const csvRows = getMonthlyBirWTaxCsvRows([
    {
      employeeId: "emp-1",
      employeeNumber: "E-001",
      employeeName: "Doe, Jane",
      departmentName: "Finance",
      tinNumberMasked: "123-***-***",
      runNumbers: ["RUN-001", "RUN-002"],
      withholdingTaxAmount: 1234.5,
    },
  ])

  assert.equal(csvRows.length, 1)
  assert.deepEqual(csvRows[0], ["E-001", "Doe, Jane", "Finance", "123-***-***", "RUN-001 | RUN-002", "1,234.50"])
})
