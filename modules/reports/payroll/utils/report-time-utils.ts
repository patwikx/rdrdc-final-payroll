import {
  getPhMonthIndex,
  getPhYear,
  parsePhDateInputToUtcDateOnly,
  toPhDateInputValue,
} from "../../../../lib/ph-time.ts"

export type ReportYearMonth = {
  year: number
  month: number
}

export type NormalizeReportDateRangeResult =
  | {
      ok: true
      startDateValue: string | null
      endDateValue: string | null
      startUtcDateOnly: Date | null
      endUtcDateOnly: Date | null
    }
  | {
      ok: false
      error: string
    }

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/

const isValidMonth = (month: number): boolean => month >= 1 && month <= 12

const isValidYear = (year: number): boolean => year >= 2000 && year <= 2100

const parseValidatedPhDateInput = (value: string): Date | null => {
  const parsed = parsePhDateInputToUtcDateOnly(value)
  if (!parsed) return null
  return toPhDateInputValue(parsed) === value ? parsed : null
}

export const resolveReportYearMonth = (
  input: Partial<ReportYearMonth> = {},
  now: Date = new Date()
): ReportYearMonth => {
  const fallbackYear = getPhYear(now)
  const fallbackMonth = getPhMonthIndex(now) + 1
  const resolvedYear = isValidYear(input.year ?? NaN) ? (input.year as number) : fallbackYear
  const resolvedMonth = isValidMonth(input.month ?? NaN) ? (input.month as number) : fallbackMonth

  return {
    year: resolvedYear,
    month: resolvedMonth,
  }
}

export const toReportYearMonthKey = ({ year, month }: ReportYearMonth): string => {
  return `${String(year)}-${String(month).padStart(2, "0")}`
}

export const parseReportYearMonthKey = (value: string): ReportYearMonth | null => {
  if (!YEAR_MONTH_PATTERN.test(value)) {
    return null
  }

  const [yearText, monthText] = value.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  if (!isValidYear(year) || !isValidMonth(month)) {
    return null
  }

  return { year, month }
}

export const getPhMonthDateBoundsUtc = ({ year, month }: ReportYearMonth): { startUtcDateOnly: Date; endUtcDateOnly: Date } => {
  const resolved = resolveReportYearMonth({ year, month })
  const startUtcDateOnly = new Date(Date.UTC(resolved.year, resolved.month - 1, 1))
  const endUtcDateOnly = new Date(Date.UTC(resolved.year, resolved.month, 0))
  return { startUtcDateOnly, endUtcDateOnly }
}

export const normalizeReportDateRange = (input: {
  startDate?: string | null
  endDate?: string | null
}): NormalizeReportDateRangeResult => {
  const startDateValue = input.startDate?.trim() ?? ""
  const endDateValue = input.endDate?.trim() ?? ""
  const parsedStart = startDateValue ? parseValidatedPhDateInput(startDateValue) : null
  const parsedEnd = endDateValue ? parseValidatedPhDateInput(endDateValue) : null

  if (startDateValue && !parsedStart) {
    return { ok: false, error: "Invalid start date format." }
  }
  if (endDateValue && !parsedEnd) {
    return { ok: false, error: "Invalid end date format." }
  }

  if (parsedStart && parsedEnd && parsedStart.getTime() > parsedEnd.getTime()) {
    return { ok: false, error: "End date must not be earlier than start date." }
  }

  return {
    ok: true,
    startDateValue: startDateValue || null,
    endDateValue: endDateValue || null,
    startUtcDateOnly: parsedStart,
    endUtcDateOnly: parsedEnd,
  }
}

export const toReportDateRangeLabel = (startUtcDateOnly: Date, endUtcDateOnly: Date): string => {
  return `${toPhDateInputValue(startUtcDateOnly)} to ${toPhDateInputValue(endUtcDateOnly)}`
}
