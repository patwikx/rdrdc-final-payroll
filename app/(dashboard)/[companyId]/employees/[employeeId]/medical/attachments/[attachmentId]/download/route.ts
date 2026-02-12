import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { createPresignedDownloadUrl } from "@/lib/minio"
import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    companyId: string
    employeeId: string
    attachmentId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  const { companyId, employeeId, attachmentId } = await context.params
  const auditMeta = getRequestAuditMetadata(request)

  try {
    const activeCompany = await getActiveCompanyContext({ companyId })
    if (!hasModuleAccess(activeCompany.companyRole as CompanyRole, "employees")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const attachment = await db.employeeMedicalAttachment.findFirst({
      where: {
        id: attachmentId,
        medicalRecord: {
          employeeId,
          employee: {
            companyId: activeCompany.companyId,
            deletedAt: null,
          },
          isActive: true,
        },
      },
      select: {
        id: true,
        fileUrl: true,
        fileName: true,
        medicalRecordId: true,
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    if (!attachment.fileUrl.startsWith("private/")) {
      return NextResponse.json({ error: "Invalid storage path" }, { status: 400 })
    }

    const signedUrl = await createPresignedDownloadUrl(attachment.fileUrl, 60)

    await createAuditLog({
      tableName: "EmployeeMedicalAttachment",
      recordId: attachment.id,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EMPLOYEE_MEDICAL_ATTACHMENT_DOWNLOADED",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [{ fieldName: "downloadedAt", newValue: new Date() }],
    })

    return NextResponse.redirect(signedUrl, {
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Unable to generate secure download URL." }, { status: 500 })
  }
}
