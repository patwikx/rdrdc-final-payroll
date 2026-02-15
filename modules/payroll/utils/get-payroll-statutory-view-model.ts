import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { PayrollRunType, TaxTableType } from "@prisma/client"

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const money = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toPhp = (value: number): string => `PHP ${money.format(value)}`

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

type StatutoryMonthlyRow = {
  payslipId: string
  employeeId: string
  employeeName: string
  employeeNumber: string
  employeePhotoUrl: string | null
  birthDate: string | null
  sssNumber: string | null
  philHealthPin: string | null
  pagIbigNumber: string | null
  tinNumber: string | null
  runNumber: string
  periodLabel: string
  cutoffEndDateIso: string
  grossPay: string
  sssEmployee: string
  sssEmployer: string
  philHealthEmployee: string
  philHealthEmployer: string
  pagIbigEmployee: string
  pagIbigEmployer: string
  withholdingTax: string
}

type StatutoryBirRow = {
  employeeId: string
  employeeName: string
  employeeNumber: string
  tinNumber: string | null
  year: number
  sssEmployee: string
  philHealthEmployee: string
  pagIbigEmployee: string
  grossCompensation: string
  nonTaxableBenefits: string
  taxableCompensation: string
  withholdingTax: string
  annualTaxDue: string
  taxVariance: string
}

type StatutoryDoleRow = {
  employeeId: string
  employeeName: string
  employeeNumber: string
  year: number
  annualBasicSalary: string
  thirteenthMonthPay: string
}

export type PayrollStatutoryViewModel = {
  companyId: string
  companyName: string
  printedBy: string
  payrollRegisterRuns: Array<{
    runId: string
    runNumber: string
    runTypeCode: PayrollRunType
    isTrialRun: boolean
    periodLabel: string
    createdAtIso: string
  }>
  totals: {
    sssEmployee: string
    sssEmployer: string
    philHealthEmployee: string
    philHealthEmployer: string
    pagIbigEmployee: string
    pagIbigEmployer: string
    withholdingTax: string
  }
  rows: StatutoryMonthlyRow[]
  trialRows: StatutoryMonthlyRow[]
  birRows: StatutoryBirRow[]
  trialBirRows: StatutoryBirRow[]
  doleRows: StatutoryDoleRow[]
  trialDoleRows: StatutoryDoleRow[]
}

type StatutorySourcePayslip = {
  id: string
  grossPay: { toString(): string } | null
  basicPay: { toString(): string } | null
  sssEmployee: { toString(): string } | null
  sssEmployer: { toString(): string } | null
  philHealthEmployee: { toString(): string } | null
  philHealthEmployer: { toString(): string } | null
  pagIbigEmployee: { toString(): string } | null
  pagIbigEmployer: { toString(): string } | null
  withholdingTax: { toString(): string } | null
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNumber: string
    photoUrl: string | null
    birthDate: Date | null
    governmentIds: Array<{
      idTypeId: string
      idNumberMasked: string | null
    }>
  }
  payrollRun: {
    id: string
    payPeriodId: string
    runNumber: string
    runTypeCode: PayrollRunType
    isTrialRun: boolean
    createdAt: Date
    payPeriod: {
      year: number
      periodNumber: number
      cutoffStartDate: Date
      cutoffEndDate: Date
    }
  }
}

type AnnualTaxRow = {
  effectiveYear: number
  effectiveFrom: Date
  bracketOver: { toString(): string }
  bracketNotOver: { toString(): string }
  baseTax: { toString(): string }
  taxRatePercent: { toString(): string }
  excessOver: { toString(): string }
}

const toYearEndDateUtc = (year: number): Date => new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

const computeAnnualTaxDue = (taxableCompensation: number, annualTaxRows: AnnualTaxRow[]): number => {
  if (taxableCompensation <= 0 || annualTaxRows.length === 0) {
    return 0
  }

  const sortedRows = [...annualTaxRows].sort(
    (a, b) => Number(a.bracketOver.toString()) - Number(b.bracketOver.toString())
  )

  const matched =
    sortedRows.find((row) => {
      const over = Number(row.bracketOver.toString())
      const notOver = Number(row.bracketNotOver.toString())
      return taxableCompensation >= over && taxableCompensation <= notOver
    }) ??
    sortedRows
      .slice()
      .reverse()
      .find((row) => taxableCompensation >= Number(row.bracketOver.toString()))

  if (!matched) {
    return 0
  }

  const baseTax = Number(matched.baseTax.toString())
  const rate = Number(matched.taxRatePercent.toString())
  const excessOver = Number(matched.excessOver.toString())

  return Math.max(0, baseTax + (taxableCompensation - excessOver) * rate)
}

