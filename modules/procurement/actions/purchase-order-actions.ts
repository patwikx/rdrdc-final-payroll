"use server"

import { Prisma, PurchaseOrderStatus, PurchaseRequestStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly } from "@/lib/ph-time"
import {
  hasEmployeePortalCapability,
  type EmployeePortalCapability,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"
import { getEmployeePortalCapabilityContext } from "@/modules/employee-portal/utils/employee-portal-capability-context"
import {
  cancelPurchaseOrderInputSchema,
  closePurchaseOrderInputSchema,
  closePurchaseOrderLineInputSchema,
  createPurchaseOrderGoodsReceiptInputSchema,
  createPurchaseOrderInputSchema,
  openPurchaseOrderInputSchema,
  type CancelPurchaseOrderInput,
  type ClosePurchaseOrderInput,
  type ClosePurchaseOrderLineInput,
  type CreatePurchaseOrderGoodsReceiptInput,
  type CreatePurchaseOrderInput,
  type OpenPurchaseOrderInput,
} from "@/modules/procurement/schemas/purchase-order-actions-schema"
import type {
  ProcurementActionDataResult,
  ProcurementActionResult,
} from "@/modules/procurement/types/procurement-action-result"
import type {
  PurchaseOrderDetail,
  PurchaseOrderGoodsReceiptDetail,
} from "@/modules/procurement/types/purchase-order-types"
import {
  getPurchaseOrderById,
  getPurchaseOrderGoodsReceiptById,
  getPurchaseOrderGoodsReceiptWorkspaceData,
  getPurchaseOrderWorkspaceData,
} from "@/modules/procurement/utils/purchase-order-read-models"

const PURCHASE_ORDER_NUMBER_PREFIX = "PO-"
const PURCHASE_ORDER_NUMBER_PATTERN = /^PO-(\d{6})$/
const PO_NUMBER_SEQUENCE_DIGITS = 6
const CREATE_PO_MAX_RETRIES = 3
const PURCHASE_ORDER_GOODS_RECEIPT_PREFIX = "GRPO-"
const PURCHASE_ORDER_GOODS_RECEIPT_PATTERN = /^GRPO-(\d{6})$/
const GRPO_NUMBER_SEQUENCE_DIGITS = 6
const CREATE_GRPO_MAX_RETRIES = 3
const QUANTITY_TOLERANCE = 0.0001
const ACTIVE_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.OPEN,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
  PurchaseOrderStatus.FULLY_RECEIVED,
  PurchaseOrderStatus.CLOSED,
]

const parsePoNumberSequence = (poNumber: string): number => {
  const match = PURCHASE_ORDER_NUMBER_PATTERN.exec(poNumber)
  if (!match) {
    return 0
  }

  const parsed = Number(match[1] ?? "")
  return Number.isFinite(parsed) ? parsed : 0
}

const parseGoodsReceiptPoNumberSequence = (grpoNumber: string): number => {
  const match = PURCHASE_ORDER_GOODS_RECEIPT_PATTERN.exec(grpoNumber)
  if (!match) {
    return 0
  }

  const parsed = Number(match[1] ?? "")
  return Number.isFinite(parsed) ? parsed : 0
}

const revalidatePurchaseOrderPaths = (companyId: string): void => {
  revalidatePath(`/${companyId}/employee-portal/purchase-orders`)
  revalidatePath(`/${companyId}/employee-portal/goods-receipt-pos`)
  revalidatePath(`/${companyId}/employee-portal/purchase-requests`)
  revalidatePath(`/${companyId}/employee-portal`)
}

const revalidatePurchaseOrderDetailPath = (companyId: string, purchaseOrderId: string): void => {
  revalidatePath(`/${companyId}/employee-portal/purchase-orders/${purchaseOrderId}`)
}

const revalidateGoodsReceiptPoDetailPath = (companyId: string, goodsReceiptId: string): void => {
  revalidatePath(`/${companyId}/employee-portal/goods-receipt-pos/${goodsReceiptId}`)
}

const ensurePurchaseOrderAccess = async (params: {
  companyId: string
  capability: EmployeePortalCapability
  errorMessage: string
}): Promise<
  | {
      ok: true
      context: Awaited<ReturnType<typeof getEmployeePortalCapabilityContext>>["activeCompany"]
    }
  | {
      ok: false
      error: string
    }
> => {
  const access = await getEmployeePortalCapabilityContext(params.companyId)

  if (!hasEmployeePortalCapability(access.capabilities, params.capability)) {
    return { ok: false, error: params.errorMessage }
  }

  return {
    ok: true,
    context: access.activeCompany,
  }
}

