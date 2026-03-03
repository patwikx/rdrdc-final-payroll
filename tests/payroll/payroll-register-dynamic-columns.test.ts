import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPayrollRegisterCsv,
  buildPayrollRegisterReportData,
} from "../../modules/payroll/utils/build-payroll-register-csv.ts"

test("buildPayrollRegisterReportData creates dynamic earning/deduction columns and aggregates values", () => {
  const report = buildPayrollRegisterReportData({
    rows: [
      {
        employeeNumber: "E-001",
        employeeName: "Doe, Jane",
        departmentName: "Finance",
        periodStart: new Date("2026-02-01T00:00:00.000Z"),
        periodEnd: new Date("2026-02-15T00:00:00.000Z"),
        basicPay: 10000,
        grossPay: 11050,
        sss: 500,
        philHealth: 200,
        pagIbig: 100,
        tax: 400,
        netPay: 9500,
        earnings: [
          { code: "BASIC_PAY", name: "Basic Pay", description: "Basic Pay", amount: 10000 },
          { code: "ALLOWANCE", name: "Transportation Allowance", description: "Transportation Allowance", amount: 750 },
          { code: "OVERTIME", name: "Overtime Pay", description: "Overtime Pay", amount: 250 },
          { code: "ADJUSTMENT", name: "Manual Adjustment", description: "Manual Adjustment", amount: 50 },
        ],
        deductions: [
          { code: "TARDINESS", name: "Tardiness Deduction", description: "Tardiness Deduction", amount: 30 },
          { code: "UNDERTIME", name: "Undertime Deduction", description: "Undertime Deduction", amount: 20 },
          { code: "SSS_LOAN", name: "SSS Loan", description: "SSS Loan", amount: 100 },
          { code: "CASH_ADVANCE", name: "Cash Advance", description: "Cash Advance", amount: 80 },
          { code: "OTHER_MISC", name: "Other Misc", description: "Other Misc", amount: 40 },
        ],
      },
      {
        employeeNumber: "E-002",
        employeeName: "Ramos, John",
        departmentName: "Finance",
        periodStart: new Date("2026-02-01T00:00:00.000Z"),
        periodEnd: new Date("2026-02-15T00:00:00.000Z"),
        basicPay: 8000,
        grossPay: 8300,
        sss: 450,
        philHealth: 180,
        pagIbig: 100,
        tax: 350,
        netPay: 7600,
        earnings: [
          { code: "BASIC_PAY", name: "Basic Pay", description: "Basic Pay", amount: 8000 },
          { code: "ALLOWANCE", name: "Transportation Allowance", description: "Transportation Allowance", amount: 300 },
        ],
        deductions: [
          { code: "CASH_ADVANCE", name: "Cash Advance", description: "Cash Advance", amount: 20 },
        ],
      },
    ],
  })

  assert.equal(report.headcount, 2)
  assert.deepEqual(
    report.columns.map((column) => `${column.category}:${column.code}`),
    [
      "EARNING:ALLOWANCE",
      "EARNING:MANUAL_ADJUSTMENT",
      "EARNING:OVERTIME",
      "DEDUCTION:CASH_ADVANCE",
      "DEDUCTION:OTHER_MISC",
      "DEDUCTION:SSS_LOAN",
    ]
  )

  const finance = report.departments[0]
  assert.equal(finance?.name, "Finance")
  assert.equal(finance?.employees.length, 2)

  const jane = finance?.employees.find((row) => row.employeeNumber === "E-001")
  assert.equal(jane?.late, 30)
  assert.equal(jane?.undertime, 20)
  assert.equal(jane?.dynamicEarningsTotal, 1050)
  assert.equal(jane?.dynamicDeductionsTotal, 1470)
  assert.equal(jane?.dynamicAmountsByKey["EARNING:MANUAL_ADJUSTMENT"], 50)
  assert.equal(jane?.dynamicAmountsByKey["EARNING:ALLOWANCE"], 750)
  assert.equal(jane?.dynamicAmountsByKey["DEDUCTION:CASH_ADVANCE"], 80)
  assert.equal(jane?.dynamicAmountsByKey["DEDUCTION:OTHER_MISC"], 40)
  assert.equal(jane?.dynamicAmountsByKey["DEDUCTION:SSS_LOAN"], 100)

  assert.equal(report.grandTotal.dynamicEarningsTotal, 1350)
  assert.equal(report.grandTotal.dynamicDeductionsTotal, 2570)
  assert.equal(report.grandTotal.late, 30)
  assert.equal(report.grandTotal.undertime, 20)
  assert.equal(report.grandTotal.dynamicAmountsByKey["DEDUCTION:CASH_ADVANCE"], 100)
  assert.equal(report.grandTotal.dynamicAmountsByKey["DEDUCTION:OTHER_MISC"], 40)
  assert.equal(report.grandTotal.dynamicAmountsByKey["DEDUCTION:SSS_LOAN"], 100)
})