const selectLatestTrialPayslipsByPayPeriod = (payslips: StatutorySourcePayslip[]): StatutorySourcePayslip[] => {
  const latestTrialRunByPeriod = new Map<
    string,
    {
      runId: string
      createdAtMs: number
      runNumber: string
    }
  >()

  for (const payslip of payslips) {
    const isTrialPayslip =
      payslip.payrollRun.isTrialRun || payslip.payrollRun.runTypeCode === PayrollRunType.TRIAL_RUN
    if (!isTrialPayslip) {
      continue
    }

    const payPeriodId = payslip.payrollRun.payPeriodId
    const createdAtMs = payslip.payrollRun.createdAt.getTime()
    const existing = latestTrialRunByPeriod.get(payPeriodId)

    if (
      !existing ||
      createdAtMs > existing.createdAtMs ||
      (createdAtMs === existing.createdAtMs && payslip.payrollRun.runNumber > existing.runNumber)
    ) {
      latestTrialRunByPeriod.set(payPeriodId, {
        runId: payslip.payrollRun.id,
        createdAtMs,
        runNumber: payslip.payrollRun.runNumber,
      })
    }
  }

  return payslips.filter((payslip) => {
    const isTrialPayslip =
      payslip.payrollRun.isTrialRun || payslip.payrollRun.runTypeCode === PayrollRunType.TRIAL_RUN
    if (!isTrialPayslip) {
      return false
    }

    const latestRun = latestTrialRunByPeriod.get(payslip.payrollRun.payPeriodId)
    return latestRun?.runId === payslip.payrollRun.id
  })
}

const buildMonthlyRows = (payslips: StatutorySourcePayslip[]): StatutoryMonthlyRow[] => {
  return payslips.map((payslip) => {
    const philHealthGovId =
      payslip.employee.governmentIds.find((item) => item.idTypeId === "PHILHEALTH")?.idNumberMasked ?? null
    const pagIbigGovId =
      payslip.employee.governmentIds.find((item) => item.idTypeId === "PAGIBIG")?.idNumberMasked ?? null
    const sssGovId =
      payslip.employee.governmentIds.find((item) => item.idTypeId === "SSS")?.idNumberMasked ?? null
    const tinGovId =
      payslip.employee.governmentIds.find((item) => item.idTypeId === "TIN")?.idNumberMasked ?? null

    return {
      payslipId: payslip.id,
      employeeId: payslip.employee.id,
      employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
      employeeNumber: payslip.employee.employeeNumber,
      employeePhotoUrl: payslip.employee.photoUrl,
      birthDate: payslip.employee.birthDate ? payslip.employee.birthDate.toISOString() : null,
      sssNumber: sssGovId,
      philHealthPin: philHealthGovId,
      pagIbigNumber: pagIbigGovId,
      tinNumber: tinGovId,
      runNumber: payslip.payrollRun.runNumber,
      periodLabel: `${toDateLabel(payslip.payrollRun.payPeriod.cutoffStartDate)} - ${toDateLabel(payslip.payrollRun.payPeriod.cutoffEndDate)}`,
      cutoffEndDateIso: payslip.payrollRun.payPeriod.cutoffEndDate.toISOString(),
      grossPay: toPhp(toNumber(payslip.grossPay)),
      sssEmployee: toPhp(toNumber(payslip.sssEmployee)),
      sssEmployer: toPhp(toNumber(payslip.sssEmployer)),
      philHealthEmployee: toPhp(toNumber(payslip.philHealthEmployee)),
      philHealthEmployer: toPhp(toNumber(payslip.philHealthEmployer)),
      pagIbigEmployee: toPhp(toNumber(payslip.pagIbigEmployee)),
      pagIbigEmployer: toPhp(toNumber(payslip.pagIbigEmployer)),
      withholdingTax: toPhp(toNumber(payslip.withholdingTax)),
    }
  })
}

