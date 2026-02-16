import { z } from "zod"

const sharedCompanySchema = z.object({
  companyId: z.string().uuid(),
})

const deviceIdentitySchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(120),
  deviceModel: z.string().trim().min(2).max(80),
  ipAddress: z.string().trim().min(3).max(120),
  port: z.coerce.number().int().min(1).max(65535).default(4370),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(15000),
  inport: z.coerce.number().int().min(1).max(65535).optional(),
  locationName: z.string().trim().max(120).optional(),
  commKey: z.string().trim().max(128).optional(),
  clearCommKey: z.boolean().optional().default(false),
})

export const upsertBiometricDeviceInputSchema = sharedCompanySchema.extend({
  deviceId: z.string().uuid().optional(),
  ...deviceIdentitySchema.shape,
})

export const connectBiometricDeviceInputSchema = sharedCompanySchema.extend({
  deviceId: z.string().uuid(),
})

export const syncBiometricDeviceInputSchema = sharedCompanySchema
  .extend({
    deviceId: z.string().uuid(),
    dateFrom: z.string().date(),
    dateTo: z.string().date(),
  })
  .superRefine((value, ctx) => {
    const fromDate = new Date(`${value.dateFrom}T00:00:00.000+08:00`)
    const toDate = new Date(`${value.dateTo}T00:00:00.000+08:00`)
    if (toDate < fromDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "Date To must be the same day or later than Date From.",
      })
    }
  })

export const applyBiometricDeviceSyncInputSchema = sharedCompanySchema.extend({
  deviceId: z.string().uuid(),
  syncLogId: z.string().uuid(),
})

export const checkBiometricDeviceUserInputSchema = sharedCompanySchema.extend({
  deviceId: z.string().uuid(),
  employeeNumber: z.string().trim().min(1).max(40),
})

export const startBiometricDeviceEnrollmentInputSchema = sharedCompanySchema.extend({
  deviceId: z.string().uuid(),
  employeeNumber: z.string().trim().min(1).max(40),
})

export const cancelBiometricDeviceEnrollmentInputSchema = sharedCompanySchema.extend({
  deviceId: z.string().uuid(),
})

export const startBiometricEnrollmentSessionInputSchema = sharedCompanySchema.extend({
  deviceId: z.string().uuid(),
  employeeId: z.string().uuid(),
})

export const detectBiometricEnrollmentResultInputSchema = sharedCompanySchema.extend({
  deviceId: z.string().uuid(),
  sessionId: z.string().uuid(),
})

export type UpsertBiometricDeviceInput = z.infer<typeof upsertBiometricDeviceInputSchema>
export type ConnectBiometricDeviceInput = z.infer<typeof connectBiometricDeviceInputSchema>
export type SyncBiometricDeviceInput = z.infer<typeof syncBiometricDeviceInputSchema>
export type ApplyBiometricDeviceSyncInput = z.infer<typeof applyBiometricDeviceSyncInputSchema>
export type CheckBiometricDeviceUserInput = z.infer<typeof checkBiometricDeviceUserInputSchema>
export type StartBiometricDeviceEnrollmentInput = z.infer<typeof startBiometricDeviceEnrollmentInputSchema>
export type CancelBiometricDeviceEnrollmentInput = z.infer<typeof cancelBiometricDeviceEnrollmentInputSchema>
export type StartBiometricEnrollmentSessionInput = z.infer<typeof startBiometricEnrollmentSessionInputSchema>
export type DetectBiometricEnrollmentResultInput = z.infer<typeof detectBiometricEnrollmentResultInputSchema>
