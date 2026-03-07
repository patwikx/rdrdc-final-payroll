import assert from "node:assert/strict"
import test from "node:test"

import {
  closePurchaseOrderInputSchema,
  createPurchaseOrderGoodsReceiptInputSchema,
  createPurchaseOrderInputSchema,
} from "../modules/procurement/schemas/purchase-order-actions-schema.ts"
import {
  createPurchaseRequestDraftInputSchema,
  rejectPurchaseRequestInputSchema,
} from "../modules/procurement/schemas/purchase-request-actions-schema.ts"
import {
  updatePurchaseRequestFeatureInputSchema,
} from "../modules/procurement/schemas/purchase-request-feature-actions-schema.ts"

const COMPANY_ID = "9b1deb4d-bcf9-4f57-9d80-b6fb3be12f3f"
const DEPARTMENT_ID = "6fa459ea-ee8a-3ca4-894e-db77e160355e"

test("updatePurchaseRequestFeatureInputSchema validates toggle payload", () => {
  const valid = updatePurchaseRequestFeatureInputSchema.safeParse({
    companyId: COMPANY_ID,
    enabled: true,
  })
  assert.equal(valid.success, true)

  const invalid = updatePurchaseRequestFeatureInputSchema.safeParse({
    companyId: "bad",
    enabled: "yes",
  })
  assert.equal(invalid.success, false)
})

test("createPurchaseRequestDraftInputSchema requires valid dates", () => {
  const invalid = createPurchaseRequestDraftInputSchema.safeParse({
    companyId: COMPANY_ID,
    series: "PO",
    requestType: "ITEM",
    datePrepared: "2026-03-10",
    dateRequired: "2026-03-01",
    departmentId: DEPARTMENT_ID,
    freight: 0,
    discount: 0,
    items: [
      {
        description: "Bond paper A4",
        uom: "REAM",
        quantity: 1,
        unitPrice: 180,
      },
    ],
  })

  assert.equal(invalid.success, false)
})

test("createPurchaseRequestDraftInputSchema accepts catalog item rows", () => {
  const valid = createPurchaseRequestDraftInputSchema.safeParse({
    companyId: COMPANY_ID,
    series: "PO",
    requestType: "ITEM",
    datePrepared: "2026-03-01",
    dateRequired: "2026-03-02",
    departmentId: DEPARTMENT_ID,
    freight: 25,
    discount: 0,
    items: [
      {
        source: "CATALOG",
        procurementItemId: "550e8400-e29b-41d4-a716-446655440000",
        itemCode: "PEN-001",
        description: "Black Ballpen",
        uom: "PCS",
        quantity: 5,
        unitPrice: 12.5,
      },
    ],
  })

  assert.equal(valid.success, true)
})

test("rejectPurchaseRequestInputSchema requires rejection remarks", () => {
  const invalid = rejectPurchaseRequestInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    remarks: "",
  })

  assert.equal(invalid.success, false)
})

test("createPurchaseOrderInputSchema validates source lines and supplier", () => {
  const valid = createPurchaseOrderInputSchema.safeParse({
    companyId: COMPANY_ID,
    sourceRequestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    supplierName: "ABC Office Supplies",
    paymentTerms: "COD",
    applyVat: true,
    discount: 25,
    expectedDeliveryDate: "2026-03-15",
    lines: [
      {
        sourcePurchaseRequestItemId: "5a79357e-53a2-42f4-9892-caf8de3a57c6",
        unitPrice: 35,
      },
    ],
  })

  assert.equal(valid.success, true)
})

test("closePurchaseOrderInputSchema requires uuid payload", () => {
  const invalid = closePurchaseOrderInputSchema.safeParse({
    companyId: COMPANY_ID,
    purchaseOrderId: "bad",
  })

  assert.equal(invalid.success, false)
})

test("createPurchaseOrderGoodsReceiptInputSchema validates receipt lines", () => {
  const valid = createPurchaseOrderGoodsReceiptInputSchema.safeParse({
    companyId: COMPANY_ID,
    purchaseOrderId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    receivedAt: "2026-03-06",
    remarks: "Partial delivery received",
    lines: [
      {
        purchaseOrderLineId: "5a79357e-53a2-42f4-9892-caf8de3a57c6",
        receivedQuantity: 2,
      },
    ],
  })

  assert.equal(valid.success, true)
})