const buildBirRows = (payslips: StatutorySourcePayslip[], annualTaxRows: AnnualTaxRow[]): StatutoryBirRow[] => {
  return Array.from(
    payslips
      .reduce(
        (map, payslip) => {
          const year = payslip.payrollRun.payPeriod.year
          const key = `${payslip.employee.id}:${year}`
          const existing = map.get(key)

          const gross = toNumber(payslip.grossPay)
          const sssEmployee = toNumber(payslip.sssEmployee)
          const philHealthEmployee = toNumber(payslip.philHealthEmployee)
          const pagIbigEmployee = toNumber(payslip.pagIbigEmployee)
          const withholdingTax = toNumber(payslip.withholdingTax)

          if (!existing) {
            map.set(key, {
              employeeId: payslip.employee.id,
              employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
              employeeNumber: payslip.employee.employeeNumber,
              tinNumber: payslip.employee.governmentIds.find((item) => item.idTypeId === "TIN")?.idNumberMasked ?? null,
              year,
              sssEmployee,
              philHealthEmployee,
              pagIbigEmployee,
              grossCompensation: gross,
              withholdingTax,
            })
          } else {
            existing.sssEmployee += sssEmployee
            existing.philHealthEmployee += philHealthEmployee
            existing.pagIbigEmployee += pagIbigEmployee
            existing.grossCompensation += gross
            existing.withholdingTax += withholdingTax
          }

          return map
        },
        new Map<
          string,
          {
            employeeId: string
            employeeName: string
            employeeNumber: string
            tinNumber: string | null
            year: number
            sssEmployee: number
            philHealthEmployee: number
            pagIbigEmployee: number
            grossCompensation: number
            withholdingTax: number
          }
        >()
      )
      .values()
  )
    .map((item) => {
      const nonTaxableBenefits = 0
      const mandatoryContributions = item.sssEmployee + item.philHealthEmployee + item.pagIbigEmployee
      const taxableCompensation = Math.max(0, item.grossCompensation - mandatoryContributions - nonTaxableBenefits)

      const taxRowsForYear = annualTaxRows
        .filter(
          (row) => row.effectiveYear === item.year && row.effectiveFrom.getTime() <= toYearEndDateUtc(item.year).getTime()
        )
        .sort((a, b) => Number(a.bracketOver.toString()) - Number(b.bracketOver.toString()))

      const annualTaxDue = computeAnnualTaxDue(taxableCompensation, taxRowsForYear)
      const taxVariance = annualTaxDue - item.withholdingTax

      return {
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        employeeNumber: item.employeeNumber,
        tinNumber: item.tinNumber,
        year: item.year,
        sssEmployee: toPhp(item.sssEmployee),
        philHealthEmployee: toPhp(item.philHealthEmployee),
        pagIbigEmployee: toPhp(item.pagIbigEmployee),
        grossCompensation: toPhp(item.grossCompensation),
        nonTaxableBenefits: toPhp(nonTaxableBenefits),
        taxableCompensation: toPhp(taxableCompensation),
        withholdingTax: toPhp(item.withholdingTax),
        annualTaxDue: toPhp(annualTaxDue),
        taxVariance: toPhp(taxVariance),
      }
    })
    .sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year
      }

      return a.employeeName.localeCompare(b.employeeName)
    })
}

const buildDoleRows = (payslips: StatutorySourcePayslip[]): StatutoryDoleRow[] => {
  return Array.from(
    payslips
      .reduce(
        (map, payslip) => {
          const year = payslip.payrollRun.payPeriod.year
          const key = `${payslip.employee.id}:${year}`
          const existing = map.get(key)

          const basicPay = toNumber(payslip.basicPay)

          if (!existing) {
            map.set(key, {
              employeeId: payslip.employee.id,
              employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
              employeeNumber: payslip.employee.employeeNumber,
              year,
              annualBasicSalary: basicPay,
            })
          } else {
            existing.annualBasicSalary += basicPay
          }

          return map
        },
        new Map<
          string,
          {
            employeeId: string
            employeeName: string
            employeeNumber: string
            year: number
            annualBasicSalary: number
          }
        >()
      )
      .values()
  )
    .map((item) => ({
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      employeeNumber: item.employeeNumber,
      year: item.year,
      annualBasicSalary: toPhp(item.annualBasicSalary),
      thirteenthMonthPay: toPhp(0),
    }))
    .sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year
      }

      return a.employeeName.localeCompare(b.employeeName)
    })
}

const buildPayrollRegisterRuns = (
  payslips: StatutorySourcePayslip[]
): Array<{
  runId: string
  runNumber: string
  runTypeCode: PayrollRunType
  isTrialRun: boolean
  periodLabel: string
  createdAtIso: string
}> => {
  const runMap = new Map<
    string,
    {
      runId: string
      runNumber: string
      runTypeCode: PayrollRunType
      isTrialRun: boolean
      periodLabel: string
      createdAtIso: string
      createdAtMs: number
    }
  >()

  for (const payslip of payslips) {
    const run = payslip.payrollRun
    if (runMap.has(run.id)) {
      continue
    }

    runMap.set(run.id, {
      runId: run.id,
      runNumber: run.runNumber,
      runTypeCode: run.runTypeCode,
      isTrialRun: run.isTrialRun,
      periodLabel: `${toDateLabel(run.payPeriod.cutoffStartDate)} - ${toDateLabel(run.payPeriod.cutoffEndDate)}`,
      createdAtIso: run.createdAt.toISOString(),
      createdAtMs: run.createdAt.getTime(),
    })
  }

  return Array.from(runMap.values())
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .map(({ createdAtMs: _createdAtMs, ...row }) => row)
}

