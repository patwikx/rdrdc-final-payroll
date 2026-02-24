"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const updateEmployeePhotoInputSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  photoDataUrl: z.string().trim().min(1),
})

const allowedPhotoPrefixes = ["data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,"] as const
const maxPhotoBytes = 2 * 1024 * 1024

const toBase64ByteSize = (dataUrl: string): number => {
  const commaIndex = dataUrl.indexOf(",")
  if (commaIndex < 0) return 0
  const base64Payload = dataUrl.slice(commaIndex + 1)
  const padding = base64Payload.endsWith("==") ? 2 : base64Payload.endsWith("=") ? 1 : 0
  return Math.floor((base64Payload.length * 3) / 4) - padding
}

type UpdateEmployeePhotoActionResult = { ok: true; message: string; photoUrl: string } | { ok: false; error: string }
type RemoveEmployeePhotoActionResult = { ok: true; message: string } | { ok: false; error: string }

export async function updateEmployeePhotoAction(input: {
  companyId: string
  employeeId: string
  photoDataUrl: string
}): Promise<UpdateEmployeePhotoActionResult> {
  const parsed = updateEmployeePhotoInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid employee photo payload." }
  }

  const payload = parsed.data
  const normalizedPhotoDataUrl = payload.photoDataUrl.trim()
  const hasAllowedPrefix = allowedPhotoPrefixes.some((prefix) => normalizedPhotoDataUrl.startsWith(prefix))
  if (!hasAllowedPrefix) {
    return { ok: false, error: "Only JPG, PNG, and WEBP image files are allowed." }
  }

  const photoByteSize = toBase64ByteSize(normalizedPhotoDataUrl)
  if (!Number.isFinite(photoByteSize) || photoByteSize <= 0 || photoByteSize > maxPhotoBytes) {
    return { ok: false, error: "Profile photo must be 2 MB or below." }
  }

  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return { ok: false, error: "You do not have permission to update employee records in this company." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      photoUrl: true,
    },
  })

  if (!employee) {
    return { ok: false, error: "Employee record was not found in the selected company." }
  }

  await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employee.id },
      data: {
        photoUrl: normalizedPhotoDataUrl,
        updatedById: context.userId,
      },
    })

    await createAuditLog(
      {
        tableName: "Employee",
        recordId: employee.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "EMPLOYEE_PROFILE_PHOTO_UPDATED",
        changes: [
          {
            fieldName: "photoUrl",
            oldValue: employee.photoUrl ? "SET" : null,
            newValue: "SET",
          },
        ],
      },
      tx
    )
  })

  revalidatePath(`/${context.companyId}/employees`)
  revalidatePath(`/${context.companyId}/employees/${employee.id}`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return {
    ok: true,
    message: "Employee profile photo updated.",
    photoUrl: normalizedPhotoDataUrl,
  }
}

export async function removeEmployeePhotoAction(input: {
  companyId: string
  employeeId: string
}): Promise<RemoveEmployeePhotoActionResult> {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      employeeId: z.string().uuid(),
    })
    .safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid employee photo removal payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return { ok: false, error: "You do not have permission to update employee records in this company." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      photoUrl: true,
    },
  })

  if (!employee) {
    return { ok: false, error: "Employee record was not found in the selected company." }
  }

  if (!employee.photoUrl) {
    return { ok: true, message: "Employee profile photo removed." }
  }

  await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employee.id },
      data: {
        photoUrl: null,
        updatedById: context.userId,
      },
    })

    await createAuditLog(
      {
        tableName: "Employee",
        recordId: employee.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "EMPLOYEE_PROFILE_PHOTO_REMOVED",
        changes: [
          {
            fieldName: "photoUrl",
            oldValue: "SET",
            newValue: null,
          },
        ],
      },
      tx
    )
  })

  revalidatePath(`/${context.companyId}/employees`)
  revalidatePath(`/${context.companyId}/employees/${employee.id}`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return {
    ok: true,
    message: "Employee profile photo removed.",
  }
}
