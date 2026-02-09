import { z } from "zod"

export const leaveYearSchema = z
  .number()
  .int()
  .min(2000)
  .max(9999)

export const leaveDateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
})