const asNullableText = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const isConflictError = (error: unknown): boolean => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

const toCurrency = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 100) / 100
}

const toQuantity = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(Math.max(0, value) * 1000) / 1000
}

const derivePurchaseOrderStatusFromLineStates = (
  lines: Array<{ quantityOrdered: number; quantityReceived: number; isShortClosed: boolean }>
): PurchaseOrderStatus => {
  let hasReceivableLines = false
  let hasReceivedLines = false
  let hasShortClosedBalance = false

  for (const line of lines) {
    const quantityOrdered = toQuantity(line.quantityOrdered)
    const quantityReceived = toQuantity(line.quantityReceived)
    const quantityRemaining = toQuantity(quantityOrdered - quantityReceived)

    if (quantityReceived > QUANTITY_TOLERANCE) {
      hasReceivedLines = true
    }

    if (quantityRemaining > QUANTITY_TOLERANCE) {
      if (line.isShortClosed) {
        hasShortClosedBalance = true
      } else {
        hasReceivableLines = true
      }
    }
  }

  if (hasReceivableLines) {
    return hasReceivedLines ? PurchaseOrderStatus.PARTIALLY_RECEIVED : PurchaseOrderStatus.OPEN
  }

  if (hasShortClosedBalance) {
    return PurchaseOrderStatus.CLOSED
  }

  return PurchaseOrderStatus.FULLY_RECEIVED
}

const createPurchaseOrderNumberCandidate = async (companyId: string, offset: number): Promise<string> => {
  const existingPoNumbers = await db.purchaseOrder.findMany({
    where: {
      companyId,
      poNumber: {
        startsWith: PURCHASE_ORDER_NUMBER_PREFIX,
      },
    },
    select: {
      poNumber: true,
    },
  })

  const nextSequence =
    existingPoNumbers.reduce((maxSequence, order) => {
      return Math.max(maxSequence, parsePoNumberSequence(order.poNumber))
    }, 0) +
    1 +
    offset
  return `${PURCHASE_ORDER_NUMBER_PREFIX}${String(nextSequence).padStart(PO_NUMBER_SEQUENCE_DIGITS, "0")}`
}

const createPurchaseOrderGoodsReceiptNumberCandidate = async (
  companyId: string,
  offset: number
): Promise<string> => {
  const existingNumbers = await db.purchaseOrderGoodsReceipt.findMany({
    where: {
      companyId,
      grpoNumber: {
        startsWith: PURCHASE_ORDER_GOODS_RECEIPT_PREFIX,
      },
    },
    select: {
      grpoNumber: true,
    },
  })

  const nextSequence =
    existingNumbers.reduce((maxSequence, receipt) => {
      return Math.max(maxSequence, parseGoodsReceiptPoNumberSequence(receipt.grpoNumber))
    }, 0) +
    1 +
    offset

  return `${PURCHASE_ORDER_GOODS_RECEIPT_PREFIX}${String(nextSequence).padStart(GRPO_NUMBER_SEQUENCE_DIGITS, "0")}`
}

export async function getPurchaseOrderWorkspaceAction(input: {
  companyId: string
}): Promise<ProcurementActionDataResult<Awaited<ReturnType<typeof getPurchaseOrderWorkspaceData>>>> {
  const access = await ensurePurchaseOrderAccess({
    companyId: input.companyId,
    capability: "purchase_orders.manage",
    errorMessage: "You are not allowed to manage purchase orders.",
  })
  if (!access.ok) {
    return access
  }

  const data = await getPurchaseOrderWorkspaceData({
    companyId: access.context.companyId,
  })

  return {
    ok: true,
    data,
  }
}

export async function getPurchaseOrderDetailAction(input: {
  companyId: string
  purchaseOrderId: string
}): Promise<ProcurementActionDataResult<PurchaseOrderDetail>> {
  const access = await ensurePurchaseOrderAccess({
    companyId: input.companyId,
    capability: "purchase_orders.manage",
    errorMessage: "You are not allowed to manage purchase orders.",
  })
  if (!access.ok) {
    return access
  }

  const detail = await getPurchaseOrderById({
    companyId: access.context.companyId,
    purchaseOrderId: input.purchaseOrderId,
  })

  if (!detail) {
    return { ok: false, error: "Purchase order not found." }
  }

  return {
    ok: true,
    data: detail,
  }
}

