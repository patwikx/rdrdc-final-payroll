"use server"

import { revalidatePath } from "next/cache"

import {
  MaterialRequestPostingStatus,
  MaterialRequestProcessingStatus,
  MaterialRequestStatus,
  Prisma,
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
const PROCESSING_STATUS_UPDATE_MAX_RETRIES = 3

class MaterialRequestProcessingValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MaterialRequestProcessingValidationError"
  }
}

const isTransactionSerializationConflict = (error: unknown): boolean => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

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
    departmentId: payload.departmentId,
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

  const actedAt = new Date()
  let outcome:
    | {
        requestNumber: string
        previousStatus: MaterialRequestProcessingStatus
        finalStatus: MaterialRequestProcessingStatus
        autoCompletedOnServe: boolean
        alreadyCompleted: boolean
        inProgressUpdateMode: "SERVED" | "METADATA_ONLY" | "STARTED" | "NO_CHANGES" | "SERVED_AND_COMPLETED" | null
      }
    | null = null

  for (let attempt = 0; attempt < PROCESSING_STATUS_UPDATE_MAX_RETRIES; attempt += 1) {
    try {
      outcome = await db.$transaction(async (tx) => {
        // Lock the request row first so quantity and status validation is based
        // on the latest committed state for this specific request.
        await tx.$queryRaw`SELECT "id" FROM "MaterialRequest" WHERE "id" = ${payload.requestId} FOR UPDATE`

        const request = await tx.materialRequest.findFirst({
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
          throw new MaterialRequestProcessingValidationError("Approved material request not found.")
        }

        const previousStatus = normalizeProcessingStatus(request.processingStatus)
        const postingStatus = request.postingStatus

        if (payload.status === MaterialRequestProcessingStatus.IN_PROGRESS) {
          if (postingStatus === MaterialRequestPostingStatus.POSTED) {
            throw new MaterialRequestProcessingValidationError("Posted requests can no longer be processed.")
          }

          if (previousStatus === MaterialRequestProcessingStatus.COMPLETED) {
            throw new MaterialRequestProcessingValidationError(
              "Completed requests cannot be moved back to in progress."
            )
          }
        }

        if (payload.status === MaterialRequestProcessingStatus.COMPLETED) {
          if (postingStatus === MaterialRequestPostingStatus.POSTED) {
            throw new MaterialRequestProcessingValidationError("This request is already posted.")
          }

          if (previousStatus === MaterialRequestProcessingStatus.PENDING_PURCHASER) {
            throw new MaterialRequestProcessingValidationError(
              "Start processing the request before marking it completed."
            )
          }

          if (previousStatus === MaterialRequestProcessingStatus.COMPLETED) {
            return {
              requestNumber: request.requestNumber,
              previousStatus,
              finalStatus: MaterialRequestProcessingStatus.COMPLETED,
              autoCompletedOnServe: false,
              alreadyCompleted: true,
              inProgressUpdateMode: null,
            }
          }
        }

        const latestServeBatch = request.serveBatches[0] ?? null
        const incomingRemarks = asNullableText(payload.remarks)
        const incomingPoNumber = asNullableText(payload.processingPoNumber)
        const incomingSupplierName = asNullableText(payload.processingSupplierName)
        const remarks = incomingRemarks ?? request.processingRemarks
        const processingPoNumber = incomingPoNumber ?? latestServeBatch?.poNumber ?? null
        const processingSupplierName = incomingSupplierName ?? latestServeBatch?.supplierName ?? null

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
            throw new MaterialRequestProcessingValidationError(
              "One or more served items do not belong to this request."
            )
          }

          const alreadyServed = servedQuantityByItemId.get(servedItem.materialRequestItemId) ?? 0
          const remainingQuantity = Math.max(0, requestedQuantity - alreadyServed)

          if (servedItem.quantityServed > remainingQuantity + QUANTITY_TOLERANCE) {
            throw new MaterialRequestProcessingValidationError(
              "Served quantity cannot be greater than the remaining quantity."
            )
          }

          batchItemsToCreate.push({
            materialRequestItemId: servedItem.materialRequestItemId,
            quantityServed: servedItem.quantityServed,
          })

          servedQuantityByItemId.set(servedItem.materialRequestItemId, alreadyServed + servedItem.quantityServed)
        }

        const hasRemainingQuantities = Array.from(requestedQuantityByItemId.entries()).some(
          ([itemId, requestedQuantity]) =>
            requestedQuantity - (servedQuantityByItemId.get(itemId) ?? 0) > QUANTITY_TOLERANCE
        )
        const shouldAutoCompleteFromServe =
          payload.status === MaterialRequestProcessingStatus.IN_PROGRESS &&
          batchItemsToCreate.length > 0 &&
          !hasRemainingQuantities
        const finalStatus = shouldAutoCompleteFromServe
          ? MaterialRequestProcessingStatus.COMPLETED
          : payload.status

        if (payload.status === MaterialRequestProcessingStatus.COMPLETED && hasRemainingQuantities) {
          throw new MaterialRequestProcessingValidationError(
            "Cannot mark request as completed while there are remaining item quantities to serve."
          )
        }

        const shouldCreateServeBatch = batchItemsToCreate.length > 0
        const shouldUpdateLatestServeBatchMetadata =
          payload.status === MaterialRequestProcessingStatus.IN_PROGRESS &&
          !shouldCreateServeBatch &&
          latestServeBatch !== null &&
          (
            processingPoNumber !== latestServeBatch.poNumber ||
            processingSupplierName !== latestServeBatch.supplierName ||
            remarks !== latestServeBatch.notes
          )

        if (shouldCreateServeBatch && (!processingPoNumber || !processingSupplierName)) {
          throw new MaterialRequestProcessingValidationError("PO # and supplier are required to mark request as served.")
        }

        if (
          payload.status === MaterialRequestProcessingStatus.IN_PROGRESS &&
          !shouldCreateServeBatch &&
          latestServeBatch === null &&
          (incomingPoNumber !== null || incomingSupplierName !== null)
        ) {
          throw new MaterialRequestProcessingValidationError(
            "PO # and supplier can be updated only after at least one served quantity entry exists."
          )
        }

        if (
          payload.status === MaterialRequestProcessingStatus.IN_PROGRESS &&
          previousStatus === MaterialRequestProcessingStatus.IN_PROGRESS &&
          !shouldCreateServeBatch &&
          !shouldUpdateLatestServeBatchMetadata &&
          remarks === request.processingRemarks
        ) {
          return {
            requestNumber: request.requestNumber,
            previousStatus,
            finalStatus: MaterialRequestProcessingStatus.IN_PROGRESS,
            autoCompletedOnServe: false,
            alreadyCompleted: false,
            inProgressUpdateMode: "NO_CHANGES" as const,
          }
        }

        const updateData: Prisma.MaterialRequestUpdateInput =
          finalStatus === MaterialRequestProcessingStatus.IN_PROGRESS
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
              isFinalServe: finalStatus === MaterialRequestProcessingStatus.COMPLETED,
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
          shouldUpdateLatestServeBatchMetadata &&
          latestServeBatch?.id &&
          processingPoNumber &&
          processingSupplierName
        ) {
          await tx.materialRequestServeBatch.update({
            where: {
              id: latestServeBatch.id,
            },
            data: {
              poNumber: processingPoNumber,
              supplierName: processingSupplierName,
              notes: remarks,
            },
          })
        } else if (
          finalStatus === MaterialRequestProcessingStatus.COMPLETED &&
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
                newValue: finalStatus,
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
                : shouldUpdateLatestServeBatchMetadata
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
                        fieldName: "serveBatchNotes",
                        oldValue: latestServeBatch?.notes ?? null,
                        newValue: remarks,
                      },
                    ]
                  : []),
            ],
          },
          tx
        )

        return {
          requestNumber: request.requestNumber,
          previousStatus,
          finalStatus,
          autoCompletedOnServe: shouldAutoCompleteFromServe,
          alreadyCompleted: false,
          inProgressUpdateMode:
            finalStatus === MaterialRequestProcessingStatus.IN_PROGRESS
              ? shouldCreateServeBatch
                ? "SERVED"
                : previousStatus === MaterialRequestProcessingStatus.PENDING_PURCHASER
                  ? "STARTED"
                  : shouldUpdateLatestServeBatchMetadata || remarks !== request.processingRemarks
                    ? "METADATA_ONLY"
                    : "NO_CHANGES"
              : shouldAutoCompleteFromServe
                ? "SERVED_AND_COMPLETED"
              : null,
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
      break
    } catch (error) {
      if (error instanceof MaterialRequestProcessingValidationError) {
        return { ok: false, error: error.message }
      }

      if (isTransactionSerializationConflict(error) && attempt < PROCESSING_STATUS_UPDATE_MAX_RETRIES - 1) {
        continue
      }

      const message = error instanceof Error ? error.message : "Unknown error"
      return { ok: false, error: `Failed to update processing status: ${message}` }
    }
  }

  if (!outcome) {
    return { ok: false, error: "Failed to update processing status due to concurrent updates. Please retry." }
  }

  revalidateMaterialProcessingPaths(context.companyId)

  if (outcome.alreadyCompleted) {
    return {
      ok: true,
      message: `Material request ${outcome.requestNumber} is already completed.`,
    }
  }

  return {
    ok: true,
    message:
      outcome.finalStatus === MaterialRequestProcessingStatus.IN_PROGRESS
        ? outcome.inProgressUpdateMode === "SERVED"
          ? outcome.previousStatus === MaterialRequestProcessingStatus.IN_PROGRESS
            ? `Material request ${outcome.requestNumber} updated with served quantities.`
            : `Material request ${outcome.requestNumber} marked as served.`
          : outcome.inProgressUpdateMode === "STARTED"
            ? `Material request ${outcome.requestNumber} marked as in progress.`
            : outcome.inProgressUpdateMode === "METADATA_ONLY"
              ? `Material request ${outcome.requestNumber} processing details updated.`
              : `No processing changes were applied to material request ${outcome.requestNumber}.`
        : outcome.autoCompletedOnServe
          ? `Material request ${outcome.requestNumber} served quantities completed the request automatically.`
        : `Material request ${outcome.requestNumber} marked as completed.`,
  }
}
