"use server"

import { z } from "zod"

import { createPresignedUploadUrl } from "@/lib/minio"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const createCompanyLogoUploadInputSchema = z.object({
  companyId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  fileType: z.string().trim().min(1).max(120),
})

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"])

const sanitizeFileName = (fileName: string): string => {
  const normalized = fileName.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-")
  return normalized.replace(/^-|-$/g, "").slice(0, 120) || "company-logo"
}

const buildCompanyLogoObjectKey = (companyId: string, fileName: string): string => {
  const timestamp = Date.now()
  const randomId = crypto.randomUUID()
  const safeFileName = sanitizeFileName(fileName)
  return `private/companies/${companyId}/logos/${timestamp}-${randomId}-${safeFileName}`
}

type CreateCompanyLogoUploadResult =
  | {
      ok: true
      uploadUrl: string
      objectKey: string
      expiresInSeconds: number
      requiredHeaders: { "Content-Type": string }
    }
  | { ok: false; error: string }

export async function createCompanyLogoUploadUrlAction(input: {
  companyId: string
  fileName: string
  fileType: string
}): Promise<CreateCompanyLogoUploadResult> {
  const parsed = createCompanyLogoUploadInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid upload input." }
  }

  const payload = parsed.data
  if (!allowedMimeTypes.has(payload.fileType)) {
    return { ok: false, error: "Only JPG, PNG, WEBP, GIF, and SVG image files are allowed." }
  }

  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to update company settings." }
  }

  const objectKey = buildCompanyLogoObjectKey(context.companyId, payload.fileName)

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