export async function getPurchaseOrderGoodsReceiptWorkspaceAction(input: {
  companyId: string
}): Promise<ProcurementActionDataResult<Awaited<ReturnType<typeof getPurchaseOrderGoodsReceiptWorkspaceData>>>> {
  const access = await ensurePurchaseOrderAccess({
    companyId: input.companyId,
    capability: "goods_receipt_pos.manage",
    errorMessage: "You are not allowed to manage Goods Receipt POs.",
  })
  if (!access.ok) {
    return access
  }

  const data = await getPurchaseOrderGoodsReceiptWorkspaceData({
    companyId: access.context.companyId,
  })

  return {
    ok: true,
    data,
  }
}

export async function getPurchaseOrderGoodsReceiptDetailAction(input: {
  companyId: string
  goodsReceiptId: string
}): Promise<ProcurementActionDataResult<PurchaseOrderGoodsReceiptDetail>> {
  const access = await ensurePurchaseOrderAccess({
    companyId: input.companyId,
    capability: "goods_receipt_pos.manage",
    errorMessage: "You are not allowed to manage Goods Receipt POs.",
  })
  if (!access.ok) {
    return access
  }

  const detail = await getPurchaseOrderGoodsReceiptById({
    companyId: access.context.companyId,
    goodsReceiptId: input.goodsReceiptId,
  })

  if (!detail) {
    return { ok: false, error: "Goods Receipt PO not found." }
  }

  return {
    ok: true,
    data: detail,
  }
}

export async function getNextPurchaseOrderNumberPreview(companyId: string): Promise<string> {
  return createPurchaseOrderNumberCandidate(companyId, 0)
}

export async function getNextPurchaseOrderGoodsReceiptNumberPreview(companyId: string): Promise<string> {
  return createPurchaseOrderGoodsReceiptNumberCandidate(companyId, 0)
}

