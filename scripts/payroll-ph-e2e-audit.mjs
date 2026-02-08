import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const companyIdFromEnv = process.env.COMPANY_ID ?? null
const runIdFromEnv = process.env.RUN_ID ?? null

const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  return Number(value)
}

const round = (value) => Math.round(value * 100) / 100

const parseSchedule = (value) => {
  const fallback = {
    sss: "SECOND_HALF",
    philHealth: "FIRST_HALF",
    pagIbig: "FIRST_HALF",
    withholdingTax: "EVERY_PERIOD",
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback

  const valid = new Set(["FIRST_HALF", "SECOND_HALF", "EVERY_PERIOD", "DISABLED"])
  const normalized = { ...fallback }

  for (const key of Object.keys(normalized)) {
    const next = value[key]
    if (typeof next === "string" && valid.has(next)) {
      normalized[key] = next
    }
  }

  return normalized
}

const shouldApplyByTiming = (timing, payFrequencyCode, periodHalf) => {
  if (timing === "DISABLED") return false
  if (timing === "EVERY_PERIOD") return true
  if (payFrequencyCode !== "SEMI_MONTHLY") return true
  if (timing === "FIRST_HALF") return periodHalf === "FIRST"
  if (timing === "SECOND_HALF") return periodHalf === "SECOND"
  return true
}

const main = async () => {
  const failures = []
  const warnings = []

  const run = await prisma.payrollRun.findFirst({
    where: runIdFromEnv
      ? {
          id: runIdFromEnv,
          ...(companyIdFromEnv ? { companyId: companyIdFromEnv } : {}),
        }
      : {
          ...(companyIdFromEnv ? { companyId: companyIdFromEnv } : {}),
        },
    orderBy: { createdAt: "desc" },
    include: {
      payPeriod: {
        include: {
          pattern: {
            select: {
              payFrequencyCode: true,
              periodsPerYear: true,
              statutoryDeductionSchedule: true,
            },
          },
        },
      },
      processSteps: {
        orderBy: { stepNumber: "asc" },
      },
      payslips: {
        include: {
          earnings: { select: { amount: true } },
          deductions: { select: { amount: true, description: true } },
          employee: {
            select: {
              salary: {
                select: {
                  baseSalary: true,
                  salaryRateTypeCode: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!run) {
    console.error("No payroll run found for given filters.")
    process.exit(1)
  }

  const schedule = parseSchedule(run.payPeriod.pattern.statutoryDeductionSchedule)
  const payFrequencyCode = run.payPeriod.pattern.payFrequencyCode
  const periodHalf = run.payPeriod.periodHalf
  const periodsPerYear = Math.max(run.payPeriod.pattern.periodsPerYear ?? 1, 1)

  const stepByNumber = new Map(run.processSteps.map((step) => [step.stepNumber, step]))

  for (const [requiredStep, priorStep] of [
    [3, 2],
    [4, 3],
    [5, 4],
    [6, 5],
  ]) {
    if (run.currentStepNumber >= requiredStep) {
      const prior = stepByNumber.get(priorStep)
      if (!prior?.isCompleted) {
        failures.push(`Lifecycle invalid: current step is ${run.currentStepNumber} but step ${priorStep} is not completed.`)
      }
    }
  }

  if (run.statusCode === "PAID" && run.runTypeCode === "REGULAR" && run.payPeriod.statusCode !== "LOCKED") {
    failures.push("Policy mismatch: regular payroll run is PAID but pay period is not LOCKED.")
  }

  if (run.statusCode === "PAID" && run.runTypeCode !== "REGULAR" && run.payPeriod.statusCode === "LOCKED") {
    warnings.push("Non-regular run is PAID and period is LOCKED; verify this is intended for your operational policy.")
  }

  for (const payslip of run.payslips) {
    const earningsSum = round(payslip.earnings.reduce((sum, line) => sum + toNumber(line.amount), 0))
    const deductionsSum = round(payslip.deductions.reduce((sum, line) => sum + toNumber(line.amount), 0))
    const grossPay = round(toNumber(payslip.grossPay))
    const totalDeductions = round(toNumber(payslip.totalDeductions))
    const netPay = round(toNumber(payslip.netPay))

    if (Math.abs(earningsSum - grossPay) > 0.05) {
      failures.push(`Payslip ${payslip.payslipNumber}: gross mismatch (earnings sum ${earningsSum} vs gross ${grossPay}).`)
    }

    if (Math.abs(deductionsSum - totalDeductions) > 0.05) {
      failures.push(`Payslip ${payslip.payslipNumber}: deduction mismatch (deductions sum ${deductionsSum} vs total ${totalDeductions}).`)
    }

    if (Math.abs(round(grossPay - totalDeductions) - netPay) > 0.05) {
      failures.push(`Payslip ${payslip.payslipNumber}: net mismatch (gross - deductions != net).`)
    }

    const salary = payslip.employee.salary
    if (salary?.salaryRateTypeCode === "MONTHLY") {
      const baseSalary = toNumber(salary.baseSalary)
      const periodBaseCap = round((baseSalary * 12) / periodsPerYear)
      const basicPay = round(toNumber(payslip.basicPay))
      if (basicPay - periodBaseCap > 0.05) {
        failures.push(`Payslip ${payslip.payslipNumber}: monthly basic pay (${basicPay}) exceeds period base cap (${periodBaseCap}).`)
      }
    }

    const statutoryChecks = [
      { code: "sss", field: "sssEmployee", value: toNumber(payslip.sssEmployee) },
      { code: "philHealth", field: "philHealthEmployee", value: toNumber(payslip.philHealthEmployee) },
      { code: "pagIbig", field: "pagIbigEmployee", value: toNumber(payslip.pagIbigEmployee) },
      { code: "withholdingTax", field: "withholdingTax", value: toNumber(payslip.withholdingTax) },
    ]

    for (const check of statutoryChecks) {
      const timing = schedule[check.code]
      const shouldApply = shouldApplyByTiming(timing, payFrequencyCode, periodHalf)
      if (!shouldApply && round(check.value) > 0) {
        failures.push(`Payslip ${payslip.payslipNumber}: ${check.field} has value ${check.value} even though timing is ${timing} for ${periodHalf}.`)
      }
    }

    if (toNumber(payslip.tardinessMins) > 0) {
      const hasTardinessDeduction = payslip.deductions.some((line) => {
        const text = (line.description ?? "").toLowerCase()
        return text.includes("tard") || text.includes("late")
      })
      if (!hasTardinessDeduction) {
        warnings.push(`Payslip ${payslip.payslipNumber}: has tardiness minutes but no explicit tardiness/late deduction line.`)
      }
    }
  }

  const summary = {
    companyId: run.companyId,
    runId: run.id,
    runNumber: run.runNumber,
    periodHalf,
    payFrequencyCode,
    payslipCount: run.payslips.length,
    failures: failures.length,
    warnings: warnings.length,
  }

  console.log("PH Payroll E2E Audit Summary")
  console.log(JSON.stringify(summary, null, 2))

  if (failures.length > 0) {
    console.log("\nFailures:")
    for (const failure of failures) {
      console.log(`- ${failure}`)
    }
  }

  if (warnings.length > 0) {
    console.log("\nWarnings:")
    for (const warning of warnings) {
      console.log(`- ${warning}`)
    }
  }

  if (failures.length > 0) {
    process.exit(1)
  }
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
