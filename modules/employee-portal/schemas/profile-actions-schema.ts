import { z } from "zod"

export const updateEmployeeSelfServiceInputSchema = z.object({
  companyId: z.string().uuid(),
  email: z.string().email().optional(),
  phone: z.string().trim().min(3).max(30).optional(),
  phoneCountryCode: z.string().trim().max(8).optional(),
  address: z
    .object({
      street: z.string().trim().max(200).optional(),
      barangay: z.string().trim().max(120).optional(),
      city: z.string().trim().max(120).optional(),
      province: z.string().trim().max(120).optional(),
      postalCode: z.string().trim().max(20).optional(),
    })
    .optional(),
  emergencyContact: z
    .object({
      name: z.string().trim().max(160).optional(),
      relationshipId: z.enum(["SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"]).optional(),
      mobileNumber: z.string().trim().max(30).optional(),
    })
    .optional(),
  documents: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(180),
        fileUrl: z.string().url(),
        fileType: z.string().trim().min(2).max(20),
        fileSize: z.coerce.number().int().min(1).max(20 * 1024 * 1024).optional(),
      })
    )
    .max(10)
    .optional(),
})

export type UpdateEmployeeSelfServiceInput = z.infer<typeof updateEmployeeSelfServiceInputSchema>