export async function createPurchaseOrderAction(
  input: CreatePurchaseOrderInput
): Promise<ProcurementActionResult> {
  const parsed = createPurchaseOrderInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid purchase order payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseOrderAccess({
    companyId: payload.companyId,
    capability: "purchase_orders.manage",
    errorMessage: "You are not allowed to manage purchase orders.",
  })
  if (!access.ok) {
    return access
  }

  const expectedDeliveryDate = payload.expectedDeliveryDate
    ? parsePhDateInputToUtcDateOnly(payload.expectedDeliveryDate)
    : null
  if (payload.expectedDeliveryDate && !expectedDeliveryDate) {
    return { ok: false, error: "Invalid expected delivery date." }
  }

  for (let attempt = 0; attempt < CREATE_PO_MAX_RETRIES; attempt += 1) {
    try {
      const poNumber = await createPurchaseOrderNumberCandidate(access.context.companyId, attempt)
      const outcome = await db.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "PurchaseRequest"
          WHERE "id" = ${payload.sourceRequestId}
            AND "companyId" = ${access.context.companyId}
            AND "status" = ${PurchaseRequestStatus.APPROVED}
          FOR UPDATE
        `

        const request = await tx.purchaseRequest.findFirst({
          where: {
            id: payload.sourceRequestId,
            companyId: access.context.companyId,
            status: PurchaseRequestStatus.APPROVED,
          },
          select: {
            id: true,
            requestNumber: true,
            items: {
              select: {
                id: true,
                itemCode: true,
                description: true,
                uom: true,
                quantity: true,
                purchaseOrderLines: {
                  where: {
                    purchaseOrder: {
                      status: {
                        in: ACTIVE_PURCHASE_ORDER_STATUSES,
                      },
                    },
                  },
                  select: {
                    quantityOrdered: true,
                  },
                },
              },
            },
          },
        })

        if (!request) {
          return { kind: "error" as const, message: "Approved purchase request not found." }
        }

        const requestItemById = new Map(request.items.map((item) => [item.id, item]))
        const usedItemIds = new Set<string>()
        const normalizedLines = payload.lines.map((line, index) => {
          const sourceItem = requestItemById.get(line.sourcePurchaseRequestItemId)
          if (!sourceItem) {
            throw new Error("A selected line item does not belong to the source request.")
          }

          if (usedItemIds.has(sourceItem.id)) {
            throw new Error("Duplicate line item is not allowed.")
          }
          usedItemIds.add(sourceItem.id)

          const requestedQuantity = Number(sourceItem.quantity)
          const allocatedQuantity = toQuantity(
            sourceItem.purchaseOrderLines.reduce((sum, allocatedLine) => sum + Number(allocatedLine.quantityOrdered), 0)
          )
          const remainingQuantity = toQuantity(requestedQuantity - allocatedQuantity)
          const quantityOrdered = toQuantity(line.quantityOrdered)

          if (quantityOrdered <= QUANTITY_TOLERANCE) {
            throw new Error("Ordered quantity must be greater than zero.")
          }

          if (quantityOrdered - remainingQuantity > QUANTITY_TOLERANCE) {
            const label = sourceItem.itemCode?.trim() || sourceItem.description
            throw new Error(`Ordered quantity exceeds remaining allocable quantity for item ${label}.`)
          }

          const unitPrice = Number(line.unitPrice)
          const lineTotal = toCurrency(quantityOrdered * unitPrice)

          return {
            sourcePurchaseRequestItemId: sourceItem.id,
            lineNumber: index + 1,
            itemCode: sourceItem.itemCode,
            description: sourceItem.description,
            uom: sourceItem.uom,
            quantityOrdered,
            unitPrice,
            lineTotal,
            remarks: asNullableText(line.remarks),
          }
        })

        const freight = 0
        const subTotal = toCurrency(normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0))
        const discount = toCurrency(payload.discount)
        const taxableBase = toCurrency(subTotal - discount)
        if (taxableBase < 0) {
          return { kind: "error" as const, message: "Discount must not exceed the subtotal amount." }
        }

        const vatAmount = payload.applyVat ? toCurrency(taxableBase * 0.12) : 0
        const grandTotal = toCurrency(taxableBase + vatAmount + freight)
        const purchaseOrderDate = new Date()
        const status = payload.saveAsDraft ? PurchaseOrderStatus.DRAFT : PurchaseOrderStatus.OPEN
        const issuedAt = status === PurchaseOrderStatus.OPEN ? new Date() : null

        const created = await tx.purchaseOrder.create({
          data: {
            companyId: access.context.companyId,
            sourcePurchaseRequestId: request.id,
            poNumber,
            status,
            supplierName: payload.supplierName.trim(),
            paymentTerms: payload.paymentTerms.trim(),
            applyVat: payload.applyVat,
            vatAmount: new Prisma.Decimal(vatAmount),
            discount: new Prisma.Decimal(discount),
            remarks: asNullableText(payload.remarks),
            purchaseOrderDate,
            expectedDeliveryDate,
            issuedAt,
            freight: new Prisma.Decimal(freight),
            subtotal: new Prisma.Decimal(subTotal),
            grandTotal: new Prisma.Decimal(grandTotal),
            createdByUserId: access.context.userId,
            lines: {
              create: normalizedLines.map((line) => ({
                sourcePurchaseRequestItemId: line.sourcePurchaseRequestItemId,
                lineNumber: line.lineNumber,
                itemCode: line.itemCode,
                description: line.description,
                uom: line.uom,
                quantityOrdered: new Prisma.Decimal(line.quantityOrdered),
                quantityReceived: new Prisma.Decimal(0),
                unitPrice: new Prisma.Decimal(line.unitPrice),
                lineTotal: new Prisma.Decimal(line.lineTotal),
                remarks: line.remarks,
              })),
            },
          },
          select: {
            id: true,
            poNumber: true,
          },
        })

        return { kind: "success" as const, created }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })

      if (outcome.kind === "error") {
        return { ok: false, error: outcome.message }
      }

      revalidatePurchaseOrderPaths(access.context.companyId)
      revalidatePurchaseOrderDetailPath(access.context.companyId, outcome.created.id)
      return {
        ok: true,
        message: payload.saveAsDraft
          ? `Purchase order ${outcome.created.poNumber} saved as draft.`
          : `Purchase order ${outcome.created.poNumber} created and opened.`,
        purchaseOrderId: outcome.created.id,
      }
    } catch (error) {
      console.error("[createPurchaseOrderAction] Failed to create purchase order", {
        attempt,
        companyId: access.context.companyId,
        sourceRequestId: payload.sourceRequestId,
        supplierName: payload.supplierName,
        paymentTerms: payload.paymentTerms,
        applyVat: payload.applyVat,
        discount: payload.discount,
        lineCount: payload.lines.length,
        lines: payload.lines.map((line) => ({
          sourcePurchaseRequestItemId: line.sourcePurchaseRequestItemId,
          quantityOrdered: line.quantityOrdered,
          unitPrice: line.unitPrice,
        })),
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Failed to create purchase order.",
        errorCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
        errorMeta: error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      })

      if (error instanceof Error && !(isConflictError(error))) {
        return { ok: false, error: error.message }
      }

      if (!isConflictError(error) || attempt === CREATE_PO_MAX_RETRIES - 1) {
        const message = error instanceof Error ? error.message : "Failed to create purchase order."
        return { ok: false, error: message }
      }
    }
  }

  return { ok: false, error: "Failed to create purchase order." }
}

export async function createPurchaseOrderGoodsReceiptAction(
  input: CreatePurchaseOrderGoodsReceiptInput
): Promise<ProcurementActionResult> {
  const parsed = createPurchaseOrderGoodsReceiptInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid goods receipt payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseOrderAccess({
    companyId: payload.companyId,
    capability: "goods_receipt_pos.manage",
    errorMessage: "You are not allowed to manage Goods Receipt POs.",
  })
  if (!access.ok) {
    return access
  }

  const receivedAt = parsePhDateInputToUtcDateOnly(payload.receivedAt)
  if (!receivedAt) {
    return { ok: false, error: "Invalid received date." }
  }

  for (let attempt = 0; attempt < CREATE_GRPO_MAX_RETRIES; attempt += 1) {
    try {
      const outcome = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${payload.purchaseOrderId} FOR UPDATE`

        const purchaseOrder = await tx.purchaseOrder.findFirst({
          where: {
            id: payload.purchaseOrderId,
            companyId: access.context.companyId,
            status: {
              in: [PurchaseOrderStatus.OPEN, PurchaseOrderStatus.PARTIALLY_RECEIVED],
            },
          },
          select: {
            id: true,
            poNumber: true,
            status: true,
            applyVat: true,
            subtotal: true,
            discount: true,
            vatAmount: true,
            freight: true,
            lines: {
              orderBy: [{ lineNumber: "asc" }],
              select: {
                id: true,
                lineNumber: true,
                itemCode: true,
                description: true,
                uom: true,
                quantityOrdered: true,
                quantityReceived: true,
                isShortClosed: true,
                unitPrice: true,
                lineTotal: true,
                remarks: true,
              },
            },
            goodsReceipts: {
              select: {
                id: true,
                subtotal: true,
                discount: true,
                vatAmount: true,
              },
            },
          },
        })

        if (!purchaseOrder) {
          return { kind: "error" as const, message: "Open purchase order not found." }
        }

        const receivedByLineId = new Map(payload.lines.map((line) => [line.purchaseOrderLineId, toQuantity(line.receivedQuantity)]))

        for (const [purchaseOrderLineId, receivedQuantity] of receivedByLineId.entries()) {
          if (receivedQuantity <= QUANTITY_TOLERANCE) {
            continue
          }

          const matchingLine = purchaseOrder.lines.find((line) => line.id === purchaseOrderLineId)
          if (!matchingLine) {
            throw new Error("Received line does not belong to the selected purchase order.")
          }

          const quantityRemaining = toQuantity(Number(matchingLine.quantityOrdered) - Number(matchingLine.quantityReceived))
          if (matchingLine.isShortClosed || quantityRemaining <= QUANTITY_TOLERANCE) {
            throw new Error(`Line ${matchingLine.lineNumber}: line is already closed for receiving.`)
          }
        }

        const normalizedLines = purchaseOrder.lines
          .map((line) => {
            if (line.isShortClosed) {
              return null
            }

            const requestedReceiveQuantity = receivedByLineId.get(line.id) ?? 0
            const quantityOrdered = Number(line.quantityOrdered)
            const quantityReceived = Number(line.quantityReceived)
            const quantityRemaining = toQuantity(quantityOrdered - quantityReceived)

            if (requestedReceiveQuantity < 0) {
              throw new Error(`Line ${line.lineNumber}: received quantity cannot be negative.`)
            }

            if (requestedReceiveQuantity - quantityRemaining > QUANTITY_TOLERANCE) {
              throw new Error(`Line ${line.lineNumber}: received quantity exceeds the remaining PO quantity.`)
            }

            if (requestedReceiveQuantity <= QUANTITY_TOLERANCE) {
              return null
            }

            const lineTotal = toCurrency(requestedReceiveQuantity * Number(line.unitPrice))
            const remainingAfterReceipt = toQuantity(quantityRemaining - requestedReceiveQuantity)

            return {
              purchaseOrderLineId: line.id,
              lineNumber: line.lineNumber,
              itemCode: line.itemCode,
              description: line.description,
              uom: line.uom,
              quantityOrdered,
              previouslyReceivedQuantity: quantityReceived,
              receivedQuantity: requestedReceiveQuantity,
              remainingQuantity: remainingAfterReceipt,
              unitPrice: Number(line.unitPrice),
              lineTotal,
              remarks: line.remarks,
            }
          })
          .filter((line): line is NonNullable<typeof line> => line !== null)

        if (normalizedLines.length === 0) {
          return { kind: "error" as const, message: "Enter at least one received quantity greater than zero." }
        }

        const receiptSubtotal = toCurrency(normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0))
        const existingReceiptDiscount = toCurrency(
          purchaseOrder.goodsReceipts.reduce((sum, receipt) => sum + Number(receipt.discount), 0)
        )
        const existingReceiptVat = toCurrency(
          purchaseOrder.goodsReceipts.reduce((sum, receipt) => sum + Number(receipt.vatAmount), 0)
        )
        const purchaseOrderSubtotal = Number(purchaseOrder.subtotal)
        const purchaseOrderDiscount = Number(purchaseOrder.discount)

        const nextLineStates = purchaseOrder.lines.map((line) => {
          const incomingQuantity = normalizedLines.find((item) => item.purchaseOrderLineId === line.id)?.receivedQuantity ?? 0
          return {
            quantityOrdered: Number(line.quantityOrdered),
            quantityReceived: toQuantity(Number(line.quantityReceived) + incomingQuantity),
            isShortClosed: line.isShortClosed,
          }
        })
        const nextPurchaseOrderStatus = derivePurchaseOrderStatusFromLineStates(nextLineStates)
        const willBeFullyReceived = nextPurchaseOrderStatus === PurchaseOrderStatus.FULLY_RECEIVED

        const receiptDiscount = willBeFullyReceived
          ? toCurrency(Math.max(0, purchaseOrderDiscount - existingReceiptDiscount))
          : purchaseOrderSubtotal > 0
            ? toCurrency((purchaseOrderDiscount * receiptSubtotal) / purchaseOrderSubtotal)
            : 0
        const taxableBase = toCurrency(Math.max(0, receiptSubtotal - receiptDiscount))
        const receiptVat = purchaseOrder.applyVat
          ? willBeFullyReceived
            ? toCurrency(Math.max(0, Number(purchaseOrder.vatAmount) - existingReceiptVat))
            : toCurrency(taxableBase * 0.12)
          : 0
        const receiptGrandTotal = toCurrency(taxableBase + receiptVat)

        const grpoNumber = await createPurchaseOrderGoodsReceiptNumberCandidate(access.context.companyId, attempt)

        const createdReceipt = await tx.purchaseOrderGoodsReceipt.create({
          data: {
            companyId: access.context.companyId,
            purchaseOrderId: purchaseOrder.id,
            grpoNumber,
            receivedAt,
            remarks: asNullableText(payload.remarks),
            subtotal: new Prisma.Decimal(receiptSubtotal),
            vatAmount: new Prisma.Decimal(receiptVat),
            discount: new Prisma.Decimal(receiptDiscount),
            grandTotal: new Prisma.Decimal(receiptGrandTotal),
            receivedByUserId: access.context.userId,
            lines: {
              create: normalizedLines.map((line) => ({
                purchaseOrderLineId: line.purchaseOrderLineId,
                lineNumber: line.lineNumber,
                itemCode: line.itemCode,
                description: line.description,
                uom: line.uom,
                quantityOrdered: new Prisma.Decimal(line.quantityOrdered),
                previouslyReceivedQuantity: new Prisma.Decimal(line.previouslyReceivedQuantity),
                receivedQuantity: new Prisma.Decimal(line.receivedQuantity),
                remainingQuantity: new Prisma.Decimal(line.remainingQuantity),
                unitPrice: new Prisma.Decimal(line.unitPrice),
                lineTotal: new Prisma.Decimal(line.lineTotal),
                remarks: line.remarks,
              })),
            },
          },
          select: {
            id: true,
            grpoNumber: true,
          },
        })

        for (const line of normalizedLines) {
          await tx.purchaseOrderLine.update({
            where: {
              id: line.purchaseOrderLineId,
            },
            data: {
              quantityReceived: {
                increment: new Prisma.Decimal(line.receivedQuantity),
              },
            },
          })
        }

        await tx.purchaseOrder.update({
          where: {
            id: purchaseOrder.id,
          },
          data: {
            status: nextPurchaseOrderStatus,
            closedAt: nextPurchaseOrderStatus === PurchaseOrderStatus.CLOSED ? new Date() : null,
          },
        })

        return {
          kind: "success" as const,
          goodsReceiptId: createdReceipt.id,
          grpoNumber: createdReceipt.grpoNumber,
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })

      if (outcome.kind === "error") {
        return { ok: false, error: outcome.message }
      }

      revalidatePurchaseOrderPaths(access.context.companyId)
      revalidatePurchaseOrderDetailPath(access.context.companyId, payload.purchaseOrderId)
      revalidateGoodsReceiptPoDetailPath(access.context.companyId, outcome.goodsReceiptId)

      return {
        ok: true,
        message: `Goods Receipt PO ${outcome.grpoNumber} created.`,
        goodsReceiptId: outcome.goodsReceiptId,
      }
    } catch (error) {
      if (!isConflictError(error) || attempt === CREATE_GRPO_MAX_RETRIES - 1) {
        const message = error instanceof Error ? error.message : "Failed to create Goods Receipt PO."
        return { ok: false, error: message }
      }
    }
  }

  return { ok: false, error: "Failed to create Goods Receipt PO." }
}

