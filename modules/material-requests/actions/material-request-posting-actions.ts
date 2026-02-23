"use server"

import { revalidatePath } from "next/cache"

import {
  MaterialRequestPostingStatus,
  MaterialRequestProcessingStatus,
  MaterialRequestStatus,
} from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getMaterialRequestPostingDetailsInputSchema,
  getMaterialRequestPostingPageInputSchema,
  postMaterialRequestInputSchema,
  type GetMaterialRequestPostingDetailsInput,
  type GetMaterialRequestPostingPageInput,
  type PostMaterialRequestInput,
} from "@/modules/material-requests/schemas/material-request-posting-actions-schema"
import type {
  MaterialRequestActionDataResult,
  MaterialRequestActionResult,
} from "@/modules/material-requests/types/material-request-action-result"
import type {
  EmployeePortalMaterialRequestPostingDetail,
  EmployeePortalMaterialRequestPostingPage,
} from "@/modules/material-requests/types/employee-portal-material-request-types"
import {
  getEmployeePortalMaterialRequestPostingDetailReadModel,
  getEmployeePortalMaterialRequestPostingPageReadModel,
} from "@/modules/material-requests/utils/employee-portal-material-request-read-models"

const QUANTITY_TOLERANCE = 0.0005

const createMaterialPostingRevalidationPaths = (companyId: string): string[] => {
  return [
    `/${companyId}/employee-portal/material-request-posting`,
    `/${companyId}/employee-portal/material-request-receiving-reports`,
    `/${companyId}/employee-portal/material-request-processing`,
    `/${companyId}/employee-portal/material-requests`,
    `/${companyId}/dashboard`,
  ]
}

const revalidateMaterialPostingPaths = (companyId: string): void => {
  for (const path of createMaterialPostingRevalidationPaths(companyId)) {
    revalidatePath(path)
  }
}

const isHrRole = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

const canPostMaterialRequests = (params: {
  role: CompanyRole
  isMaterialRequestPoster: boolean
}): boolean => {
  return isHrRole(params.role) || params.isMaterialRequestPoster
}

const getMaterialRequestPosterFlag = async (params: {
  userId: string
  companyId: string
}): Promise<boolean> => {
  const access = await db.userCompanyAccess.findUnique({
    where: {
      userId_companyId: {
        userId: params.userId,
        companyId: params.companyId,
      },
    },
    select: {
      isMaterialRequestPoster: true,
      isActive: true,
    },
  })

  if (!access?.isActive) {
    return false
  }

  return access.isMaterialRequestPoster
}

const asNullableText = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function getMaterialRequestPostingPageAction(
  input: GetMaterialRequestPostingPageInput
): Promise<MaterialRequestActionDataResult<EmployeePortalMaterialRequestPostingPage>> {
  const parsed = getMaterialRequestPostingPageInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid posting page payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const isMaterialRequestPoster = await getMaterialRequestPosterFlag({
    userId: context.userId,
    companyId: context.companyId,
  })

  if (!canPostMaterialRequests({ role: companyRole, isMaterialRequestPoster })) {
    return { ok: false, error: "You are not allowed to post material requests." }
  }

  const page = await getEmployeePortalMaterialRequestPostingPageReadModel({
    companyId: context.companyId,
    page: payload.page,
    pageSize: payload.pageSize,
    search: payload.search,
    status: payload.status,
    departmentId: payload.departmentId,
  })

  return {
    ok: true,
    data: page,
  }
}

export async function getMaterialRequestPostingDetailsAction(
  input: GetMaterialRequestPostingDetailsInput
): Promise<MaterialRequestActionDataResult<EmployeePortalMaterialRequestPostingDetail>> {
  const parsed = getMaterialRequestPostingDetailsInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid posting detail payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const isMaterialRequestPoster = await getMaterialRequestPosterFlag({
    userId: context.userId,
    companyId: context.companyId,
  })

  if (!canPostMaterialRequests({ role: companyRole, isMaterialRequestPoster })) {
    return { ok: false, error: "You are not allowed to post material requests." }
  }

  const detail = await getEmployeePortalMaterialRequestPostingDetailReadModel({
    companyId: context.companyId,
    requestId: payload.requestId,
  })

  if (!detail) {
    return { ok: false, error: "Completed material request not found." }
  }

  return {
    ok: true,
    data: detail,
  }
}

