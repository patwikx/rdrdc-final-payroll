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

  const request = await db.materialRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      status: MaterialRequestStatus.APPROVED,
      processingStatus: MaterialRequestProcessingStatus.COMPLETED,
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
    return { ok: false, error: "Completed material request not found." }
  }

  if (request.postingStatus === MaterialRequestPostingStatus.POSTED) {
    return {
      ok: true,
      message: `Material request ${request.requestNumber} is already posted.`,
    }
  }

  const hasRemainingQuantity = request.items.some((item) => {
    const requestedQuantity = Number(item.quantity)
    const servedQuantity = item.serveBatchItems.reduce((accumulator, servedItem) => {
      return accumulator + Number(servedItem.quantityServed)
    }, 0)

    return requestedQuantity - servedQuantity > QUANTITY_TOLERANCE
  })

  if (hasRemainingQuantity) {
    return { ok: false, error: "Cannot post request while item quantities are not fully served." }
  }

  const actedAt = new Date()
  const postingReference = asNullableText(payload.postingReference)
  const postingRemarks = asNullableText(payload.remarks)

  await db.$transaction(async (tx) => {
    await tx.materialRequest.update({
      where: {
        id: request.id,
      },
      data: {
        postingStatus: MaterialRequestPostingStatus.POSTED,
        postingReference,
        postingRemarks,
        postedAt: actedAt,
        postedByUser: {
          connect: {
            id: context.userId,
          },
        },
      },
    })

    await tx.materialRequestPosting.create({
      data: {
        materialRequestId: request.id,
        postingReference: postingReference ?? "",
        remarks: postingRemarks,
        postedAt: actedAt,
        postedByUserId: context.userId,
      },
    })

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
  })

  revalidateMaterialPostingPaths(context.companyId)

  return {
    ok: true,
    message: `Material request ${request.requestNumber} posted successfully.`,
  }
}
