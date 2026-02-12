import { z } from "zod"

const baseContextSchema = z.object({
  companyId: z.string().min(1),
  employeeId: z.string().uuid(),
})

export const createMedicalRecordInputSchema = baseContextSchema.extend({
  examYear: z.number().int().min(1900).max(2200),
  examDate: z.string().date("Please select a valid exam date."),
  examType: z.string().trim().min(1).max(40),
  clinicName: z.string().trim().max(200).optional(),
  physician: z.string().trim().max(160).optional(),
  findings: z.string().trim().max(5000).optional(),
  remarks: z.string().trim().max(5000).optional(),
  result: z.string().trim().max(40).optional(),
})

export const updateMedicalRecordInputSchema = createMedicalRecordInputSchema.extend({
  medicalRecordId: z.string().uuid(),
})

export const deleteMedicalRecordInputSchema = baseContextSchema.extend({
  medicalRecordId: z.string().uuid(),
})

export const createMedicalAttachmentUploadInputSchema = baseContextSchema.extend({
  medicalRecordId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().trim().min(1).max(120),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024),
  description: z.string().trim().max(200).optional(),
})

export const finalizeMedicalAttachmentInputSchema = createMedicalAttachmentUploadInputSchema.extend({
  objectKey: z.string().trim().min(1).max(1024),
})

export const deleteMedicalAttachmentInputSchema = baseContextSchema.extend({
  attachmentId: z.string().uuid(),
})

export type CreateMedicalRecordInput = z.infer<typeof createMedicalRecordInputSchema>
export type UpdateMedicalRecordInput = z.infer<typeof updateMedicalRecordInputSchema>
export type DeleteMedicalRecordInput = z.infer<typeof deleteMedicalRecordInputSchema>

export type CreateMedicalAttachmentUploadInput = z.infer<typeof createMedicalAttachmentUploadInputSchema>
export type FinalizeMedicalAttachmentInput = z.infer<typeof finalizeMedicalAttachmentInputSchema>
export type DeleteMedicalAttachmentInput = z.infer<typeof deleteMedicalAttachmentInputSchema>
