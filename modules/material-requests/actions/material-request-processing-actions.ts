"use server"

import { revalidatePath } from "next/cache"

import {
  MaterialRequestPostingStatus,
  MaterialRequestProcessingStatus,
  MaterialRequestStatus,
  type Prisma,
} from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getMaterialRequestProcessingDetailsInputSchema,
  getMaterialRequestProcessingPageInputSchema,
  updateMaterialRequestProcessingStatusInputSchema,
  type GetMaterialRequestProcessingDetailsInput,
  type GetMaterialRequestProcessingPageInput,
  type UpdateMaterialRequestProcessingStatusInput,
} from "@/modules/material-requests/schemas/material-request-processing-actions-schema"
import type {
  MaterialRequestActionDataResult,
  MaterialRequestActionResult,
} from "@/modules/material-requests/types/material-request-action-result"
import type {
  EmployeePortalMaterialRequestProcessingDetail,
  EmployeePortalMaterialRequestProcessingPage,
} from "@/modules/material-requests/types/employee-portal-material-request-types"
import {
  getEmployeePortalMaterialRequestProcessingDetailReadModel,
  getEmployeePortalMaterialRequestProcessingPageReadModel,
} from "@/modules/material-requests/utils/employee-portal-material-request-read-models"

const createMaterialProcessingRevalidationPaths = (companyId: string): string[] => {
  return [
    `/${companyId}/employee-portal/material-request-processing`,
    `/${companyId}/employee-portal/material-request-posting`,
    `/${companyId}/employee-portal/material-requests`,
    `/${companyId}/employee-portal/material-request-approvals`,
    `/${companyId}/employee-portal/approvers`,
    `/${companyId}/dashboard`,
  ]
}

const revalidateMaterialProcessingPaths = (companyId: string): void => {
  for (const path of createMaterialProcessingRevalidationPaths(companyId)) {
    revalidatePath(path)
  }
}

const isHrRole = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

const canProcessMaterialRequests = (params: {
  role: CompanyRole
  isMaterialRequestPurchaser: boolean
}): boolean => {
  return isHrRole(params.role) || params.isMaterialRequestPurchaser
}

const getMaterialRequestPurchaserFlag = async (params: {
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
      isMaterialRequestPurchaser: true,
      isActive: true,
    },
  })

  if (!access?.isActive) {
    return false
  }

  return access.isMaterialRequestPurchaser
}

const normalizeProcessingStatus = (
  status: MaterialRequestProcessingStatus | null
): MaterialRequestProcessingStatus => {
  return status ?? MaterialRequestProcessingStatus.PENDING_PURCHASER
}

const asNullableText = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const QUANTITY_TOLERANCE = 0.0005

