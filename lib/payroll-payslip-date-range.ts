import { toPhDayEndUtcInstant, toPhDayStartUtcInstant } from "./ph-time.ts"

export type PayslipGeneratedAtRange =
  | {
      ok: true
      startDate: Date
      endDate: Date
    }
  | {
      ok: false
      error: string
    }

export const resolvePayslipGeneratedAtRange = (
  startDateInput: string | null | undefined,
  endDateInput: string | null | undefined
): PayslipGeneratedAtRange => {
  const startDate = toPhDayStartUtcInstant(startDateInput ?? "")
  const endDate = toPhDayEndUtcInstant(endDateInput ?? "")

  if (!startDate || !endDate) {
    return { ok: false, error: "Invalid startDate or endDate." }
  }

  if (startDate > endDate) {
    return { ok: false, error: "Invalid startDate or endDate." }
  }

  return { ok: true, startDate, endDate }
}