const transitionPurchaseOrderStatus = async (params: {
  input: OpenPurchaseOrderInput | ClosePurchaseOrderInput | CancelPurchaseOrderInput
  toStatus: PurchaseOrderStatus
  allowedCurrentStatuses: PurchaseOrderStatus[]
  timestampField: "closedAt" | "cancelledAt"
  allowWhenNoGoodsReceiptOnly?: boolean
  messageTemplate: (poNumber: string) => string
}): Promise<ProcurementActionResult> => {
  const access = await ensurePurchaseOrderAccess({
    companyId: params.input.companyId,
    capability: "purchase_orders.manage",
    errorMessage: "You are not allowed to manage purchase orders.",
  })
  if (!access.ok) {
    return access
  }

  const order = await db.purchaseOrder.findFirst({
    where: {
      id: params.input.purchaseOrderId,
      companyId: access.context.companyId,
    },
    select: {
      id: true,
      poNumber: true,
      status: true,
      _count: {
        select: {
          goodsReceipts: true,
        },
      },
      lines: {
        select: {
          quantityOrdered: true,
          quantityReceived: true,
          isShortClosed: true,
        },
      },
    },
  })

  if (!order) {
    return { ok: false, error: "Purchase order not found." }
  }

  if (!params.allowedCurrentStatuses.includes(order.status)) {
    return {
      ok: false,
      error: `Cannot move purchase order from ${order.status} to ${params.toStatus}.`,
    }
  }

  if (params.toStatus === PurchaseOrderStatus.CLOSED) {
    const hasReceivableLines = order.lines.some((line) => {
      const quantityRemaining = toQuantity(Number(line.quantityOrdered) - Number(line.quantityReceived))
      return !line.isShortClosed && quantityRemaining > QUANTITY_TOLERANCE
    })

    if (hasReceivableLines) {
      return {
        ok: false,
        error: "Close remaining quantities per line with reason before closing this purchase order.",
      }
    }
  }

  if (params.allowWhenNoGoodsReceiptOnly && order._count.goodsReceipts > 0) {
    return {
      ok: false,
      error: "Cannot cancel purchase order after Goods Receipt PO has already been posted.",
    }
  }

  await db.purchaseOrder.update({
    where: {
      id: order.id,
    },
    data: {
      status: params.toStatus,
      [params.timestampField]: new Date(),
    },
  })

  revalidatePurchaseOrderPaths(access.context.companyId)
  revalidatePurchaseOrderDetailPath(access.context.companyId, order.id)
  return { ok: true, message: params.messageTemplate(order.poNumber) }
}

