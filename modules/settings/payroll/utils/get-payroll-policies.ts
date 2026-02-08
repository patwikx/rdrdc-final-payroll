import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { db } from "@/lib/db"
import type { PayrollPoliciesInput } from "@/modules/settings/payroll/schemas/payroll-policies-schema"

const defaultStatutoryDeductionSchedule: PayrollPoliciesInput["statutoryDeductionSchedule"] = {
  sss: "SECOND_HALF",
  philHealth: "FIRST_HALF",
  pagIbig: "FIRST_HALF",
  withholdingTax: "EVERY_PERIOD",
}

const parseStatutoryDeductionSchedule = (value: unknown): PayrollPoliciesInput["statutoryDeductionSchedule"] => {
  if (!value || typeof value !== "object") {
    return defaultStatutoryDeductionSchedule
  }

  const record = value as Record<string, unknown>
  const normalize = (entry: unknown, fallback: PayrollPoliciesInput["statutoryDeductionSchedule"]["sss"]) => {
    if (entry === "FIRST_HALF" || entry === "SECOND_HALF" || entry === "EVERY_PERIOD" || entry === "DISABLED") {
      return entry
    }
    return fallback
  }

  return {
    sss: normalize(record.sss, defaultStatutoryDeductionSchedule.sss),
    philHealth: normalize(record.philHealth, defaultStatutoryDeductionSchedule.philHealth),
    pagIbig: normalize(record.pagIbig, defaultStatutoryDeductionSchedule.pagIbig),
    withholdingTax: normalize(record.withholdingTax, defaultStatutoryDeductionSchedule.withholdingTax),
  }
}

export type PayrollPoliciesViewModel = {
  companyName: string
  companyCode: string
  companyRole: string
  form: PayrollPoliciesInput
  availableYears: number[]
}

const toDateInputValue = (value: Date | null | undefined): string => {
  if (!value) {
    return ""
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toPhDate = (year: number, month: number, day: number): Date => {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

const getPhYear = (value: Date): number => {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      timeZone: "Asia/Manila",
    }).format(value)
  )
}

const addMonths = (year: number, month: number, delta: number): { year: number; month: number } => {
  const base = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 }
}

const generateDefaultRows = (year: number): PayrollPoliciesInput["periodRows"] => {
  const rows: PayrollPoliciesInput["periodRows"] = []

  const defaults = {
    firstHalfCutoffStart: 8,
    firstHalfCutoffEnd: 22,
    firstHalfPaymentDay: 30,
    secondHalfCutoffStart: 23,
    secondHalfCutoffEnd: 7,
    secondHalfPaymentDay: 15,
    secondHalfSpansMonth: true,
  }

  for (let month = 1; month <= 12; month += 1) {
    rows.push({
      year,
      periodNumber: month * 2 - 1,
      periodHalf: "FIRST",
      cutoffStartDate: toDateInputValue(toPhDate(year, month, defaults.firstHalfCutoffStart)),
      cutoffEndDate: toDateInputValue(toPhDate(year, month, defaults.firstHalfCutoffEnd)),
      paymentDate: toDateInputValue(toPhDate(year, month, defaults.firstHalfPaymentDay)),
      statusCode: "OPEN",
      workingDays: undefined,
    })

    const endRef = defaults.secondHalfSpansMonth ? addMonths(year, month, 1) : { year, month }
    const paymentRef = defaults.secondHalfSpansMonth ? addMonths(year, month, 1) : { year, month }

    rows.push({
      year,
      periodNumber: month * 2,
      periodHalf: "SECOND",
      cutoffStartDate: toDateInputValue(toPhDate(year, month, defaults.secondHalfCutoffStart)),
      cutoffEndDate: toDateInputValue(toPhDate(endRef.year, endRef.month, defaults.secondHalfCutoffEnd)),
      paymentDate: toDateInputValue(toPhDate(paymentRef.year, paymentRef.month, defaults.secondHalfPaymentDay)),
      statusCode: "OPEN",
      workingDays: undefined,
    })
  }

  return rows
}

export async function getPayrollPoliciesViewModel(companyId: string, selectedYear?: number): Promise<PayrollPoliciesViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const pattern = await db.payPeriodPattern.findFirst({
    where: { companyId: context.companyId },
    orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
  })

  const resolvedYear =
    selectedYear ??
    (pattern?.effectiveFrom ? getPhYear(pattern.effectiveFrom) : getPhYear(new Date()))

  const [existingRows, yearsSummary] = pattern
    ? await Promise.all([
        db.payPeriod.findMany({
          where: {
          patternId: pattern.id,
          year: resolvedYear,
          },
          orderBy: [{ periodNumber: "asc" }],
        }),
        db.payPeriod.groupBy({
          by: ["year"],
          where: { patternId: pattern.id },
          orderBy: { year: "asc" },
        }),
      ])
    : [[], []]

  const generatedRows = generateDefaultRows(resolvedYear)

  const periodRows = generatedRows.map((row) => {
    const existing = existingRows.find((item) => item.periodNumber === row.periodNumber)

    if (!existing) {
      return row
    }

    return {
      id: existing.id,
      year: existing.year,
      periodNumber: existing.periodNumber,
      periodHalf: existing.periodHalf,
      cutoffStartDate: toDateInputValue(existing.cutoffStartDate),
      cutoffEndDate: toDateInputValue(existing.cutoffEndDate),
      paymentDate: toDateInputValue(existing.paymentDate),
      statusCode: existing.statusCode,
      workingDays: existing.workingDays ?? undefined,
    }
  })

  return {
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    availableYears: Array.from(new Set([resolvedYear, ...yearsSummary.map((item) => item.year)])).sort(
      (a, b) => a - b
    ),
    form: {
      companyId: context.companyId,
      patternId: pattern?.id,
      code: pattern?.code ?? "SEMI_MONTHLY_MAIN",
      name: pattern?.name ?? "Semi-Monthly Payroll",
      description: pattern?.description ?? "",
      payFrequencyCode: pattern?.payFrequencyCode ?? "SEMI_MONTHLY",
      periodsPerYear: pattern?.periodsPerYear ?? 24,
      statutoryDeductionSchedule: parseStatutoryDeductionSchedule(
        (pattern as unknown as { statutoryDeductionSchedule?: unknown } | null)?.statutoryDeductionSchedule
      ),
      periodYear: resolvedYear,
      paymentDayOffset: pattern?.paymentDayOffset ?? 0,
      effectiveFrom: toDateInputValue(pattern?.effectiveFrom) || toDateInputValue(new Date()),
      effectiveTo: toDateInputValue(pattern?.effectiveTo),
      isActive: pattern?.isActive ?? true,
      periodRows,
    },
  }
}
