import { z } from "zod"

export const overtimeDateInputSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const overtimeTimeInputSchema = z.string().regex(/^\d{2}:\d{2}$/)
