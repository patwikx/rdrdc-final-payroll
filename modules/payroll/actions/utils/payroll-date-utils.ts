import { toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"

export const toDateKey = (value: Date): string => toPhDateInputValue(value)

export const getDayName = (value: Date): string => {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Manila",
  })
    .format(value)
    .toUpperCase()
}

export const getDateRange = (start: Date, end: Date): Date[] => {
  const cursor = toPhDateOnlyUtc(start)
  const last = toPhDateOnlyUtc(end)

  const dates: Date[] = []
  while (cursor <= last) {
    dates.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

export const toUtcDateOnly = (value: Date): Date => toPhDateOnlyUtc(value)

export const getInclusiveDayCount = (start: Date, end: Date): number => {
  const startUtc = toUtcDateOnly(start)
  const endUtc = toUtcDateOnly(end)
  if (endUtc < startUtc) {
    return 0
  }

  const diffMs = endUtc.getTime() - startUtc.getTime()
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1
}