export async function postMaterialRequestAction(
  input: PostMaterialRequestInput
): Promise<MaterialRequestActionResult> {
  const parsed = postMaterialRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid posting payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const isMaterialRequestPoster = await getMaterialRequestPosterFlag({
    userId: context.userId,
    companyId: context.companyId,
  })

  if (!canPostMaterialRequests({ role: companyRole, isMaterialRequestPoster })) {
    return { ok: false, error: "You are not allowed to post material requests." }
  }

  const actedAt = new Date()
  const postingReference = asNullableText(payload.postingReference)
  const postingRemarks = asNullableText(payload.remarks)

  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "MaterialRequest" WHERE "id" = ${payload.requestId} FOR UPDATE`

    const request = await tx.materialRequest.findFirst({
      where: {
        id: payload.requestId,
        companyId: context.companyId,
        status: MaterialRequestStatus.APPROVED,
        processingStatus: MaterialRequestProcessingStatus.COMPLETED,
        OR: [
          {
            requiresReceiptAcknowledgment: false,
          },
          {
            requiresReceiptAcknowledgment: true,
            requesterAcknowledgedAt: {
              not: null,
            },
            receivingReports: {
              some: {},
            },
          },
        ],
      },
      select: {
        id: true,
        requestNumber: true,
        postingStatus: true,
        postingReference: true,
        postingRemarks: true,
        postedAt: true,
        postedByUserId: true,
        items: {
          select: {
            id: true,
            quantity: true,
            serveBatchItems: {
              select: {
                quantityServed: true,
              },
            },
          },
        },
      },
    })

    if (!request) {
      return { kind: "error" as const, message: "Completed material request not found." }
    }

    if (request.postingStatus === MaterialRequestPostingStatus.POSTED) {
      return { kind: "already_posted" as const, requestNumber: request.requestNumber }
    }

    const hasRemainingQuantity = request.items.some((item) => {
      const requestedQuantity = Number(item.quantity)
      const servedQuantity = item.serveBatchItems.reduce((accumulator, servedItem) => {
        return accumulator + Number(servedItem.quantityServed)
      }, 0)

      return requestedQuantity - servedQuantity > QUANTITY_TOLERANCE
    })

    if (hasRemainingQuantity) {
      return { kind: "error" as const, message: "Cannot post request while item quantities are not fully served." }
    }

    const postingUpdate = await tx.materialRequest.updateMany({
      where: {
        id: request.id,
        OR: [
          {
            postingStatus: null,
          },
          {
            postingStatus: MaterialRequestPostingStatus.PENDING_POSTING,
          },
        ],
      },
      data: {
        postingStatus: MaterialRequestPostingStatus.POSTED,
        postingReference,
        postingRemarks,
        postedAt: actedAt,
        postedByUserId: context.userId,
      },
    })

    if (postingUpdate.count !== 1) {
      return { kind: "already_posted" as const, requestNumber: request.requestNumber }
    }

    const existingPosting = await tx.materialRequestPosting.findFirst({
      where: {
        materialRequestId: request.id,
      },
      orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
      },
    })

    if (existingPosting) {
      await tx.materialRequestPosting.update({
        where: {
          id: existingPosting.id,
        },
        data: {
          postingReference: postingReference ?? "",
          remarks: postingRemarks,
          postedAt: actedAt,
          postedByUserId: context.userId,
        },
      })
    } else {
      await tx.materialRequestPosting.create({
        data: {
          materialRequestId: request.id,
          postingReference: postingReference ?? "",
          remarks: postingRemarks,
          postedAt: actedAt,
          postedByUserId: context.userId,
        },
      })
    }

    await createAuditLog(
      {
        tableName: "MaterialRequest",
        recordId: request.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "POST_MATERIAL_REQUEST",
        changes: [
          {
            fieldName: "postingStatus",
            oldValue: request.postingStatus ?? MaterialRequestPostingStatus.PENDING_POSTING,
            newValue: MaterialRequestPostingStatus.POSTED,
          },
          {
            fieldName: "postingReference",
            oldValue: request.postingReference,
            newValue: postingReference,
          },
          {
            fieldName: "postingRemarks",
            oldValue: request.postingRemarks,
            newValue: postingRemarks,
          },
          {
            fieldName: "postedAt",
            oldValue: request.postedAt,
            newValue: actedAt,
          },
          {
            fieldName: "postedByUserId",
            oldValue: request.postedByUserId,
            newValue: context.userId,
          },
        ],
      },
      tx
    )

    return { kind: "posted" as const, requestNumber: request.requestNumber }
  })

  if (outcome.kind === "error") {
    return { ok: false, error: outcome.message }
  }

  if (outcome.kind === "already_posted") {
    return {
      ok: true,
      message: `Material request ${outcome.requestNumber} is already posted.`,
    }
  }

  revalidateMaterialPostingPaths(context.companyId)

  return {
    ok: true,
    message: `Material request ${outcome.requestNumber} posted successfully.`,
  }
}
