import { PurchaseOrderStatus, PurchaseRequestStatus } from "@prisma/client"

import { db } from "@/lib/db"
import type {
  PurchaseOrderDetail,
  PurchaseOrderGoodsReceiptDetail,
  PurchaseOrderGoodsReceiptSourceOrderOption,
  PurchaseOrderGoodsReceiptWorkspaceRow,
  PurchaseOrderSourceRequestOption,
  PurchaseOrderWorkspaceRow,
} from "@/modules/procurement/types/purchase-order-types"

const dateLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const dateTimeLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Manila",
})

const ACTIVE_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.OPEN,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
  PurchaseOrderStatus.FULLY_RECEIVED,
  PurchaseOrderStatus.CLOSED,
]
const QUANTITY_TOLERANCE = 0.0001

const formatDateTime = (value: Date | null): string | null => {
  if (!value) {
    return null
  }

  return dateTimeLabel.format(value)
}

const toNumber = (value: { toNumber(): number } | null): number => {
  if (!value) {
    return 0
  }

  return value.toNumber()
}

const toCurrency = (value: number): number => Math.round(Math.max(0, value) * 100) / 100

const toQuantity = (value: number): number => Math.round(Math.max(0, value) * 1000) / 1000

const hasReceivableBalance = (line: {
  quantityOrdered: { toNumber(): number } | number
  quantityReceived: { toNumber(): number } | number
  isShortClosed: boolean
}): boolean => {
  const quantityOrdered = typeof line.quantityOrdered === "number" ? line.quantityOrdered : toNumber(line.quantityOrdered)
  const quantityReceived = typeof line.quantityReceived === "number" ? line.quantityReceived : toNumber(line.quantityReceived)
  const remaining = toQuantity(quantityOrdered - quantityReceived)
  return !line.isShortClosed && remaining > QUANTITY_TOLERANCE
}

const resolveSourceRequesterDisplay = (params: {
  requesterEmployee?:
    | {
        firstName: string
        lastName: string
        branch?: { name: string } | null
      }
    | null
  requesterExternalProfile?:
    | {
        branch?: { name: string } | null
      }
    | null
  requesterUser?:
    | {
        firstName: string
        lastName: string
      }
    | null
  requesterBranchName?: string | null
}): { requesterName: string; requesterBranchName: string | null } => {
  const requesterName = params.requesterEmployee
    ? `${params.requesterEmployee.firstName} ${params.requesterEmployee.lastName}`
    : params.requesterUser
      ? `${params.requesterUser.firstName} ${params.requesterUser.lastName}`
      : "Unknown Requester"

  return {
    requesterName,
    requesterBranchName:
      params.requesterBranchName ??
      params.requesterEmployee?.branch?.name ??
      params.requesterExternalProfile?.branch?.name ??
      null,
  }
}

