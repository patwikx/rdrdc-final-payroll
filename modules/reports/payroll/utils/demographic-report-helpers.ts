import { getPhDateParts } from "../../../../lib/ph-time.ts"
import type { DemographicBreakdownRow } from "../types/report-view-models"

const roundToTwo = (value: number): number => Math.round(value * 100) / 100

const toSafeToken = (value: string): string => {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
}

export const humanizeCodeLabel = (value: string | null | undefined, fallback: string): string => {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export const computeAgeInYears = (birthDate: Date | null | undefined, asOfDate: Date): number | null => {
  if (!birthDate) return null

  const birth = getPhDateParts(birthDate)
  const asOf = getPhDateParts(asOfDate)

  let years = asOf.year - birth.year
  if (asOf.month < birth.month || (asOf.month === birth.month && asOf.day < birth.day)) {
    years -= 1
  }

  return years >= 0 ? years : 0
}

export const resolveAgeBracketLabel = (ageYears: number | null): string => {
  if (ageYears === null) return "Unspecified"
  if (ageYears <= 20) return "20 and below"
  if (ageYears <= 30) return "21-30"
  if (ageYears <= 40) return "31-40"
  if (ageYears <= 50) return "41-50"
  if (ageYears <= 60) return "51-60"
  return "61 and above"
}

type BreakdownEntry = {
  key: string | null | undefined
  label: string | null | undefined
}

export const aggregateDemographicBreakdown = <TRow>(
  rows: TRow[],
  resolveEntry: (row: TRow) => BreakdownEntry,
  fallbackLabel: string
): DemographicBreakdownRow[] => {
  if (rows.length === 0) return []

  const bucketMap = new Map<string, { key: string; label: string; count: number }>()

  for (const row of rows) {
    const entry = resolveEntry(row)
    const normalizedLabel = entry.label?.trim() ? entry.label.trim() : fallbackLabel
    const normalizedKey = entry.key?.trim() ? toSafeToken(entry.key) : toSafeToken(normalizedLabel)

    const existing = bucketMap.get(normalizedKey)
    if (!existing) {
      bucketMap.set(normalizedKey, {
        key: normalizedKey,
        label: normalizedLabel,
        count: 1,
      })
      continue
    }

    existing.count += 1
  }

  const totalRows = rows.length
  const result = Array.from(bucketMap.values()).map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: bucket.count,
    percentage: roundToTwo((bucket.count / totalRows) * 100),
  }))

  return result.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.label.localeCompare(b.label)
  })
}