export async function getPayrollStatutoryViewModel(companyId: string): Promise<PayrollStatutoryViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const userMetaPromise = db.user.findUnique({
    where: { id: context.userId },
    select: {
      firstName: true,
      lastName: true,
      username: true,
    },
  })

  const payslipsPromise = db.payslip.findMany({
    where: {
      payrollRun: {
        companyId: context.companyId,
        runTypeCode: { in: [PayrollRunType.REGULAR, PayrollRunType.TRIAL_RUN] },
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          photoUrl: true,
          birthDate: true,
          governmentIds: {
            where: {
              isActive: true,
              idTypeId: { in: ["PHILHEALTH", "PAGIBIG", "TIN", "SSS"] },
            },
            select: {
              idTypeId: true,
              idNumberMasked: true,
            },
          },
        },
      },
      payrollRun: {
        select: {
          id: true,
          payPeriodId: true,
          runNumber: true,
          runTypeCode: true,
          isTrialRun: true,
          createdAt: true,
          payPeriod: {
            select: {
              year: true,
              periodNumber: true,
              cutoffStartDate: true,
              cutoffEndDate: true,
            },
          },
        },
      },
    },
    orderBy: [{ generatedAt: "desc" }],
  })

  const annualTaxRowsPromise = db.taxTable.findMany({
    where: {
      taxTableTypeCode: TaxTableType.ANNUAL,
      isActive: true,
    },
    select: {
      effectiveYear: true,
      effectiveFrom: true,
      bracketOver: true,
      bracketNotOver: true,
      baseTax: true,
      taxRatePercent: true,
      excessOver: true,
    },
    orderBy: [{ effectiveYear: "desc" }, { effectiveFrom: "desc" }, { bracketOver: "asc" }],
  })

  const [userMeta, allPayslips, annualTaxRows] = await Promise.all([
    userMetaPromise,
    payslipsPromise,
    annualTaxRowsPromise,
  ])

  const payslips = allPayslips as StatutorySourcePayslip[]
  const regularPayslips = payslips.filter(
    (payslip) =>
      payslip.payrollRun.runTypeCode === PayrollRunType.REGULAR &&
      !payslip.payrollRun.isTrialRun
  )
  const latestTrialPayslips = selectLatestTrialPayslipsByPayPeriod(payslips)

  const printedBy =
    userMeta && userMeta.firstName && userMeta.lastName
      ? `${userMeta.firstName} ${userMeta.lastName}`
      : (userMeta?.username ?? "SYSTEM")

  const totalsRaw = regularPayslips.reduce(
    (acc, payslip) => {
      acc.sssEmployee += toNumber(payslip.sssEmployee)
      acc.sssEmployer += toNumber(payslip.sssEmployer)
      acc.philHealthEmployee += toNumber(payslip.philHealthEmployee)
      acc.philHealthEmployer += toNumber(payslip.philHealthEmployer)
      acc.pagIbigEmployee += toNumber(payslip.pagIbigEmployee)
      acc.pagIbigEmployer += toNumber(payslip.pagIbigEmployer)
      acc.withholdingTax += toNumber(payslip.withholdingTax)
      return acc
    },
    {
      sssEmployee: 0,
      sssEmployer: 0,
      philHealthEmployee: 0,
      philHealthEmployer: 0,
      pagIbigEmployee: 0,
      pagIbigEmployer: 0,
      withholdingTax: 0,
    }
  )

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    printedBy,
    payrollRegisterRuns: buildPayrollRegisterRuns(payslips),
    totals: {
      sssEmployee: toPhp(totalsRaw.sssEmployee),
      sssEmployer: toPhp(totalsRaw.sssEmployer),
      philHealthEmployee: toPhp(totalsRaw.philHealthEmployee),
      philHealthEmployer: toPhp(totalsRaw.philHealthEmployer),
      pagIbigEmployee: toPhp(totalsRaw.pagIbigEmployee),
      pagIbigEmployer: toPhp(totalsRaw.pagIbigEmployer),
      withholdingTax: toPhp(totalsRaw.withholdingTax),
    },
    rows: buildMonthlyRows(regularPayslips),
    trialRows: buildMonthlyRows(latestTrialPayslips),
    birRows: buildBirRows(regularPayslips, annualTaxRows),
    trialBirRows: buildBirRows(latestTrialPayslips, annualTaxRows),
    doleRows: buildDoleRows(regularPayslips),
    trialDoleRows: buildDoleRows(latestTrialPayslips),
  }
}