test("buildPayrollRegisterCsv exposes dynamic headers and removes OTH column", () => {
  const csv = buildPayrollRegisterCsv({
    rows: [
      {
        employeeNumber: "E-001",
        employeeName: "Doe, Jane",
        departmentName: "Finance",
        periodStart: new Date("2026-02-01T00:00:00.000Z"),
        periodEnd: new Date("2026-02-15T00:00:00.000Z"),
        basicPay: 10000,
        grossPay: 10620,
        sss: 500,
        philHealth: 200,
        pagIbig: 100,
        tax: 400,
        netPay: 9500,
        earnings: [
          { code: "BASIC_PAY", name: "Basic Pay", description: "Basic Pay", amount: 10000 },
          { code: "ALLOWANCE", name: "Allowance", description: "Allowance", amount: 500 },
          { code: "ADJUSTMENT", name: "Manual Adjustment", description: "Special Bonus", amount: 120 },
        ],
        deductions: [
          { code: "CASH_ADVANCE", name: "Cash Advance", description: "Cash Advance", amount: 100 },
          { code: "ADJUSTMENT", name: "Manual Adjustment", description: "Tax Correction", amount: 40 },
        ],
      },
    ],
  })

  const [header] = csv.split("\n")
  assert.ok(header.includes("+ ALLOWANCE"))
  assert.ok(header.includes("+ SPECIAL_BONUS"))
  assert.ok(header.includes("- CASH_ADVANCE"))
  assert.ok(header.includes("- TAX_CORRECTION"))
  assert.ok(!header.includes("+ ADJUSTMENT"))
  assert.ok(!header.includes("- ADJUSTMENT"))
  assert.ok(header.includes("+ EARN TOTAL"))
  assert.ok(header.includes("- DED TOTAL"))
  assert.ok(header.indexOf("+ EARN TOTAL") > header.indexOf("- CASH_ADVANCE"))
  assert.ok(header.indexOf("GROSS") > header.indexOf("+ EARN TOTAL"))
  assert.ok(header.indexOf("- DED TOTAL") > header.indexOf("GROSS"))
  assert.ok(!header.includes(",OTH,"))
})

test("buildPayrollRegisterReportData keeps HDMF separate from Pag-IBIG additional deductions", () => {
  const report = buildPayrollRegisterReportData({
    rows: [
      {
        employeeNumber: "E-100",
        employeeName: "Cruz, Ana",
        departmentName: "HR",
        periodStart: new Date("2026-02-01T00:00:00.000Z"),
        periodEnd: new Date("2026-02-15T00:00:00.000Z"),
        basicPay: 12000,
        grossPay: 12000,
        sss: 0,
        philHealth: 0,
        pagIbig: 200,
        tax: 0,
        netPay: 11800,
        earnings: [{ code: "BASIC_PAY", name: "Basic Pay", description: "Basic Pay", amount: 12000 }],
        deductions: [
          {
            code: "PAGIBIG_ADDITIONAL",
            name: "Pag-IBIG Additional Contribution",
            description: "Pag-IBIG Additional Contribution",
            amount: 50,
          },
        ],
      },
    ],
  })

  const row = report.departments[0]?.employees[0]
  assert.ok(report.columns.some((column) => column.key === "DEDUCTION:PAGIBIG_ADDITIONAL"))
  assert.equal(row?.pagIbig, 200)
  assert.equal(row?.dynamicAmountsByKey["DEDUCTION:PAGIBIG_ADDITIONAL"], 50)
  assert.equal(row?.dynamicDeductionsTotal, 250)
})

test("buildPayrollRegisterReportData creates separate adjustment columns from description code prefixes", () => {
  const report = buildPayrollRegisterReportData({
    rows: [
      {
        employeeNumber: "E-200",
        employeeName: "Lopez, Marco",
        departmentName: "Accounting",
        periodStart: new Date("2026-02-01T00:00:00.000Z"),
        periodEnd: new Date("2026-02-15T00:00:00.000Z"),
        basicPay: 15000,
        grossPay: 15200,
        sss: 500,
        philHealth: 200,
        pagIbig: 100,
        tax: 450,
        netPay: 14250,
        earnings: [
          { code: "BASIC_PAY", name: "Basic Pay", description: "Basic Pay", amount: 15000 },
          { code: "ADJUSTMENT", name: "Manual Adjustment", description: "CA - Rice", amount: 200 },
        ],
        deductions: [
          { code: "ADJUSTMENT", name: "Manual Adjustment", description: "CP - Car Plan", amount: 150 },
        ],
      },
    ],
  })

  assert.ok(report.columns.some((column) => column.key === "EARNING:CA"))
  assert.ok(report.columns.some((column) => column.key === "DEDUCTION:CP"))

  const row = report.departments[0]?.employees[0]
  assert.equal(row?.dynamicAmountsByKey["EARNING:CA"], 200)
  assert.equal(row?.dynamicAmountsByKey["DEDUCTION:CP"], 150)
})
