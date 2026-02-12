"use server"

import { randomUUID } from "node:crypto"
import path from "node:path"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createPresignedUploadUrl, deleteObjectFromPrivateBucket } from "@/lib/minio"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  createMedicalAttachmentUploadInputSchema,
  createMedicalRecordInputSchema,
  deleteMedicalAttachmentInputSchema,
  deleteMedicalRecordInputSchema,
  finalizeMedicalAttachmentInputSchema,
  type CreateMedicalAttachmentUploadInput,
  type CreateMedicalRecordInput,
  type DeleteMedicalAttachmentInput,
  type DeleteMedicalRecordInput,
  type FinalizeMedicalAttachmentInput,
  type UpdateMedicalRecordInput,
  updateMedicalRecordInputSchema,
} from "@/modules/employees/profile/schemas/medical-crud-schema"

type ActionResult = { ok: true; message: string } | { ok: false; error: string }
type MedicalRecordActionResult =
  | { ok: true; message: string; medicalRecordId: string }
  | { ok: false; error: string }
type UploadUrlResult =
  | {
      ok: true
      uploadUrl: string
      objectKey: string
      expiresInSeconds: number
      requiredHeaders: Record<string, string>
    }
  | { ok: false; error: string }

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
])

const toNullable = (value: string | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const parsePhDate = (value: string | undefined): Date | null => {
  if (!value) return null
  const normalized = value.trim()
  if (normalized.length === 0) return null
  const [year, month, day] = normalized.split("-").map((part) => Number(part))
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

const revalidateEmployeeProfilePaths = (companyId: string, employeeId: string) => {
  revalidatePath(`/${companyId}/employees`)
  revalidatePath(`/${companyId}/employees/${employeeId}`)
}

const validateContextAndAccess = async (companyId: string): Promise<{ companyId: string; userId: string } | null> => {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return null
  }
  return { companyId: context.companyId, userId: context.userId }
}

const ensureEmployeeInCompany = async (employeeId: string, companyId: string) => {
  return db.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { id: true },
  })
}

const toSafeFileExtension = (fileName: string): string => {
  const raw = path.extname(fileName).toLowerCase()
  const normalized = raw.replace(/[^.a-z0-9]/g, "")
  if (normalized.length > 0 && normalized.length <= 8) {
    return normalized
  }
  return ".bin"
}

const buildMedicalAttachmentObjectKey = (companyId: string, employeeId: string, medicalRecordId: string, fileName: string): string => {
  const extension = toSafeFileExtension(fileName)
  const token = randomUUID()
  return `private/companies/${companyId}/employees/${employeeId}/medical/${medicalRecordId}/${token}${extension}`
}

