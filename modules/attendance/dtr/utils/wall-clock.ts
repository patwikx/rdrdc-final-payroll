import { parsePhDateInputToUtcDateOnly } from "@/lib/ph-time"

const PH_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Manila",
})

const ISO_HHMM_PATTERN = /^\d{2}:\d{2}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const HALF_DAY_TOKEN = "[DTR_DAY_FRACTION:HALF]"
export const DTR_LEAVE_TYPE_TOKEN_PREFIX = "[DTR_LEAVE_TYPE_ID:"

const LEGACY_HALF_DAY_MARKERS = ["[HALF_DAY]", "HALF DAY", "HALFDAY", HALF_DAY_TOKEN]
const DTR_LEAVE_TYPE_TOKEN_PATTERN = /\[DTR_LEAVE_TYPE_ID:([^\]]+)\]/i
const DTR_LEAVE_TYPE_TOKEN_GLOBAL_PATTERN = /\[DTR_LEAVE_TYPE_ID:[^\]]+\]/gi

export const toPhDateKey = (value: Date): string => PH_DATE_FORMATTER.format(value)

export const parsePhDateInput = (value: string): Date | null => parsePhDateInputToUtcDateOnly(value)

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

export const extractDtrLeaveTypeIdFromRemarks = (remarks: string | null | undefined): string | null => {
  if (!remarks) return null

  const match = remarks.match(DTR_LEAVE_TYPE_TOKEN_PATTERN)
  if (!match?.[1]) return null

  const leaveTypeId = match[1].trim()
  return UUID_PATTERN.test(leaveTypeId) ? leaveTypeId : null
}

export const normalizeDtrLeaveTypeToken = (remarks: string | null | undefined, leaveTypeId: string | null): string | null => {
  const seed = (remarks ?? "").replace(DTR_LEAVE_TYPE_TOKEN_GLOBAL_PATTERN, "").trim()
  if (!leaveTypeId) {
    return seed.length > 0 ? seed : null
  }

  const token = `${DTR_LEAVE_TYPE_TOKEN_PREFIX}${leaveTypeId}]`
  return seed.length > 0 ? `${token} ${seed}` : token
}

export const stripDtrInternalTokens = (remarks: string | null | undefined): string => {
  if (!remarks) return ""

  return remarks
    .replaceAll(HALF_DAY_TOKEN, "")
    .replace(DTR_LEAVE_TYPE_TOKEN_GLOBAL_PATTERN, "")
    .trim()
}