export async function getPurchaseOrderWorkspaceData(params: {
  companyId: string
}): Promise<{
  rows: PurchaseOrderWorkspaceRow[]
  availableSourceRequests: PurchaseOrderSourceRequestOption[]
}> {
  const [orders, sourceRequests] = await Promise.all([
    db.purchaseOrder.findMany({
      where: {
        companyId: params.companyId,
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        poNumber: true,
        status: true,
        supplierName: true,
        purchaseOrderDate: true,
        sourcePurchaseRequestId: true,
        sourcePurchaseRequest: {
          select: {
            requestNumber: true,
          },
        },
        createdByUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        grandTotal: true,
        lines: {
          select: {
            id: true,
            quantityOrdered: true,
            quantityReceived: true,
            isShortClosed: true,
          },
        },
      },
    }),
    db.purchaseRequest.findMany({
      where: {
        companyId: params.companyId,
        status: PurchaseRequestStatus.APPROVED,
        items: {
          some: {},
        },
      },
      orderBy: [{ approvedAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        requestNumber: true,
        requesterBranchName: true,
        dateRequired: true,
        grandTotal: true,
        requesterEmployee: {
          select: {
            firstName: true,
            lastName: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
        requesterExternalProfile: {
          select: {
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
        requesterUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
        items: {
          orderBy: [{ lineNumber: "asc" }],
          select: {
            id: true,
            itemCode: true,
            description: true,
            uom: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            remarks: true,
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
    }),
  ])

  return {
    rows: orders.map((row) => ({
      id: row.id,
      poNumber: row.poNumber,
      status: row.status,
      supplierName: row.supplierName,
      purchaseOrderDateLabel: dateLabel.format(row.purchaseOrderDate),
      sourceRequestId: row.sourcePurchaseRequestId,
      sourceRequestNumber: row.sourcePurchaseRequest.requestNumber,
      createdByName: `${row.createdByUser.firstName} ${row.createdByUser.lastName}`,
      totalAmount: Number(row.grandTotal),
      lineCount: row.lines.length,
      hasReceivableLines: row.lines.some((line) => hasReceivableBalance(line)),
    })),
    availableSourceRequests: sourceRequests
      .map((row) => {
        const items = row.items
          .map((item) => {
            const requestedQuantity = Number(item.quantity)
            const allocatedQuantity = toQuantity(
              item.purchaseOrderLines.reduce((sum, line) => sum + Number(line.quantityOrdered), 0)
            )
            const availableQuantity = toQuantity(requestedQuantity - allocatedQuantity)
            const unitPrice = item.unitPrice === null ? 0 : Number(item.unitPrice)
            const lineTotal = Math.round(availableQuantity * unitPrice * 100) / 100

            return {
              id: item.id,
              itemCode: (item.itemCode ?? "").trim(),
              description: item.description,
              uom: item.uom,
              requestedQuantity,
              allocatedQuantity,
              availableQuantity,
              quantity: availableQuantity,
              unitPrice,
              lineTotal,
              remarks: item.remarks,
            }
          })
          .filter((item) => item.availableQuantity > QUANTITY_TOLERANCE)

        if (items.length === 0) {
          return null
        }

        const requesterDisplay = resolveSourceRequesterDisplay({
          requesterEmployee: row.requesterEmployee,
          requesterExternalProfile: row.requesterExternalProfile,
          requesterUser: row.requesterUser,
          requesterBranchName: row.requesterBranchName,
        })

        return {
          id: row.id,
          requestNumber: row.requestNumber,
          requesterName: requesterDisplay.requesterName,
          requesterBranchName: requesterDisplay.requesterBranchName,
          departmentName: row.department.name,
          requiredDateLabel: dateLabel.format(row.dateRequired),
          totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
          lineCount: items.length,
          items,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
  }
}

export async function getPurchaseOrderById(params: {
  companyId: string
  purchaseOrderId: string
}): Promise<PurchaseOrderDetail | null> {
  const order = await db.purchaseOrder.findFirst({
    where: {
      id: params.purchaseOrderId,
      companyId: params.companyId,
    },
    select: {
      id: true,
      poNumber: true,
      status: true,
      supplierName: true,
      paymentTerms: true,
      applyVat: true,
      vatAmount: true,
      discount: true,
      expectedDeliveryDate: true,
      purchaseOrderDate: true,
      remarks: true,
      sourcePurchaseRequestId: true,
      sourcePurchaseRequest: {
        select: {
          requestNumber: true,
          requesterBranchName: true,
          requesterEmployee: {
            select: {
              branch: {
                select: {
                  name: true,
                },
              },
            },
          },
          requesterExternalProfile: {
            select: {
              branch: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      createdByUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      freight: true,
      subtotal: true,
      grandTotal: true,
      issuedAt: true,
      closedAt: true,
      cancelledAt: true,
      goodsReceipts: {
        select: {
          grandTotal: true,
        },
      },
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
          shortClosedQuantity: true,
          shortClosedReason: true,
          shortClosedAt: true,
          unitPrice: true,
          lineTotal: true,
          remarks: true,
        },
      },
    },
  })

  if (!order) {
    return null
  }

  const realizedAmount = toCurrency(order.goodsReceipts.reduce((sum, receipt) => sum + Number(receipt.grandTotal), 0))
  const unservedAmount = toCurrency(Math.max(0, Number(order.grandTotal) - realizedAmount))

  return {
    id: order.id,
    poNumber: order.poNumber,
    status: order.status,
    supplierName: order.supplierName,
    paymentTerms: order.paymentTerms,
    applyVat: order.applyVat,
    vatAmount: Number(order.vatAmount),
    discount: Number(order.discount),
    expectedDeliveryDateLabel: order.expectedDeliveryDate ? dateLabel.format(order.expectedDeliveryDate) : null,
    purchaseOrderDateLabel: dateLabel.format(order.purchaseOrderDate),
    remarks: order.remarks,
    sourceRequestNumber: order.sourcePurchaseRequest.requestNumber,
    sourceRequestId: order.sourcePurchaseRequestId,
    requesterBranchName:
      order.sourcePurchaseRequest.requesterBranchName ??
      order.sourcePurchaseRequest.requesterEmployee?.branch?.name ??
      order.sourcePurchaseRequest.requesterExternalProfile?.branch?.name ??
      null,
    createdByName: `${order.createdByUser.firstName} ${order.createdByUser.lastName}`,
    freight: Number(order.freight),
    subtotal: Number(order.subtotal),
    grandTotal: Number(order.grandTotal),
    realizedAmount,
    unservedAmount,
    openedAt: formatDateTime(order.issuedAt),
    closedAt: formatDateTime(order.closedAt),
    cancelledAt: formatDateTime(order.cancelledAt),
    lines: order.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      itemCode: line.itemCode ?? "",
      description: line.description,
      uom: line.uom,
      quantityOrdered: Number(line.quantityOrdered),
      quantityReceived: Number(line.quantityReceived),
      quantityRemaining: Math.max(0, Number(line.quantityOrdered) - Number(line.quantityReceived)),
      isShortClosed: line.isShortClosed,
      shortClosedQuantity: Number(line.shortClosedQuantity),
      shortClosedReason: line.shortClosedReason,
      shortClosedAtLabel: formatDateTime(line.shortClosedAt),
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
      remarks: line.remarks,
    })),
  }
}

export async function getPurchaseOrderGoodsReceiptWorkspaceData(params: {
  companyId: string
}): Promise<{
  rows: PurchaseOrderGoodsReceiptWorkspaceRow[]
  availableOrders: PurchaseOrderGoodsReceiptSourceOrderOption[]
}> {
  const [receipts, orders] = await Promise.all([
    db.purchaseOrderGoodsReceipt.findMany({
      where: {
        companyId: params.companyId,
      },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        grpoNumber: true,
        receivedAt: true,
        grandTotal: true,
        purchaseOrderId: true,
        purchaseOrder: {
          select: {
            poNumber: true,
            status: true,
            supplierName: true,
            sourcePurchaseRequest: {
              select: {
                requestNumber: true,
              },
            },
          },
        },
        receivedByUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        lines: {
          select: {
            id: true,
          },
        },
      },
    }),
    db.purchaseOrder.findMany({
      where: {
        companyId: params.companyId,
        status: {
          in: [PurchaseOrderStatus.OPEN, PurchaseOrderStatus.PARTIALLY_RECEIVED],
        },
        lines: {
          some: {},
        },
      },
      orderBy: [{ purchaseOrderDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        poNumber: true,
        status: true,
        supplierName: true,
        paymentTerms: true,
        applyVat: true,
        vatAmount: true,
        discount: true,
        subtotal: true,
        grandTotal: true,
        purchaseOrderDate: true,
        sourcePurchaseRequestId: true,
        sourcePurchaseRequest: {
          select: {
            requestNumber: true,
            requesterBranchName: true,
            requesterEmployee: {
              select: {
                firstName: true,
                lastName: true,
                branch: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            requesterExternalProfile: {
              select: {
                branch: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            requesterUser: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            department: {
              select: {
                name: true,
              },
            },
          },
        },
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
            discount: true,
            vatAmount: true,
          },
        },
      },
    }),
  ])

  return {
    rows: receipts.map((receipt) => ({
      id: receipt.id,
      grpoNumber: receipt.grpoNumber,
      purchaseOrderId: receipt.purchaseOrderId,
      poNumber: receipt.purchaseOrder.poNumber,
      purchaseOrderStatus: receipt.purchaseOrder.status,
      supplierName: receipt.purchaseOrder.supplierName,
      sourceRequestNumber: receipt.purchaseOrder.sourcePurchaseRequest.requestNumber,
      receivedAtLabel: dateLabel.format(receipt.receivedAt),
      receivedByName: `${receipt.receivedByUser.firstName} ${receipt.receivedByUser.lastName}`,
      itemCount: receipt.lines.length,
      grandTotal: Number(receipt.grandTotal),
    })),
    availableOrders: orders
      .map((order) => {
        const requesterDisplay = resolveSourceRequesterDisplay({
          requesterEmployee: order.sourcePurchaseRequest.requesterEmployee,
          requesterExternalProfile: order.sourcePurchaseRequest.requesterExternalProfile,
          requesterUser: order.sourcePurchaseRequest.requesterUser,
          requesterBranchName: order.sourcePurchaseRequest.requesterBranchName,
        })

        return {
          id: order.id,
          poNumber: order.poNumber,
          purchaseOrderStatus: order.status,
          sourceRequestId: order.sourcePurchaseRequestId,
          sourceRequestNumber: order.sourcePurchaseRequest.requestNumber,
          supplierName: order.supplierName,
          requesterName: requesterDisplay.requesterName,
          requesterBranchName: requesterDisplay.requesterBranchName,
          departmentName: order.sourcePurchaseRequest.department.name,
          purchaseOrderDateLabel: dateLabel.format(order.purchaseOrderDate),
          paymentTerms: order.paymentTerms,
          applyVat: order.applyVat,
          allocatedVatAmount: order.goodsReceipts.reduce((sum, receipt) => sum + Number(receipt.vatAmount), 0),
          allocatedDiscount: order.goodsReceipts.reduce((sum, receipt) => sum + Number(receipt.discount), 0),
          vatAmount: Number(order.vatAmount),
          discount: Number(order.discount),
          subtotal: Number(order.subtotal),
          grandTotal: Number(order.grandTotal),
          lines: order.lines
            .map((line) => {
              const quantityOrdered = Number(line.quantityOrdered)
              const quantityReceived = Number(line.quantityReceived)
              const quantityRemaining = Math.max(0, quantityOrdered - quantityReceived)

              return {
                id: line.id,
                lineNumber: line.lineNumber,
                itemCode: line.itemCode ?? "",
                description: line.description,
                uom: line.uom,
                quantityOrdered,
                quantityReceived,
                quantityRemaining,
                unitPrice: Number(line.unitPrice),
                lineTotal: Number(line.lineTotal),
                remarks: line.remarks,
                isShortClosed: line.isShortClosed,
              }
            })
            .filter((line) => !line.isShortClosed && line.quantityRemaining > 0.0001)
            .map(({ isShortClosed: _isShortClosed, ...line }) => line),
        }
      })
      .filter((order) => order.lines.length > 0),
  }
}

export async function getPurchaseOrderGoodsReceiptById(params: {
  companyId: string
  goodsReceiptId: string
}): Promise<PurchaseOrderGoodsReceiptDetail | null> {
  const receipt = await db.purchaseOrderGoodsReceipt.findFirst({
    where: {
      id: params.goodsReceiptId,
      companyId: params.companyId,
    },
    select: {
      id: true,
      grpoNumber: true,
      receivedAt: true,
      remarks: true,
      subtotal: true,
      vatAmount: true,
      discount: true,
      grandTotal: true,
      purchaseOrderId: true,
      receivedByUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      purchaseOrder: {
        select: {
          poNumber: true,
          supplierName: true,
          paymentTerms: true,
          purchaseOrderDate: true,
          sourcePurchaseRequest: {
            select: {
              requestNumber: true,
              requesterBranchName: true,
              requesterEmployee: {
                select: {
                  firstName: true,
                  lastName: true,
                  branch: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              requesterExternalProfile: {
                select: {
                  branch: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              requesterUser: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      lines: {
        orderBy: [{ lineNumber: "asc" }],
        select: {
          id: true,
          lineNumber: true,
          itemCode: true,
          description: true,
          uom: true,
          quantityOrdered: true,
          previouslyReceivedQuantity: true,
          receivedQuantity: true,
          remainingQuantity: true,
          unitPrice: true,
          lineTotal: true,
          remarks: true,
        },
      },
    },
  })

  if (!receipt) {
    return null
  }

  const requesterDisplay = resolveSourceRequesterDisplay({
    requesterEmployee: receipt.purchaseOrder.sourcePurchaseRequest.requesterEmployee,
    requesterExternalProfile: receipt.purchaseOrder.sourcePurchaseRequest.requesterExternalProfile,
    requesterUser: receipt.purchaseOrder.sourcePurchaseRequest.requesterUser,
    requesterBranchName: receipt.purchaseOrder.sourcePurchaseRequest.requesterBranchName,
  })

  return {
    id: receipt.id,
    grpoNumber: receipt.grpoNumber,
    purchaseOrderId: receipt.purchaseOrderId,
    poNumber: receipt.purchaseOrder.poNumber,
    sourceRequestNumber: receipt.purchaseOrder.sourcePurchaseRequest.requestNumber,
    supplierName: receipt.purchaseOrder.supplierName,
    requesterName: requesterDisplay.requesterName,
    requesterBranchName: requesterDisplay.requesterBranchName,
    departmentName: receipt.purchaseOrder.sourcePurchaseRequest.department.name,
    purchaseOrderDateLabel: dateLabel.format(receipt.purchaseOrder.purchaseOrderDate),
    receivedAtLabel: dateLabel.format(receipt.receivedAt),
    receivedByName: `${receipt.receivedByUser.firstName} ${receipt.receivedByUser.lastName}`,
    paymentTerms: receipt.purchaseOrder.paymentTerms,
    remarks: receipt.remarks,
    subtotal: Number(receipt.subtotal),
    vatAmount: Number(receipt.vatAmount),
    discount: Number(receipt.discount),
    grandTotal: Number(receipt.grandTotal),
    lines: receipt.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      itemCode: line.itemCode ?? "",
      description: line.description,
      uom: line.uom,
      quantityOrdered: toNumber(line.quantityOrdered),
      previouslyReceivedQuantity: toNumber(line.previouslyReceivedQuantity),
      receivedQuantity: toNumber(line.receivedQuantity),
      remainingQuantity: toNumber(line.remainingQuantity),
      unitPrice: toNumber(line.unitPrice),
      lineTotal: toNumber(line.lineTotal),
      remarks: line.remarks,
    })),
  }
}
