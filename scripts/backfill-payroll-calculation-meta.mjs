import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const VERSION = "PH-PAYROLL-CALC-V2026.02.09"

const main = async () => {
  const steps = await prisma.payrollProcessStep.findMany({
    where: { stepNumber: 3 },
    select: { id: true, notes: true },
  })

  let updated = 0
  for (const step of steps) {
    let parsed
    try {
      parsed = step.notes ? JSON.parse(step.notes) : {}
    } catch {
      parsed = {}
    }

    const next = {
      ...parsed,
      calculationVersion: parsed?.calculationVersion ?? VERSION,
      formulaPolicy: parsed?.formulaPolicy ?? {
        locale: "PH",
        timezone: "Asia/Manila",
        preTaxRecurringReducesTaxableIncome: true,
        leaveFallbackOnUnmatchedOnLeave: "UNPAID",
      },
      employeeCalculationTraces: Array.isArray(parsed?.employeeCalculationTraces)
        ? parsed.employeeCalculationTraces
        : [],
    }

    if (
      parsed?.calculationVersion === next.calculationVersion &&
      parsed?.formulaPolicy &&
      Array.isArray(parsed?.employeeCalculationTraces)
    ) {
      continue
    }

    await prisma.payrollProcessStep.update({
      where: { id: step.id },
      data: { notes: JSON.stringify(next) },
    })
    updated += 1
  }

  console.log(`Backfilled payroll calculation metadata for ${updated} step records.`)
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
