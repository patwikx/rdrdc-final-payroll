import { PayrollRunType } from "@prisma/client"

import { db } from "@/lib/db"
import { getPhYear } from "@/lib/ph-time"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { MonthlyBirWTaxReportViewModel } from "@/modules/reports/payroll/types/report-view-models"
import {
  aggregateMonthlyBirWTaxRows,
  getMonthlyBirWTaxCsvRows,
  selectMonthlyBirWTaxRows,
  type MonthlyWTaxSourcePayslipRow,
} from "@/modules/reports/payroll/utils/monthly-bir-wtax-report-helpers"
import {
  getPhMonthDateBoundsUtc,
  resolveReportYearMonth,
  toReportYearMonthKey,
  type ReportYearMonth,
} from "@/modules/reports/payroll/utils/report-time-utils"

type MonthlyBirWTaxInput = {
  companyId: string
  year?: string | number
  month?: string | number
  includeTrialRuns?: string | boolean
}

export type MonthlyBirWTaxWorkspaceViewModel = MonthlyBirWTaxReportViewModel & {
  filters: {
    year: number
    month: number
    includeTrialRuns: boolean
  }
  options: {
    yearOptions: number[]
  }
  generatedAtLabel: string
}

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const toDateTimeLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const parseIncludeTrialRuns = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

export { aggregateMonthlyBirWTaxRows, getMonthlyBirWTaxCsvRows, selectMonthlyBirWTaxRows }

export async function getMonthlyBirWTaxReportWorkspaceViewModel(
  input: MonthlyBirWTaxInput
): Promise<MonthlyBirWTaxWorkspaceViewModel> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  const includeTrialRuns = parseIncludeTrialRuns(input.includeTrialRuns)

  const selectedYearMonth: ReportYearMonth = resolveReportYearMonth(
    {
      year: input.year !== undefined ? Number(input.year) : undefined,
      month: input.month !== undefined ? Number(input.month) : undefined,
    },
    new Date()
  )
  const { startUtcDateOnly, endUtcDateOnly } = getPhMonthDateBoundsUtc(selectedYearMonth)

  const [yearRows, payslipRows] = await Promise.all([
    db.payPeriod.findMany({
      where: {
        pattern: { companyId: context.companyId },
      },
      select: {
        year: true,
      },
      distinct: ["year"],
      orderBy: [{ year: "desc" }],
    }),
    db.payslip.findMany({
      where: {
        payrollRun: {
          companyId: context.companyId,
          payPeriod: {
            cutoffEndDate: {
              gte: startUtcDateOnly,
              lte: endUtcDateOnly,
            },
          },
          ...(includeTrialRuns
            ? {
                OR: [
                  { runTypeCode: PayrollRunType.REGULAR, isTrialRun: false },
                  { isTrialRun: true },
                  { runTypeCode: PayrollRunType.TRIAL_RUN },
                ],
              }
            : {
                runTypeCode: PayrollRunType.REGULAR,
                isTrialRun: false,
              }),
        },
      },
      select: {
        departmentSnapshotName: true,
        withholdingTax: true,
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            department: {
              select: {
                name: true,
              },
            },
            governmentIds: {
              where: {
                isActive: true,
                idTypeId: "TIN",
              },
              select: {
                idNumberMasked: true,
              },
              take: 1,
            },
          },
        },
        payrollRun: {
          select: {
            runNumber: true,
            runTypeCode: true,
            isTrialRun: true,
            createdAt: true,
            payPeriodId: true,
          },
        },
      },
      orderBy: [{ payrollRun: { createdAt: "desc" } }],
    }),
  ])

  const sourceRows: MonthlyWTaxSourcePayslipRow[] = payslipRows.map((row) => ({
    employeeId: row.employee.id,
    employeeNumber: row.employee.employeeNumber,
    employeeName: `${row.employee.lastName}, ${row.employee.firstName}`,
    departmentName: row.departmentSnapshotName ?? row.employee.department?.name ?? null,
    tinNumberMasked: row.employee.governmentIds[0]?.idNumberMasked ?? null,
    runNumber: row.payrollRun.runNumber,
    runCreatedAt: row.payrollRun.createdAt,
    payPeriodId: row.payrollRun.payPeriodId,
    runTypeCode: row.payrollRun.runTypeCode,
    isTrialRun: row.payrollRun.isTrialRun,
    withholdingTaxAmount: toNumber(row.withholdingTax),
  }))

  const selectedRows = selectMonthlyBirWTaxRows(sourceRows, includeTrialRuns)
  const aggregatedRows = aggregateMonthlyBirWTaxRows(selectedRows)
  const totalWithholdingTaxAmount = Math.round(
    aggregatedRows.reduce((sum, row) => sum + row.withholdingTaxAmount, 0) * 100
  ) / 100

  const yearOptionsSet = new Set<number>(yearRows.map((row) => row.year))
  yearOptionsSet.add(getPhYear())
  yearOptionsSet.add(selectedYearMonth.year)
  const yearOptions = Array.from(yearOptionsSet).sort((a, b) => b - a)

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    year: selectedYearMonth.year,
    month: selectedYearMonth.month,
    includeTrialRuns,
    rows: aggregatedRows,
    totalWithholdingTaxAmount,
    filters: {
      year: selectedYearMonth.year,
      month: selectedYearMonth.month,
      includeTrialRuns,
    },
    options: {
      yearOptions,
    },
    generatedAtLabel: toDateTimeLabel(new Date()),
  }
}

export const toMonthlyBirWTaxMonthKey = (input: { year: number; month: number }): string =>
  toReportYearMonthKey(input)
