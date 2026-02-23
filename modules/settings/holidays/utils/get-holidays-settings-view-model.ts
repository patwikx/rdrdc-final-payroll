import { getPhYear, parsePhDateInputToUtcDateOnly, toPhDateInputValue, toPhDateOnlyUtc } from "@/lib/ph-time"
import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { HolidaySettingsInput } from "@/modules/settings/holidays/schemas/holiday-settings-schema"

export type HolidaySettingsRow = {
  id: string
  holidayDate: string
  holidayDateLabel: string
  name: string
  description: string | null
  holidayTypeCode: HolidaySettingsInput["holidayTypeCode"]
  payMultiplier: number
  applicability: HolidaySettingsInput["applicability"]
  region: string | null
  isActive: boolean
  isPast: boolean
}

export type HolidaysSettingsViewModel = {
  companyName: string
  companyCode: string
  companyRole: string
  selectedYear: number
  availableYears: number[]
  holidays: HolidaySettingsRow[]
}

const normalizeSelectedYear = (value: number | undefined, fallbackYear: number): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallbackYear
  }

  if (value < 2000 || value > 2100) {
    return fallbackYear
  }

  return value
}

const toYearDateRange = (year: number): { startDate: Date; endExclusiveDate: Date } => {
  const startDate = parsePhDateInputToUtcDateOnly(`${String(year)}-01-01`)
  const endExclusiveDate = parsePhDateInputToUtcDateOnly(`${String(year + 1)}-01-01`)

  if (!startDate || !endExclusiveDate) {
    throw new Error(`Invalid year: ${String(year)}`)
  }

  return { startDate, endExclusiveDate }
}

const holidayDateLabelFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

export async function getHolidaysSettingsViewModel(
  companyId: string,
  selectedYear?: number
): Promise<HolidaysSettingsViewModel> {
  const context = await getActiveCompanyContext({ companyId })
  const currentPhYear = getPhYear(new Date())
  const todayPhDateOnly = toPhDateOnlyUtc()
  const resolvedYear = normalizeSelectedYear(selectedYear, currentPhYear)
  const { startDate, endExclusiveDate } = toYearDateRange(resolvedYear)

  const [holidaysRaw, holidayDateRows, payPeriodYearRows] = await Promise.all([
    db.holiday.findMany({
      where: {
        companyId: context.companyId,
        holidayDate: {
          gte: startDate,
          lt: endExclusiveDate,
        },
      },
      orderBy: [{ holidayDate: "asc" }, { name: "asc" }],
      select: {
        id: true,
        holidayDate: true,
        name: true,
        description: true,
        holidayTypeCode: true,
        payMultiplier: true,
        applicability: true,
        region: true,
        isActive: true,
      },
    }),
    db.holiday.findMany({
      where: {
        companyId: context.companyId,
      },
      select: {
        holidayDate: true,
      },
    }),
    db.payPeriod.groupBy({
      by: ["year"],
      where: {
        pattern: {
          companyId: context.companyId,
        },
      },
      orderBy: {
        year: "asc",
      },
    }),
  ])

  const availableYears = Array.from(
    new Set([
      resolvedYear,
      currentPhYear,
      ...holidayDateRows.map((item) => getPhYear(item.holidayDate)),
      ...payPeriodYearRows.map((item) => item.year),
    ])
  ).sort((a, b) => a - b)

  const holidays: HolidaySettingsRow[] = holidaysRaw.map((item) => ({
    id: item.id,
    holidayDate: toPhDateInputValue(item.holidayDate),
    holidayDateLabel: holidayDateLabelFormatter.format(item.holidayDate),
    name: item.name,
    description: item.description,
    holidayTypeCode: item.holidayTypeCode,
    payMultiplier: Number(item.payMultiplier),
    applicability: item.applicability as HolidaySettingsInput["applicability"],
    region: item.region,
    isActive: item.isActive,
    isPast: item.holidayDate.getTime() < todayPhDateOnly.getTime(),
  }))

  return {
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    selectedYear: resolvedYear,
    availableYears,
    holidays,
  }
}