export async function getMaterialRequestProcessingPageAction(
  input: GetMaterialRequestProcessingPageInput
): Promise<MaterialRequestActionDataResult<EmployeePortalMaterialRequestProcessingPage>> {
  const parsed = getMaterialRequestProcessingPageInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid processing page payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const isMaterialRequestPurchaser = await getMaterialRequestPurchaserFlag({
    userId: context.userId,
    companyId: context.companyId,
  })

  if (!canProcessMaterialRequests({ role: companyRole, isMaterialRequestPurchaser })) {
    return { ok: false, error: "You are not allowed to process material requests." }
  }

  const page = await getEmployeePortalMaterialRequestProcessingPageReadModel({
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

export async function getMaterialRequestProcessingDetailsAction(
  input: GetMaterialRequestProcessingDetailsInput
): Promise<MaterialRequestActionDataResult<EmployeePortalMaterialRequestProcessingDetail>> {
  const parsed = getMaterialRequestProcessingDetailsInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid processing detail payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const isMaterialRequestPurchaser = await getMaterialRequestPurchaserFlag({
    userId: context.userId,
    companyId: context.companyId,
  })

  if (!canProcessMaterialRequests({ role: companyRole, isMaterialRequestPurchaser })) {
    return { ok: false, error: "You are not allowed to process material requests." }
  }

  const detail = await getEmployeePortalMaterialRequestProcessingDetailReadModel({
    companyId: context.companyId,
    requestId: payload.requestId,
  })

  if (!detail) {
    return { ok: false, error: "Approved material request not found." }
  }

  return {
    ok: true,
    data: detail,
  }
}

export async function updateMaterialRequestProcessingStatusAction(
  input: UpdateMaterialRequestProcessingStatusInput
): Promise<MaterialRequestActionResult> {
  const parsed = updateMaterialRequestProcessingStatusInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid processing status payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const isMaterialRequestPurchaser = await getMaterialRequestPurchaserFlag({
    userId: context.userId,
    companyId: context.companyId,
  })

  if (!canProcessMaterialRequests({ role: companyRole, isMaterialRequestPurchaser })) {
    return { ok: false, error: "You are not allowed to process material requests." }
  }

  const request = await db.materialRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      status: MaterialRequestStatus.APPROVED,
    },
    select: {
      id: true,
      requestNumber: true,
      processingStatus: true,
      processingStartedAt: true,
      processingCompletedAt: true,
      processingRemarks: true,
      postingStatus: true,
      serveBatches: {
        orderBy: [{ servedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          poNumber: true,
          supplierName: true,
          notes: true,
        },
      },
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
    return { ok: false, error: "Approved material request not found." }
  }

  const previousStatus = normalizeProcessingStatus(request.processingStatus)
  const postingStatus = request.postingStatus

  if (payload.status === MaterialRequestProcessingStatus.IN_PROGRESS) {
    if (postingStatus === MaterialRequestPostingStatus.POSTED) {
      return { ok: false, error: "Posted requests can no longer be processed." }
    }

    if (previousStatus === MaterialRequestProcessingStatus.COMPLETED) {
      return { ok: false, error: "Completed requests cannot be moved back to in progress." }
    }
  }

  if (payload.status === MaterialRequestProcessingStatus.COMPLETED) {
    if (postingStatus === MaterialRequestPostingStatus.POSTED) {
      return { ok: false, error: "This request is already posted." }
    }

    if (previousStatus === MaterialRequestProcessingStatus.PENDING_PURCHASER) {
      return { ok: false, error: "Start processing the request before marking it completed." }
    }

    if (previousStatus === MaterialRequestProcessingStatus.COMPLETED) {
      return {
        ok: true,
        message: `Material request ${request.requestNumber} is already completed.`,
      }
    }
  }

  const actedAt = new Date()
  const latestServeBatch = request.serveBatches[0] ?? null
  const remarks = asNullableText(payload.remarks) ?? request.processingRemarks
  const processingPoNumber = asNullableText(payload.processingPoNumber) ?? latestServeBatch?.poNumber ?? null
  const processingSupplierName =
    asNullableText(payload.processingSupplierName) ?? latestServeBatch?.supplierName ?? null
  const requestedQuantityByItemId = new Map<string, number>()
  const servedQuantityByItemId = new Map<string, number>()

  for (const item of request.items) {
    const requestedQuantity = Number(item.quantity)
    const servedQuantity = item.serveBatchItems.reduce((accumulator, servedEntry) => {
      return accumulator + Number(servedEntry.quantityServed)
    }, 0)

    requestedQuantityByItemId.set(item.id, requestedQuantity)
    servedQuantityByItemId.set(item.id, servedQuantity)
  }

  const batchItemsToCreate: Array<{ materialRequestItemId: string; quantityServed: number }> = []
  for (const servedItem of payload.servedItems ?? []) {
    const requestedQuantity = requestedQuantityByItemId.get(servedItem.materialRequestItemId)
    if (requestedQuantity === undefined) {
      return { ok: false, error: "One or more served items do not belong to this request." }
    }

    const alreadyServed = servedQuantityByItemId.get(servedItem.materialRequestItemId) ?? 0
    const remainingQuantity = Math.max(0, requestedQuantity - alreadyServed)

    if (servedItem.quantityServed > remainingQuantity + QUANTITY_TOLERANCE) {
      return {
        ok: false,
        error: "Served quantity cannot be greater than the remaining quantity.",
      }
    }

    batchItemsToCreate.push({
      materialRequestItemId: servedItem.materialRequestItemId,
      quantityServed: servedItem.quantityServed,
    })

    servedQuantityByItemId.set(servedItem.materialRequestItemId, alreadyServed + servedItem.quantityServed)
  }

  if (
    payload.status === MaterialRequestProcessingStatus.IN_PROGRESS &&
    batchItemsToCreate.length === 0
  ) {
    return { ok: false, error: "At least one line item quantity is required when marking request as served." }
  }

  const hasRemainingQuantities = Array.from(requestedQuantityByItemId.entries()).some(
    ([itemId, requestedQuantity]) =>
      requestedQuantity - (servedQuantityByItemId.get(itemId) ?? 0) > QUANTITY_TOLERANCE
  )

  if (payload.status === MaterialRequestProcessingStatus.COMPLETED && hasRemainingQuantities) {
    return {
      ok: false,
      error: "Cannot mark request as completed while there are remaining item quantities to serve.",
    }
  }

  const shouldCreateServeBatch = batchItemsToCreate.length > 0

  if (shouldCreateServeBatch && (!processingPoNumber || !processingSupplierName)) {
    return { ok: false, error: "PO # and supplier are required to mark request as served." }
  }

  const updateData: Prisma.MaterialRequestUpdateInput =
    payload.status === MaterialRequestProcessingStatus.IN_PROGRESS
      ? {
          processingStatus: MaterialRequestProcessingStatus.IN_PROGRESS,
          processingStartedAt: request.processingStartedAt ?? actedAt,
          processingCompletedAt: null,
          postingStatus: null,
          postingReference: null,
          postingRemarks: null,
          postedAt: null,
          postedByUser: {
            disconnect: true,
          },
          processedByUser: {
            connect: {
              id: context.userId,
            },
          },
          processingRemarks: remarks,
        }
      : {
          processingStatus: MaterialRequestProcessingStatus.COMPLETED,
          processingStartedAt: request.processingStartedAt ?? actedAt,
          processingCompletedAt: actedAt,
          postingStatus: MaterialRequestPostingStatus.PENDING_POSTING,
          postingReference: null,
          postingRemarks: null,
          postedAt: null,
          postedByUser: {
            disconnect: true,
          },
          processedByUser: {
            connect: {
              id: context.userId,
            },
          },
          processingRemarks: remarks,
        }

  await db.$transaction(async (tx) => {
    await tx.materialRequest.update({
      where: {
        id: request.id,
      },
      data: updateData,
    })

    if (shouldCreateServeBatch && processingPoNumber && processingSupplierName) {
      await tx.materialRequestServeBatch.create({
        data: {
          materialRequestId: request.id,
          poNumber: processingPoNumber,
          supplierName: processingSupplierName,
          notes: remarks,
          isFinalServe: payload.status === MaterialRequestProcessingStatus.COMPLETED,
          servedAt: actedAt,
          servedByUserId: context.userId,
          items: {
            create: batchItemsToCreate.map((batchItem) => ({
              materialRequestItemId: batchItem.materialRequestItemId,
              quantityServed: batchItem.quantityServed,
            })),
          },
        },
      })
    } else if (
      payload.status === MaterialRequestProcessingStatus.COMPLETED &&
      latestServeBatch?.id
    ) {
      await tx.materialRequestServeBatch.update({
        where: {
          id: latestServeBatch.id,
        },
        data: {
          isFinalServe: true,
        },
      })
    }

    await createAuditLog(
      {
        tableName: "MaterialRequest",
        recordId: request.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "UPDATE_MATERIAL_REQUEST_PROCESSING_STATUS",
        changes: [
          {
            fieldName: "processingStatus",
            oldValue: previousStatus,
            newValue: payload.status,
          },
          {
            fieldName: "processingRemarks",
            oldValue: request.processingRemarks,
            newValue: remarks,
          },
          ...(shouldCreateServeBatch
            ? [
                {
                  fieldName: "serveBatchPoNumber",
                  oldValue: latestServeBatch?.poNumber ?? null,
                  newValue: processingPoNumber,
                },
                {
                  fieldName: "serveBatchSupplierName",
                  oldValue: latestServeBatch?.supplierName ?? null,
                  newValue: processingSupplierName,
                },
                {
                  fieldName: "serveBatchItemsCount",
                  oldValue: null,
                  newValue: batchItemsToCreate.length,
                },
              ]
            : []),
        ],
      },
      tx
    )
  })

  revalidateMaterialProcessingPaths(context.companyId)

  return {
    ok: true,
    message:
      payload.status === MaterialRequestProcessingStatus.IN_PROGRESS
        ? previousStatus === MaterialRequestProcessingStatus.IN_PROGRESS
          ? `Material request ${request.requestNumber} updated with served quantities.`
          : `Material request ${request.requestNumber} marked as served.`
        : `Material request ${request.requestNumber} marked as completed.`,
  }
}
