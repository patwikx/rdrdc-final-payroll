"use server"

import { z } from "zod"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const inputSchema = z.object({
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

type UpdateProfileInput = z.infer<typeof inputSchema>

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

export async function updateEmployeeSelfServiceAction(input: UpdateProfileInput): Promise<ActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const employee = await db.employee.findFirst({
    where: {
      userId: context.userId,
      companyId: context.companyId,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  })

  if (!employee) {
    return { ok: false, error: "Employee profile not found for this company." }
  }

  await db.$transaction(async (tx) => {
    const auditChanges: Array<{ fieldName: string; oldValue?: unknown; newValue?: unknown }> = []

    if (payload.email) {
      const existingPrimaryEmail = await tx.employeeEmail.findFirst({
        where: { employeeId: employee.id, isPrimary: true },
        select: { id: true, email: true },
      })

      if (existingPrimaryEmail) {
        await tx.employeeEmail.update({
          where: { id: existingPrimaryEmail.id },
          data: { email: payload.email, emailTypeId: "PERSONAL", isActive: true },
        })
        auditChanges.push({ fieldName: "primaryEmail", oldValue: existingPrimaryEmail.email, newValue: payload.email })
      } else {
        await tx.employeeEmail.create({
          data: {
            employeeId: employee.id,
            emailTypeId: "PERSONAL",
            email: payload.email,
            isPrimary: true,
            isActive: true,
          },
        })
        auditChanges.push({ fieldName: "primaryEmail", oldValue: null, newValue: payload.email })
      }
    }

    if (payload.phone) {
      const existingPrimaryContact = await tx.employeeContact.findFirst({
        where: { employeeId: employee.id, isPrimary: true },
        select: { id: true, countryCode: true, number: true },
      })

      if (existingPrimaryContact) {
        await tx.employeeContact.update({
          where: { id: existingPrimaryContact.id },
          data: {
            contactTypeId: "MOBILE",
            countryCode: payload.phoneCountryCode || "+63",
            number: payload.phone,
            isActive: true,
          },
        })
        auditChanges.push({
          fieldName: "primaryPhone",
          oldValue: `${existingPrimaryContact.countryCode ?? ""} ${existingPrimaryContact.number}`.trim(),
          newValue: `${payload.phoneCountryCode || "+63"} ${payload.phone}`.trim(),
        })
      } else {
        await tx.employeeContact.create({
          data: {
            employeeId: employee.id,
            contactTypeId: "MOBILE",
            countryCode: payload.phoneCountryCode || "+63",
            number: payload.phone,
            isPrimary: true,
            isActive: true,
          },
        })
        auditChanges.push({ fieldName: "primaryPhone", oldValue: null, newValue: `${payload.phoneCountryCode || "+63"} ${payload.phone}`.trim() })
      }
    }

    if (payload.address) {
      const existingPrimaryAddress = await tx.employeeAddress.findFirst({
        where: { employeeId: employee.id, isPrimary: true },
        select: { id: true, street: true, barangay: true, city: true, province: true, postalCode: true },
      })

      if (existingPrimaryAddress) {
        await tx.employeeAddress.update({
          where: { id: existingPrimaryAddress.id },
          data: {
            street: payload.address.street || null,
            barangay: payload.address.barangay || null,
            city: payload.address.city || null,
            province: payload.address.province || null,
            postalCode: payload.address.postalCode || null,
            isActive: true,
          },
        })
        auditChanges.push({
          fieldName: "primaryAddress",
          oldValue: [
            existingPrimaryAddress.street,
            existingPrimaryAddress.barangay,
            existingPrimaryAddress.city,
            existingPrimaryAddress.province,
            existingPrimaryAddress.postalCode,
          ]
            .filter(Boolean)
            .join(", "),
          newValue: [
            payload.address.street,
            payload.address.barangay,
            payload.address.city,
            payload.address.province,
            payload.address.postalCode,
          ]
            .filter(Boolean)
            .join(", "),
        })
      } else {
        await tx.employeeAddress.create({
          data: {
            employeeId: employee.id,
            addressTypeId: "HOME",
            street: payload.address.street || null,
            barangay: payload.address.barangay || null,
            city: payload.address.city || null,
            province: payload.address.province || null,
            postalCode: payload.address.postalCode || null,
            isPrimary: true,
            isActive: true,
          },
        })
        auditChanges.push({
          fieldName: "primaryAddress",
          oldValue: null,
          newValue: [
            payload.address.street,
            payload.address.barangay,
            payload.address.city,
            payload.address.province,
            payload.address.postalCode,
          ]
            .filter(Boolean)
            .join(", "),
        })
      }
    }

    if (payload.emergencyContact && payload.emergencyContact.name) {
      const existingEmergency = await tx.employeeEmergencyContact.findFirst({
        where: { employeeId: employee.id, priority: 1 },
        select: { id: true, name: true, relationshipId: true, mobileNumber: true },
      })

      if (existingEmergency) {
        await tx.employeeEmergencyContact.update({
          where: { id: existingEmergency.id },
          data: {
            name: payload.emergencyContact.name,
            relationshipId: payload.emergencyContact.relationshipId || "OTHER",
            mobileNumber: payload.emergencyContact.mobileNumber || null,
            isActive: true,
          },
        })
        auditChanges.push({
          fieldName: "primaryEmergencyContact",
          oldValue: `${existingEmergency.name} (${existingEmergency.relationshipId}) ${existingEmergency.mobileNumber ?? ""}`.trim(),
          newValue: `${payload.emergencyContact.name} (${payload.emergencyContact.relationshipId || "OTHER"}) ${payload.emergencyContact.mobileNumber || ""}`.trim(),
        })
      } else {
        await tx.employeeEmergencyContact.create({
          data: {
            employeeId: employee.id,
            name: payload.emergencyContact.name,
            relationshipId: payload.emergencyContact.relationshipId || "OTHER",
            mobileNumber: payload.emergencyContact.mobileNumber || null,
            priority: 1,
            isActive: true,
          },
        })
        auditChanges.push({
          fieldName: "primaryEmergencyContact",
          oldValue: null,
          newValue: `${payload.emergencyContact.name} (${payload.emergencyContact.relationshipId || "OTHER"}) ${payload.emergencyContact.mobileNumber || ""}`.trim(),
        })
      }
    }

    if (payload.documents && payload.documents.length > 0) {
      for (const document of payload.documents) {
        if (document.id) {
          const existingDoc = await tx.employeeDocument.findFirst({
            where: { id: document.id, employeeId: employee.id, isActive: true },
            select: { id: true, title: true, fileUrl: true, fileType: true, fileSize: true },
          })

          if (!existingDoc) {
            continue
          }

          await tx.employeeDocument.update({
            where: { id: document.id },
            data: {
              title: document.title,
              fileUrl: document.fileUrl,
              fileType: document.fileType,
              fileSize: document.fileSize ?? existingDoc.fileSize,
            },
          })

          auditChanges.push({
            fieldName: "documentUpdate",
            oldValue: { id: existingDoc.id, title: existingDoc.title, fileUrl: existingDoc.fileUrl, fileType: existingDoc.fileType },
            newValue: { id: existingDoc.id, title: document.title, fileUrl: document.fileUrl, fileType: document.fileType },
          })

          continue
        }

        const normalizedFileName = document.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")

        const created = await tx.employeeDocument.create({
          data: {
            employeeId: employee.id,
            documentTypeId: "OTHER",
            title: document.title,
            fileName: normalizedFileName || `document-${Date.now()}`,
            fileUrl: document.fileUrl,
            fileType: document.fileType,
            fileSize: document.fileSize ?? 1,
            isActive: true,
            createdById: context.userId,
            uploadedById: context.userId,
          },
          select: { id: true, title: true, fileUrl: true, fileType: true },
        })

        auditChanges.push({
          fieldName: "documentCreate",
          oldValue: null,
          newValue: created,
        })
      }
    }

    if (auditChanges.length > 0) {
      await createAuditLog(
        {
          tableName: "Employee",
          recordId: employee.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_SELF_SERVICE_PROFILE_UPDATE",
          changes: auditChanges,
        },
        tx
      )
    }
  })

  return { ok: true, message: "Profile information updated." }
}
