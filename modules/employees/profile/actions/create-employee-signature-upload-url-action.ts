"use server"

import { randomUUID } from "node:crypto"

import { z } from "zod"

import { db } from "@/lib/db"
import { createPresignedUploadUrl } from "@/lib/minio"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const createEmployeeSignatureUploadInputSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  fileType: z.string().trim().min(1).max(120),
  fileSize: z.number().int().positive().max(2 * 1024 * 1024),
})

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"])

const sanitizeFileName = (fileName: string): string => {
  const normalized = fileName.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-")
  return normalized.replace(/^-|-$/g, "").slice(0, 120) || "employee-signature"
}

const buildEmployeeSignatureObjectKey = (companyId: string, employeeId: string, fileName: string): string => {
  const timestamp = Date.now()
  const token = randomUUID()
  const safeFileName = sanitizeFileName(fileName)
  return `private/companies/${companyId}/employees/${employeeId}/signature/${timestamp}-${token}-${safeFileName}`
}

type CreateEmployeeSignatureUploadResult =
  | {
      ok: true
      uploadUrl: string
      objectKey: string
      expiresInSeconds: number
      requiredHeaders: { "Content-Type": string }
    }
  | { ok: false; error: string }

export async function createEmployeeSignatureUploadUrlAction(input: {
  companyId: string
  employeeId: string
  fileName: string
  fileType: string
  fileSize: number
}): Promise<CreateEmployeeSignatureUploadResult> {
  const parsed = createEmployeeSignatureUploadInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid signature upload input." }
  }

  const payload = parsed.data
  if (!allowedMimeTypes.has(payload.fileType)) {
    return { ok: false, error: "Only JPG, PNG, and WEBP image files are allowed for signatures." }
  }

  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return { ok: false, error: "You do not have permission to update employee records." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
      deletedAt: null,
    },
    select: { id: true },
  })

  if (!employee) {
    return { ok: false, error: "Employee record was not found in the selected company." }
  }

  const objectKey = buildEmployeeSignatureObjectKey(context.companyId, employee.id, payload.fileName)

  try {
    const expiresInSeconds = 300
    const uploadUrl = await createPresignedUploadUrl(objectKey, expiresInSeconds)
    return {
      ok: true,
      uploadUrl,
      objectKey,
      expiresInSeconds,
      requiredHeaders: {
        "Content-Type": payload.fileType,
      },
    }
  } catch {
    return { ok: false, error: "Storage upload is not configured. Please set MinIO environment variables." }
  }
}

