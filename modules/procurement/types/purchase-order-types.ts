export type PurchaseOrderWorkspaceRow = {
  id: string
  poNumber: string
  status: "DRAFT" | "OPEN" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED" | "CLOSED" | "CANCELLED"
  supplierName: string
  purchaseOrderDateLabel: string
  sourceRequestId: string
  sourceRequestNumber: string
  createdByName: string
  totalAmount: number
  lineCount: number
  hasReceivableLines: boolean
}

export type PurchaseOrderSourceRequestLineItem = {
  id: string
  itemCode: string
  description: string
  uom: string
  requestedQuantity: number
  allocatedQuantity: number
  availableQuantity: number
  quantity: number
  unitPrice: number
  lineTotal: number
  remarks: string | null
}

export type PurchaseOrderSourceRequestOption = {
  id: string
  requestNumber: string
  requesterName: string
  requesterBranchName: string | null
  departmentName: string
  requiredDateLabel: string
  totalAmount: number
  lineCount: number
  items: PurchaseOrderSourceRequestLineItem[]
}

export type PurchaseOrderLineForm = {
  sourcePurchaseRequestItemId: string
  lineNumber: number
  itemCode: string
  description: string
  uom: string
  quantityOrdered: string
  unitPrice: string
  remarks: string
}

export type PurchaseOrderCreateForm = {
  sourceRequestId: string
  supplierName: string
  paymentTerms: string
  applyVat: boolean
  discount: number
  expectedDeliveryDate: string
  remarks: string
  lines: PurchaseOrderLineForm[]
}

export type PurchaseOrderDetailLine = {
  id: string
  lineNumber: number
  itemCode: string
  description: string
  uom: string
  quantityOrdered: number
  quantityReceived: number
  quantityRemaining: number
  isShortClosed: boolean
  shortClosedQuantity: number
  shortClosedReason: string | null
  shortClosedAtLabel: string | null
  unitPrice: number
  lineTotal: number
  remarks: string | null
}

export type PurchaseOrderDetail = {
  id: string
  poNumber: string
  status: "DRAFT" | "OPEN" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED" | "CLOSED" | "CANCELLED"
  supplierName: string
  paymentTerms: string
  applyVat: boolean
  vatAmount: number
  discount: number
  expectedDeliveryDateLabel: string | null
  purchaseOrderDateLabel: string
  remarks: string | null
  sourceRequestNumber: string
  sourceRequestId: string
  requesterBranchName: string | null
  createdByName: string
  freight: number
  subtotal: number
  grandTotal: number
  realizedAmount: number
  unservedAmount: number
  openedAt: string | null
  closedAt: string | null
  cancelledAt: string | null
  lines: PurchaseOrderDetailLine[]
}

export type PurchaseOrderGoodsReceiptWorkspaceRow = {
  id: string
  grpoNumber: string
  purchaseOrderId: string
  poNumber: string
  purchaseOrderStatus: "DRAFT" | "OPEN" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED" | "CLOSED" | "CANCELLED"
  supplierName: string
  sourceRequestNumber: string
  receivedAtLabel: string
  receivedByName: string
  itemCount: number
  grandTotal: number
}

export type PurchaseOrderGoodsReceiptSourceOrderLine = {
  id: string
  lineNumber: number
  itemCode: string
  description: string
  uom: string
  quantityOrdered: number
  quantityReceived: number
  quantityRemaining: number
  unitPrice: number
  lineTotal: number
  remarks: string | null
}

export type PurchaseOrderGoodsReceiptSourceOrderOption = {
  id: string
  poNumber: string
  purchaseOrderStatus: "DRAFT" | "OPEN" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED" | "CLOSED" | "CANCELLED"
  sourceRequestId: string
  sourceRequestNumber: string
  supplierName: string
  requesterName: string
  requesterBranchName: string | null
  departmentName: string
  purchaseOrderDateLabel: string
  paymentTerms: string
  applyVat: boolean
  allocatedVatAmount: number
  allocatedDiscount: number
  vatAmount: number
  discount: number
  subtotal: number
  grandTotal: number
  lines: PurchaseOrderGoodsReceiptSourceOrderLine[]
}

export type PurchaseOrderGoodsReceiptDetailLine = {
  id: string
  lineNumber: number
  itemCode: string
  description: string
  uom: string
  quantityOrdered: number
  previouslyReceivedQuantity: number
  receivedQuantity: number
  remainingQuantity: number
  unitPrice: number
  lineTotal: number
  remarks: string | null
}

export type PurchaseOrderGoodsReceiptDetail = {
  id: string
  grpoNumber: string
  purchaseOrderId: string
  poNumber: string
  sourceRequestNumber: string
  supplierName: string
  requesterName: string
  requesterBranchName: string | null
  departmentName: string
  purchaseOrderDateLabel: string
  receivedAtLabel: string
  receivedByName: string
  paymentTerms: string
  remarks: string | null
  subtotal: number
  vatAmount: number
  discount: number
  grandTotal: number
  lines: PurchaseOrderGoodsReceiptDetailLine[]
}
