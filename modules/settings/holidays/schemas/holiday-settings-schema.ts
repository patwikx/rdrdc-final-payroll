import { z } from "zod"

const trimToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const optionalText = (max: number) => z.preprocess(trimToUndefined, z.string().max(max).optional())

const optionalUuid = z.preprocess(trimToUndefined, z.string().uuid().optional())

export const HOLIDAY_TYPE_OPTIONS = [
  "REGULAR",
  "SPECIAL_NON_WORKING",
  "SPECIAL_WORKING",
  "LOCAL",
  "COMPANY",
  "ONE_TIME",
] as const

export const HOLIDAY_APPLICABILITY_OPTIONS = ["NATIONWIDE", "REGIONAL", "COMPANY"] as const

export const holidaySettingsInputSchema = z
  .object({
    companyId: z.string().uuid(),
    holidayId: optionalUuid,
    holidayDate: z.string().date(),
    name: z.string().trim().min(2).max(120),
    description: optionalText(300),
    holidayTypeCode: z.enum(HOLIDAY_TYPE_OPTIONS),
    payMultiplier: z.coerce.number().positive().max(4),
    applicability: z.enum(HOLIDAY_APPLICABILITY_OPTIONS),
    region: optionalText(80),
    isActive: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.applicability === "REGIONAL" && !value.region) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["region"],
        message: "Region is required for regional holidays.",
      })
    }
  })

export const deleteHolidayInputSchema = z.object({
  companyId: z.string().uuid(),
  holidayId: z.string().uuid(),
})

export type HolidaySettingsInput = z.infer<typeof holidaySettingsInputSchema>
export type DeleteHolidayInput = z.infer<typeof deleteHolidayInputSchema>