export async function createMedicalRecordAction(input: CreateMedicalRecordInput): Promise<MedicalRecordActionResult> {
  const parsed = createMedicalRecordInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid medical record input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  const examDate = parsePhDate(payload.examDate)
  if (!examDate) return { ok: false, error: "Please select a valid exam date." }

  try {
    const createdRecord = await db.$transaction(async (tx) => {
      const created = await tx.employeeMedicalRecord.create({
        data: {
          employeeId: employee.id,
          examYear: payload.examYear,
          examDate,
          examType: payload.examType,
          clinicName: toNullable(payload.clinicName),
          physician: toNullable(payload.physician),
          findings: toNullable(payload.findings),
          remarks: toNullable(payload.remarks),
          result: toNullable(payload.result),
          isActive: true,
          createdById: context.userId,
        },
      })

      await createAuditLog(
        {
          tableName: "EmployeeMedicalRecord",
          recordId: created.id,
          action: "CREATE",
          userId: context.userId,
          reason: "EMPLOYEE_MEDICAL_RECORD_CREATED",
        },
        tx
      )
      return created
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Annual physical exam record added.", medicalRecordId: createdRecord.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.includes("employeeId_examYear")) {
      return { ok: false, error: "A medical record for this exam year already exists." }
    }
    return { ok: false, error: "Unable to add medical record right now. Please try again." }
  }
}

export async function updateMedicalRecordAction(input: UpdateMedicalRecordInput): Promise<MedicalRecordActionResult> {
  const parsed = updateMedicalRecordInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid medical record input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  const examDate = parsePhDate(payload.examDate)
  if (!examDate) return { ok: false, error: "Please select a valid exam date." }

  try {
    const updatedRecord = await db.$transaction(async (tx) => {
      const existing = await tx.employeeMedicalRecord.findFirst({
        where: { id: payload.medicalRecordId, employeeId: employee.id, isActive: true },
        select: { id: true },
      })
      if (!existing) throw new Error("MEDICAL_RECORD_NOT_FOUND")

      const updated = await tx.employeeMedicalRecord.update({
        where: { id: existing.id },
        data: {
          examYear: payload.examYear,
          examDate,
          examType: payload.examType,
          clinicName: toNullable(payload.clinicName),
          physician: toNullable(payload.physician),
          findings: toNullable(payload.findings),
          remarks: toNullable(payload.remarks),
          result: toNullable(payload.result),
        },
      })

      await createAuditLog(
        {
          tableName: "EmployeeMedicalRecord",
          recordId: existing.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_MEDICAL_RECORD_UPDATED",
        },
        tx
      )
      return updated
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Annual physical exam record updated.", medicalRecordId: updatedRecord.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message === "MEDICAL_RECORD_NOT_FOUND") {
      return { ok: false, error: "Medical record was not found." }
    }
    if (message.includes("employeeId_examYear")) {
      return { ok: false, error: "A medical record for this exam year already exists." }
    }
    return { ok: false, error: "Unable to update medical record right now. Please try again." }
  }
}

export async function deleteMedicalRecordAction(input: DeleteMedicalRecordInput): Promise<ActionResult> {
  const parsed = deleteMedicalRecordInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid medical record delete request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const existing = await tx.employeeMedicalRecord.findFirst({
      where: { id: payload.medicalRecordId, employeeId: employee.id, isActive: true },
      select: {
        id: true,
        attachments: {
          select: { id: true, fileUrl: true },
        },
      },
    })
    if (!existing) throw new Error("MEDICAL_RECORD_NOT_FOUND")

    await tx.employeeMedicalRecord.update({
      where: { id: existing.id },
      data: { isActive: false },
    })

    for (const attachment of existing.attachments) {
      if (attachment.fileUrl.startsWith("private/")) {
        await deleteObjectFromPrivateBucket(attachment.fileUrl).catch(() => undefined)
      }
    }

    await createAuditLog(
      {
        tableName: "EmployeeMedicalRecord",
        recordId: existing.id,
        action: "DELETE",
        userId: context.userId,
        reason: "EMPLOYEE_MEDICAL_RECORD_DELETED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Annual physical exam record deleted." }
}

export async function createMedicalAttachmentUploadUrlAction(input: CreateMedicalAttachmentUploadInput): Promise<UploadUrlResult> {
  const parsed = createMedicalAttachmentUploadInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid medical attachment input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  if (!allowedMimeTypes.has(payload.fileType)) {
    return { ok: false, error: "File type not allowed. Upload PDF, JPG, PNG, or WEBP only." }
  }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  const record = await db.employeeMedicalRecord.findFirst({
    where: {
      id: payload.medicalRecordId,
      employeeId: employee.id,
      isActive: true,
    },
    select: { id: true },
  })

  if (!record) {
    return { ok: false, error: "Medical record was not found." }
  }

  const objectKey = buildMedicalAttachmentObjectKey(context.companyId, employee.id, record.id, payload.fileName)

  try {
    const uploadUrl = await createPresignedUploadUrl(objectKey, 300)
    return {
      ok: true,
      uploadUrl,
      objectKey,
      expiresInSeconds: 300,
      requiredHeaders: {
        "Content-Type": payload.fileType,
      },
    }
  } catch {
    return { ok: false, error: "Storage upload is not configured. Please set MinIO environment variables." }
  }
}

export async function finalizeMedicalAttachmentAction(input: FinalizeMedicalAttachmentInput): Promise<ActionResult> {
  const parsed = finalizeMedicalAttachmentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid medical attachment finalize request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  const objectPrefix = `private/companies/${context.companyId}/employees/${employee.id}/medical/${payload.medicalRecordId}/`
  if (!payload.objectKey.startsWith(objectPrefix)) {
    return { ok: false, error: "Invalid storage object key." }
  }

  await db.$transaction(async (tx) => {
    const record = await tx.employeeMedicalRecord.findFirst({
      where: {
        id: payload.medicalRecordId,
        employeeId: employee.id,
        isActive: true,
      },
      select: { id: true },
    })
    if (!record) throw new Error("MEDICAL_RECORD_NOT_FOUND")

    const created = await tx.employeeMedicalAttachment.create({
      data: {
        medicalRecordId: record.id,
        fileName: payload.fileName,
        fileUrl: payload.objectKey,
        fileType: payload.fileType,
        fileSize: payload.fileSize,
        description: toNullable(payload.description),
        uploadedById: context.userId,
      },
    })

    await createAuditLog(
      {
        tableName: "EmployeeMedicalAttachment",
        recordId: created.id,
        action: "CREATE",
        userId: context.userId,
        reason: "EMPLOYEE_MEDICAL_ATTACHMENT_CREATED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Medical attachment uploaded." }
}

export async function deleteMedicalAttachmentAction(input: DeleteMedicalAttachmentInput): Promise<ActionResult> {
  const parsed = deleteMedicalAttachmentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid medical attachment delete request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const attachment = await tx.employeeMedicalAttachment.findFirst({
      where: {
        id: payload.attachmentId,
        medicalRecord: {
          employeeId: employee.id,
          isActive: true,
        },
      },
      select: { id: true, fileUrl: true },
    })

    if (!attachment) throw new Error("MEDICAL_ATTACHMENT_NOT_FOUND")

    await tx.employeeMedicalAttachment.delete({ where: { id: attachment.id } })

    if (attachment.fileUrl.startsWith("private/")) {
      await deleteObjectFromPrivateBucket(attachment.fileUrl).catch(() => undefined)
    }

    await createAuditLog(
      {
        tableName: "EmployeeMedicalAttachment",
        recordId: attachment.id,
        action: "DELETE",
        userId: context.userId,
        reason: "EMPLOYEE_MEDICAL_ATTACHMENT_DELETED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Medical attachment deleted." }
}
