const PH_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Manila",
})

const ISO_HHMM_PATTERN = /^\d{2}:\d{2}$/

export const HALF_DAY_TOKEN = "[DTR_DAY_FRACTION:HALF]"

const LEGACY_HALF_DAY_MARKERS = ["[HALF_DAY]", "HALF DAY", "HALFDAY", HALF_DAY_TOKEN]

export const toPhDateKey = (value: Date): string => PH_DATE_FORMATTER.format(value)

export const parsePhDateInput = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split("-").map((part) => Number(part))
  if (!year || !month || !day) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

export const formatWallClockTime = (value: Date | string | null | undefined): string => {
  if (!value) return ""

  const parsed = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(parsed.getTime())) return ""

  return parsed.toISOString().slice(11, 16)
}

export const formatWallClockLabel = (value: Date | string | null | undefined): string => {
  return formatWallClockTime(value) || "--:--"
}

export const createWallClockDateTime = (attendanceDate: Date, hhmm: string): Date | null => {
  if (!ISO_HHMM_PATTERN.test(hhmm)) {
    return null
  }

  const [hour, minute] = hhmm.split(":").map((part) => Number(part))
  if (hour > 23 || minute > 59) {
    return null
  }

  const [year, month, day] = toPhDateKey(attendanceDate).split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
}

export const ensureEndAfterStart = (start: Date, end: Date): Date => {
  if (end > start) {
    return end
  }

  const normalized = new Date(end)
  normalized.setUTCDate(normalized.getUTCDate() + 1)
  return normalized
}

export const isHalfDayRemarks = (remarks: string | null | undefined): boolean => {
  if (!remarks) return false

  const normalized = remarks.toUpperCase()
  return LEGACY_HALF_DAY_MARKERS.some((marker) => normalized.includes(marker))
}

export const normalizeHalfDayToken = (remarks: string | null | undefined, dayFraction: "FULL" | "HALF"): string | null => {
  const seed = (remarks ?? "").replaceAll(HALF_DAY_TOKEN, "").trim()
  if (dayFraction === "HALF") {
    return seed.length > 0 ? `${HALF_DAY_TOKEN} ${seed}` : HALF_DAY_TOKEN
  }

  return seed.length > 0 ? seed : null
}
