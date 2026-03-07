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
          },
        },
      },
    }),
    db.purchaseRequest.findMany({
      where: {
        companyId: params.companyId,
        status: PurchaseRequestStatus.APPROVED,
        items: {
          some: {
            purchaseOrderLines: {
              none: {
                purchaseOrder: {
                  status: {
                    in: ACTIVE_PURCHASE_ORDER_STATUSES,
                  },
                },
              },
            },
          },
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
        department: {
          select: {
            name: true,
          },
        },
        items: {
          where: {
            purchaseOrderLines: {
              none: {
                purchaseOrder: {
                  status: {
                    in: ACTIVE_PURCHASE_ORDER_STATUSES,
                  },
                },
              },
            },
          },
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
      hasReceivableLines: row.lines.some((line) => toNumber(line.quantityOrdered) - toNumber(line.quantityReceived) > 0.0001),
    })),
    availableSourceRequests: sourceRequests.map((row) => ({
      id: row.id,
      requestNumber: row.requestNumber,
      requesterName: `${row.requesterEmployee.firstName} ${row.requesterEmployee.lastName}`,
      requesterBranchName: row.requesterBranchName ?? row.requesterEmployee.branch?.name ?? null,
      departmentName: row.department.name,
      requiredDateLabel: dateLabel.format(row.dateRequired),
      totalAmount: row.items.reduce((sum, item) => sum + (item.lineTotal === null ? 0 : Number(item.lineTotal)), 0),
      lineCount: row.items.length,
      items: row.items.map((item) => ({
        id: item.id,
        itemCode: (item.itemCode ?? "").trim(),
        description: item.description,
        uom: item.uom,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice === null ? 0 : Number(item.unitPrice),
        lineTotal: item.lineTotal === null ? 0 : Number(item.lineTotal),
        remarks: item.remarks,
      })),
    })),
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
      order.sourcePurchaseRequest.requesterEmployee.branch?.name ??
      null,
    createdByName: `${order.createdByUser.firstName} ${order.createdByUser.lastName}`,
    freight: Number(order.freight),
    subtotal: Number(order.subtotal),
    grandTotal: Number(order.grandTotal),
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
      .map((order) => ({
        id: order.id,
        poNumber: order.poNumber,
        sourceRequestId: order.sourcePurchaseRequestId,
        sourceRequestNumber: order.sourcePurchaseRequest.requestNumber,
        supplierName: order.supplierName,
        requesterName: `${order.sourcePurchaseRequest.requesterEmployee.firstName} ${order.sourcePurchaseRequest.requesterEmployee.lastName}`,
        requesterBranchName:
          order.sourcePurchaseRequest.requesterBranchName ??
          order.sourcePurchaseRequest.requesterEmployee.branch?.name ??
          null,
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
            }
          })
          .filter((line) => line.quantityRemaining > 0.0001),
      }))
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

  return {
    id: receipt.id,
    grpoNumber: receipt.grpoNumber,
    purchaseOrderId: receipt.purchaseOrderId,
    poNumber: receipt.purchaseOrder.poNumber,
    sourceRequestNumber: receipt.purchaseOrder.sourcePurchaseRequest.requestNumber,
    supplierName: receipt.purchaseOrder.supplierName,
    requesterName: `${receipt.purchaseOrder.sourcePurchaseRequest.requesterEmployee.firstName} ${receipt.purchaseOrder.sourcePurchaseRequest.requesterEmployee.lastName}`,
    requesterBranchName:
      receipt.purchaseOrder.sourcePurchaseRequest.requesterBranchName ??
      receipt.purchaseOrder.sourcePurchaseRequest.requesterEmployee.branch?.name ??
      null,
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
