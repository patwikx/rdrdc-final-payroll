const PH_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Manila",
})
const PH_DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type PhDateParts = {
  year: number
  month: number
  day: number
}

const parseNumberPart = (value: string | undefined): number => Number(value ?? "0")

export const getPhDateParts = (value: Date = new Date()): PhDateParts => {
  const parts = PH_DATE_PARTS_FORMATTER.formatToParts(value)
  const year = parseNumberPart(parts.find((part) => part.type === "year")?.value)
  const month = parseNumberPart(parts.find((part) => part.type === "month")?.value)
  const day = parseNumberPart(parts.find((part) => part.type === "day")?.value)

  return { year, month, day }
}

export const getPhYear = (value: Date = new Date()): number => getPhDateParts(value).year

export const getPhMonthIndex = (value: Date = new Date()): number => {
  const month = getPhDateParts(value).month
  return Math.max(0, month - 1)
}

export const toPhDateOnlyUtc = (value: Date = new Date()): Date => {
  const { year, month, day } = getPhDateParts(value)
  return new Date(Date.UTC(year, month - 1, day))
}

export const toPhDateInputValue = (value: Date | undefined): string => {
  if (!value) {
    return ""
  }

  return PH_DATE_PARTS_FORMATTER.format(value)
}

export const parsePhDateInputToUtcDateOnly = (value: string): Date | null => {
  if (!PH_DATE_INPUT_PATTERN.test(value)) {
    return null
  }

  const [year, month, day] = value.split("-").map((part) => Number(part))
  if (!year || !month || !day) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

export const parsePhDateInputToPhDate = (value: string): Date | null => {
  if (!PH_DATE_INPUT_PATTERN.test(value)) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00+08:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const toPhDayStartUtcInstant = (value: string): Date | null => {
  if (!PH_DATE_INPUT_PATTERN.test(value)) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00.000+08:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const toPhDayEndUtcInstant = (value: string): Date | null => {
  const start = toPhDayStartUtcInstant(value)
  if (!start) {
    return null
  }

  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
}
