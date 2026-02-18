"use server"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import {
  updateEmployeeSelfServiceInputSchema,
  type UpdateEmployeeSelfServiceInput,
} from "@/modules/employee-portal/schemas/profile-actions-schema"

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

export async function updateEmployeeSelfServiceAction(input: UpdateEmployeeSelfServiceInput): Promise<ActionResult> {
  const parsed = updateEmployeeSelfServiceInputSchema.safeParse(input)
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