export async function openPurchaseOrderAction(input: OpenPurchaseOrderInput): Promise<ProcurementActionResult> {
  const parsed = openPurchaseOrderInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid open payload." }
  }

  const access = await ensurePurchaseOrderAccess({
    companyId: parsed.data.companyId,
    capability: "purchase_orders.manage",
    errorMessage: "You are not allowed to manage purchase orders.",
  })
  if (!access.ok) {
    return access
  }

  const order = await db.purchaseOrder.findFirst({
    where: {
      id: parsed.data.purchaseOrderId,
      companyId: access.context.companyId,
    },
    select: {
      id: true,
      poNumber: true,
      status: true,
    },
  })

  if (!order) {
    return { ok: false, error: "Purchase order not found." }
  }

  if (order.status !== PurchaseOrderStatus.DRAFT) {
    return { ok: false, error: "Only draft purchase orders can be opened." }
  }

  await db.purchaseOrder.update({
    where: {
      id: order.id,
    },
    data: {
      status: PurchaseOrderStatus.OPEN,
      issuedAt: new Date(),
      cancelledAt: null,
      closedAt: null,
    },
  })

  revalidatePurchaseOrderPaths(access.context.companyId)
  revalidatePurchaseOrderDetailPath(access.context.companyId, order.id)
  return { ok: true, message: `${order.poNumber} opened.` }
}

