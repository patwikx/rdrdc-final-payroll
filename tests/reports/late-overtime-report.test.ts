import assert from "node:assert/strict"
import test from "node:test"

import { PayrollRunType } from "@prisma/client"

import {
  aggregateLateOvertimeDepartmentRows,
  aggregateLateOvertimeEmployeeRows,
  rankTopDepartmentsByLate,
  rankTopEmployeesByLate,
  rankTopEmployeesByOvertime,
  selectLateOvertimeRows,
  summarizeLateOvertimeRows,
} from "../../modules/reports/payroll/utils/late-overtime-report-helpers.ts"

type SourceRow = Parameters<typeof selectLateOvertimeRows>[0][number]

const row = (overrides: Partial<SourceRow>): SourceRow => ({
  employeeId: "emp-1",
  employeeNumber: "E-001",
  employeeName: "Doe, Jane",
  departmentId: "dept-1",
  departmentName: "Finance",
  payPeriodId: "period-1",
  runNumber: "RUN-001",
  runCreatedAt: new Date("2026-02-15T01:00:00.000Z"),
  runTypeCode: PayrollRunType.REGULAR,
  isTrialRun: false,
  lateMins: 0,
  overtimeHours: 0,
  overtimePayAmount: 0,
  tardinessDeductionAmount: 0,
  ...overrides,
})

test("selectLateOvertimeRows returns regular rows only when includeTrialRuns is false", () => {
  const selected = selectLateOvertimeRows(
    [
      row({ runNumber: "RUN-REG" }),
      row({
        runNumber: "RUN-TRIAL",
        isTrialRun: true,
        runTypeCode: PayrollRunType.TRIAL_RUN,
      }),
    ],
    false
  )

  assert.equal(selected.length, 1)
  assert.equal(selected[0]?.runNumber, "RUN-REG")
})

test("selectLateOvertimeRows includes only latest trial run per pay period when includeTrialRuns is true", () => {
  const selected = selectLateOvertimeRows(
    [
      row({ runNumber: "RUN-REG-P1", payPeriodId: "period-1" }),
      row({
        runNumber: "RUN-TRIAL-P1-OLD",
        payPeriodId: "period-1",
        isTrialRun: true,
        runTypeCode: PayrollRunType.TRIAL_RUN,
        runCreatedAt: new Date("2026-02-14T01:00:00.000Z"),
      }),
      row({
        runNumber: "RUN-TRIAL-P1-LATEST",
        payPeriodId: "period-1",
        isTrialRun: true,
        runTypeCode: PayrollRunType.TRIAL_RUN,
        runCreatedAt: new Date("2026-02-15T01:00:00.000Z"),
      }),
      row({ runNumber: "RUN-REG-P2", payPeriodId: "period-2" }),
      row({
        runNumber: "RUN-TRIAL-P2-LATEST",
        payPeriodId: "period-2",
        isTrialRun: true,
        runTypeCode: PayrollRunType.TRIAL_RUN,
        runCreatedAt: new Date("2026-02-16T01:00:00.000Z"),
      }),
    ],
    true
  )

  assert.deepEqual(
    selected.map((item) => item.runNumber).sort((a, b) => a.localeCompare(b)),
    ["RUN-REG-P1", "RUN-REG-P2", "RUN-TRIAL-P1-LATEST", "RUN-TRIAL-P2-LATEST"]
  )
})

test("rankTopEmployeesByLate uses deterministic tie-breakers", () => {
  const aggregated = aggregateLateOvertimeEmployeeRows([
    row({ employeeId: "emp-1", employeeNumber: "E-001", employeeName: "Zulu, Jane", lateMins: 30 }),
    row({ employeeId: "emp-2", employeeNumber: "E-002", employeeName: "Alpha, John", lateMins: 30 }),
    row({ employeeId: "emp-3", employeeNumber: "E-003", employeeName: "Bravo, Mike", lateMins: 15 }),
  ])

  const top = rankTopEmployeesByLate(aggregated, 2)
  assert.deepEqual(top.map((item) => item.employeeNumber), ["E-002", "E-001"])
})

test("report summary keeps overtime/late totals even when pay and deduction are zero", () => {
  const selectedRows = [
    row({
      employeeId: "emp-1",
      overtimeHours: 2.5,
      overtimePayAmount: 0,
      lateMins: 10,
      tardinessDeductionAmount: 0,
    }),
    row({
      employeeId: "emp-2",
      overtimeHours: 0,
      overtimePayAmount: 0,
      lateMins: 5,
      tardinessDeductionAmount: 0,
    }),
  ]

  const summary = summarizeLateOvertimeRows(selectedRows)
  const employeeRows = aggregateLateOvertimeEmployeeRows(selectedRows)
  const topOvertime = rankTopEmployeesByOvertime(employeeRows, 1)

  assert.equal(summary.totalLateMins, 15)
  assert.equal(summary.totalOvertimeHours, 2.5)
  assert.equal(summary.totalOvertimePayAmount, 0)
  assert.equal(summary.totalTardinessDeductionAmount, 0)
  assert.equal(topOvertime[0]?.employeeId, "emp-1")
})

test("aggregateLateOvertimeDepartmentRows computes unique headcount and department ranking", () => {
  const departmentRows = aggregateLateOvertimeDepartmentRows([
    row({ employeeId: "emp-1", departmentId: "dept-1", departmentName: "Finance", lateMins: 10 }),
    row({ employeeId: "emp-2", departmentId: "dept-1", departmentName: "Finance", lateMins: 15 }),
    row({ employeeId: "emp-2", departmentId: "dept-1", departmentName: "Finance", lateMins: 5 }),
    row({ employeeId: "emp-3", departmentId: "dept-2", departmentName: "HR", lateMins: 20 }),
  ])

  const topLateDept = rankTopDepartmentsByLate(departmentRows, 1)

  assert.equal(departmentRows.find((item) => item.departmentName === "Finance")?.employeeCount, 2)
  assert.equal(topLateDept[0]?.departmentName, "Finance")
  assert.equal(topLateDept[0]?.lateMins, 30)
})
