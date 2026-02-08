import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { StatutoryTablesInput } from "@/modules/settings/statutory/schemas/statutory-tables-schema"

export type StatutoryTablesViewModel = {
  companyName: string
  companyCode: string
  companyRole: string
  form: StatutoryTablesInput
}

const toDateInputValue = (value: Date | null | undefined): string => {
  if (!value) {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Manila",
    }).format(new Date())
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const defaultTaxRows: StatutoryTablesInput["taxRows"] = [
  { bracketOver: 0, bracketNotOver: 10417, baseTax: 0, taxRatePercent: 0, excessOver: 0 },
  { bracketOver: 10417, bracketNotOver: 16667, baseTax: 0, taxRatePercent: 0.15, excessOver: 10417 },
  { bracketOver: 16667, bracketNotOver: 33333, baseTax: 937.5, taxRatePercent: 0.2, excessOver: 16667 },
  { bracketOver: 33333, bracketNotOver: 83333, baseTax: 4270.7, taxRatePercent: 0.25, excessOver: 33333 },
  { bracketOver: 83333, bracketNotOver: 333333, baseTax: 16770.7, taxRatePercent: 0.3, excessOver: 83333 },
  { bracketOver: 333333, bracketNotOver: 999999999, baseTax: 91770.7, taxRatePercent: 0.35, excessOver: 333333 },
]

export async function getStatutoryTablesViewModel(companyId: string): Promise<StatutoryTablesViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const [latestSss, latestPhilHealth, latestPagIbig, latestTax] = await Promise.all([
    db.sSSContributionTable.findFirst({ where: { isActive: true }, orderBy: { effectiveFrom: "desc" }, select: { version: true, effectiveFrom: true } }),
    db.philHealthContributionTable.findFirst({ where: { isActive: true }, orderBy: { effectiveFrom: "desc" }, select: { version: true, effectiveFrom: true } }),
    db.pagIBIGContributionTable.findFirst({ where: { isActive: true }, orderBy: { effectiveFrom: "desc" }, select: { version: true, effectiveFrom: true } }),
    db.taxTable.findFirst({
      where: { isActive: true, taxTableTypeCode: "SEMI_MONTHLY" },
      orderBy: { effectiveFrom: "desc" },
      select: { version: true, effectiveFrom: true, effectiveYear: true },
    }),
  ])

  const [sssRowsRaw, philRowsRaw, pagRowsRaw, taxRowsRaw] = await Promise.all([
    latestSss
      ? db.sSSContributionTable.findMany({ where: { version: latestSss.version }, orderBy: { salaryBracketMin: "asc" } })
      : Promise.resolve([]),
    latestPhilHealth
      ? db.philHealthContributionTable.findMany({ where: { version: latestPhilHealth.version }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    latestPagIbig
      ? db.pagIBIGContributionTable.findMany({ where: { version: latestPagIbig.version }, orderBy: { salaryBracketMin: "asc" } })
      : Promise.resolve([]),
    latestTax
      ? db.taxTable.findMany({
          where: { version: latestTax.version, taxTableTypeCode: "SEMI_MONTHLY" },
          orderBy: { bracketOver: "asc" },
        })
      : Promise.resolve([]),
  ])

  const sssRows: StatutoryTablesInput["sssRows"] = sssRowsRaw.length
    ? sssRowsRaw.map((row) => ({
        salaryBracketMin: Number(row.salaryBracketMin),
        salaryBracketMax: Number(row.salaryBracketMax),
        monthlySalaryCredit: Number(row.monthlySalaryCredit),
        employeeShare: Number(row.employeeShare),
        employerShare: Number(row.employerShare),
        ecContribution: Number(row.ecContribution),
        totalContribution: Number(row.totalContribution),
        wispEmployee: row.wispEmployee ? Number(row.wispEmployee) : undefined,
        wispEmployer: row.wispEmployer ? Number(row.wispEmployer) : undefined,
      }))
    : [
        {
          salaryBracketMin: 0,
          salaryBracketMax: 0,
          monthlySalaryCredit: 0,
          employeeShare: 0,
          employerShare: 0,
          ecContribution: 0,
          totalContribution: 0,
        },
      ]

  const philHealthRows: StatutoryTablesInput["philHealthRows"] = philRowsRaw.length
    ? philRowsRaw.map((row) => ({
        premiumRate: Number(row.premiumRate),
        monthlyFloor: Number(row.monthlyFloor),
        monthlyCeiling: Number(row.monthlyCeiling),
        employeeSharePercent: Number(row.employeeSharePercent),
        employerSharePercent: Number(row.employerSharePercent),
        membershipCategory: row.membershipCategory ?? undefined,
      }))
    : [
        {
          premiumRate: 0.05,
          monthlyFloor: 10000,
          monthlyCeiling: 100000,
          employeeSharePercent: 0.5,
          employerSharePercent: 0.5,
          membershipCategory: undefined,
        },
      ]

  const pagIbigRows: StatutoryTablesInput["pagIbigRows"] = pagRowsRaw.length
    ? pagRowsRaw.map((row) => ({
        salaryBracketMin: Number(row.salaryBracketMin),
        salaryBracketMax: Number(row.salaryBracketMax),
        employeeRatePercent: Number(row.employeeRatePercent),
        employerRatePercent: Number(row.employerRatePercent),
        maxMonthlyCompensation: Number(row.maxMonthlyCompensation),
      }))
    : [
        {
          salaryBracketMin: 0,
          salaryBracketMax: 1500,
          employeeRatePercent: 0.01,
          employerRatePercent: 0.02,
          maxMonthlyCompensation: 10000,
        },
      ]

  const taxRows: StatutoryTablesInput["taxRows"] = taxRowsRaw.length
    ? taxRowsRaw.map((row) => ({
        bracketOver: Number(row.bracketOver),
        bracketNotOver: Number(row.bracketNotOver),
        baseTax: Number(row.baseTax),
        taxRatePercent: Number(row.taxRatePercent),
        excessOver: Number(row.excessOver),
      }))
    : defaultTaxRows

  return {
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    form: {
      companyId: context.companyId,
      effectiveFrom: toDateInputValue(latestTax?.effectiveFrom ?? latestSss?.effectiveFrom ?? latestPhilHealth?.effectiveFrom ?? latestPagIbig?.effectiveFrom),
      sssRows,
      philHealthRows,
      pagIbigRows,
      taxRows,
    },
  }
}
