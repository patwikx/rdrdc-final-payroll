const PH_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Manila",
})

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