export async function closePurchaseOrderLineAction(input: ClosePurchaseOrderLineInput): Promise<ProcurementActionResult> {
  const parsed = closePurchaseOrderLineInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid close-line payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseOrderAccess({
    companyId: payload.companyId,
    capability: "purchase_orders.manage",
    errorMessage: "You are not allowed to manage purchase orders.",
  })
  if (!access.ok) {
    return access
  }

  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "PurchaseOrderLine"
      WHERE "id" = ${payload.purchaseOrderLineId}
      FOR UPDATE
    `

    const line = await tx.purchaseOrderLine.findFirst({
      where: {
        id: payload.purchaseOrderLineId,
        purchaseOrder: {
          companyId: access.context.companyId,
        },
      },
      select: {
        id: true,
        lineNumber: true,
        quantityOrdered: true,
        quantityReceived: true,
        isShortClosed: true,
        purchaseOrderId: true,
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            status: true,
          },
        },
      },
    })

    if (!line) {
      return { kind: "error" as const, message: "Purchase order line not found." }
    }

    if (
      line.purchaseOrder.status !== PurchaseOrderStatus.OPEN &&
      line.purchaseOrder.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      return {
        kind: "error" as const,
        message: `Cannot short-close lines while PO is ${line.purchaseOrder.status}.`,
      }
    }

    if (line.isShortClosed) {
      return { kind: "error" as const, message: "This purchase order line is already short-closed." }
    }

    const quantityRemaining = toQuantity(Number(line.quantityOrdered) - Number(line.quantityReceived))
    if (quantityRemaining <= QUANTITY_TOLERANCE) {
      return { kind: "error" as const, message: "This purchase order line is already fully received." }
    }

    await tx.$queryRaw`
      SELECT "id"
      FROM "PurchaseOrder"
      WHERE "id" = ${line.purchaseOrderId}
      FOR UPDATE
    `

    await tx.purchaseOrderLine.update({
      where: {
        id: line.id,
      },
      data: {
        isShortClosed: true,
        shortClosedQuantity: new Prisma.Decimal(quantityRemaining),
        shortClosedReason: payload.reason.trim(),
        shortClosedAt: new Date(),
        shortClosedByUserId: access.context.userId,
      },
    })

    const lines = await tx.purchaseOrderLine.findMany({
      where: {
        purchaseOrderId: line.purchaseOrderId,
      },
      select: {
        quantityOrdered: true,
        quantityReceived: true,
        isShortClosed: true,
      },
    })

    const nextStatus = derivePurchaseOrderStatusFromLineStates(
      lines.map((item) => ({
        quantityOrdered: Number(item.quantityOrdered),
        quantityReceived: Number(item.quantityReceived),
        isShortClosed: item.isShortClosed,
      }))
    )

    await tx.purchaseOrder.update({
      where: {
        id: line.purchaseOrderId,
      },
      data: {
        status: nextStatus,
        closedAt: nextStatus === PurchaseOrderStatus.CLOSED ? new Date() : null,
      },
    })

    return {
      kind: "success" as const,
      purchaseOrderId: line.purchaseOrderId,
      poNumber: line.purchaseOrder.poNumber,
      lineNumber: line.lineNumber,
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })

  if (outcome.kind === "error") {
    return { ok: false, error: outcome.message }
  }

  revalidatePurchaseOrderPaths(access.context.companyId)
  revalidatePurchaseOrderDetailPath(access.context.companyId, outcome.purchaseOrderId)
  return { ok: true, message: `${outcome.poNumber} line ${outcome.lineNumber} short-closed.` }
}

export async function closePurchaseOrderAction(input: ClosePurchaseOrderInput): Promise<ProcurementActionResult> {
  const parsed = closePurchaseOrderInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid close payload." }
  }

  return transitionPurchaseOrderStatus({
    input: parsed.data,
    toStatus: PurchaseOrderStatus.CLOSED,
    allowedCurrentStatuses: [
      PurchaseOrderStatus.OPEN,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
      PurchaseOrderStatus.FULLY_RECEIVED,
    ],
    timestampField: "closedAt",
    messageTemplate: (poNumber) => `${poNumber} closed.`,
  })
}

export async function cancelPurchaseOrderAction(input: CancelPurchaseOrderInput): Promise<ProcurementActionResult> {
  const parsed = cancelPurchaseOrderInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid cancel payload." }
  }

  return transitionPurchaseOrderStatus({
    input: parsed.data,
    toStatus: PurchaseOrderStatus.CANCELLED,
    allowedCurrentStatuses: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.OPEN],
    timestampField: "cancelledAt",
    allowWhenNoGoodsReceiptOnly: true,
    messageTemplate: (poNumber) => `${poNumber} cancelled.`,
  })
}
