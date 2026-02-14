import assert from "node:assert/strict"
import test from "node:test"

import {
  upsertDepartmentMaterialRequestApprovalFlowInputSchema,
} from "../modules/material-requests/schemas/department-approval-flow-actions-schema.ts"
import {
  createMaterialRequestDraftInputSchema,
} from "../modules/material-requests/schemas/material-request-actions-schema.ts"
import {
  decideMaterialRequestStepInputSchema,
} from "../modules/material-requests/schemas/material-request-approval-actions-schema.ts"
import {
  getMaterialRequestProcessingPageInputSchema,
  updateMaterialRequestProcessingStatusInputSchema,
} from "../modules/material-requests/schemas/material-request-processing-actions-schema.ts"
import {
  getMaterialRequestPostingPageInputSchema,
  postMaterialRequestInputSchema,
} from "../modules/material-requests/schemas/material-request-posting-actions-schema.ts"

const COMPANY_ID = "9b1deb4d-bcf9-4f57-9d80-b6fb3be12f3f"
const DEPARTMENT_ID = "6fa459ea-ee8a-3ca4-894e-db77e160355e"
const USER_1_ID = "2f3e4e58-7f58-4a6c-a1a9-2dd9e7ec6a4f"
const USER_2_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
const USER_3_ID = "550e8400-e29b-41d4-a716-446655440000"

test("upsertDepartmentMaterialRequestApprovalFlowInputSchema allows multiple approvers per step", () => {
  const valid = upsertDepartmentMaterialRequestApprovalFlowInputSchema.safeParse({
    companyId: COMPANY_ID,
    departmentId: DEPARTMENT_ID,
    requiredSteps: 2,
    steps: [
      { stepNumber: 1, stepName: "Initial Review", approverUserId: USER_1_ID },
      { stepNumber: 1, stepName: "Initial Review", approverUserId: USER_2_ID },
      { stepNumber: 2, stepName: "Final Approval", approverUserId: USER_1_ID },
    ],
  })

  assert.equal(valid.success, true)

  const invalid = upsertDepartmentMaterialRequestApprovalFlowInputSchema.safeParse({
    companyId: COMPANY_ID,
    departmentId: DEPARTMENT_ID,
    requiredSteps: 2,
    steps: [
      { stepNumber: 1, stepName: "Initial Review", approverUserId: USER_1_ID },
      { stepNumber: 1, stepName: "Initial Review", approverUserId: USER_1_ID },
      { stepNumber: 2, stepName: "Final Approval", approverUserId: USER_3_ID },
    ],
  })

  assert.equal(invalid.success, false)
})

test("upsertDepartmentMaterialRequestApprovalFlowInputSchema requires a step name per approver row", () => {
  const invalid = upsertDepartmentMaterialRequestApprovalFlowInputSchema.safeParse({
    companyId: COMPANY_ID,
    departmentId: DEPARTMENT_ID,
    requiredSteps: 1,
    steps: [{ stepNumber: 1, stepName: "", approverUserId: USER_1_ID }],
  })

  assert.equal(invalid.success, false)
})

test("upsertDepartmentMaterialRequestApprovalFlowInputSchema enforces a single name per step", () => {
  const invalid = upsertDepartmentMaterialRequestApprovalFlowInputSchema.safeParse({
    companyId: COMPANY_ID,
    departmentId: DEPARTMENT_ID,
    requiredSteps: 1,
    steps: [
      { stepNumber: 1, stepName: "Initial Review", approverUserId: USER_1_ID },
      { stepNumber: 1, stepName: "Manager Review", approverUserId: USER_2_ID },
    ],
  })

  assert.equal(invalid.success, false)
})

test("createMaterialRequestDraftInputSchema rejects prepared date after required date", () => {
  const result = createMaterialRequestDraftInputSchema.safeParse({
    companyId: COMPANY_ID,
    series: "PO",
    requestType: "ITEM",
    datePrepared: "2026-03-10",
    dateRequired: "2026-03-01",
    freight: 0,
    discount: 0,
    items: [
      {
        description: "Bond paper A4",
        uom: "Ream",
        quantity: 1,
        unitPrice: 180,
      },
    ],
  })

  assert.equal(result.success, false)
})

test("createMaterialRequestDraftInputSchema accepts selected initial approver id", () => {
  const result = createMaterialRequestDraftInputSchema.safeParse({
    companyId: COMPANY_ID,
    series: "PO",
    requestType: "ITEM",
    datePrepared: "2026-03-01",
    dateRequired: "2026-03-02",
    departmentId: DEPARTMENT_ID,
    selectedInitialApproverUserId: USER_1_ID,
    selectedStepTwoApproverUserId: USER_2_ID,
    selectedStepThreeApproverUserId: USER_3_ID,
    selectedStepFourApproverUserId: USER_1_ID,
    freight: 0,
    discount: 0,
    items: [
      {
        description: "Ink cartridge",
        uom: "PCS",
        quantity: 1,
        unitPrice: 500,
      },
    ],
  })

  assert.equal(result.success, true)
})

test("decideMaterialRequestStepInputSchema validates approval decision payload", () => {
  const valid = decideMaterialRequestStepInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    remarks: "Looks good",
  })

  assert.equal(valid.success, true)

  const invalid = decideMaterialRequestStepInputSchema.safeParse({
    companyId: "bad-id",
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
  })

  assert.equal(invalid.success, false)
})

test("getMaterialRequestProcessingPageInputSchema supports processing status filters", () => {
  const valid = getMaterialRequestProcessingPageInputSchema.safeParse({
    companyId: COMPANY_ID,
    page: 2,
    pageSize: 20,
    search: "MR-PO-20260214",
    status: "IN_PROGRESS",
  })

  assert.equal(valid.success, true)

  const invalid = getMaterialRequestProcessingPageInputSchema.safeParse({
    companyId: COMPANY_ID,
    status: "INVALID_STATUS",
  })

  assert.equal(invalid.success, false)
})

test("updateMaterialRequestProcessingStatusInputSchema requires a valid target status", () => {
  const valid = updateMaterialRequestProcessingStatusInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    status: "COMPLETED",
    remarks: "Completed vendor coordination.",
    processingPoNumber: "PO-2026-000123",
    processingSupplierName: "ABC Office Supplies Inc.",
  })

  assert.equal(valid.success, true)

  const invalid = updateMaterialRequestProcessingStatusInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    status: "PENDING_PURCHASER",
  })

  assert.equal(invalid.success, false)
})

test("updateMaterialRequestProcessingStatusInputSchema enforces PO and supplier max lengths", () => {
  const invalid = updateMaterialRequestProcessingStatusInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    status: "IN_PROGRESS",
    processingPoNumber: "P".repeat(81),
    processingSupplierName: "S".repeat(161),
    servedItems: [
      {
        materialRequestItemId: "5a79357e-53a2-42f4-9892-caf8de3a57c6",
        quantityServed: 1,
      },
    ],
  })

  assert.equal(invalid.success, false)
})

test("updateMaterialRequestProcessingStatusInputSchema requires PO and supplier for IN_PROGRESS", () => {
  const invalid = updateMaterialRequestProcessingStatusInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    status: "IN_PROGRESS",
    processingPoNumber: "",
    processingSupplierName: "",
    servedItems: [
      {
        materialRequestItemId: "5a79357e-53a2-42f4-9892-caf8de3a57c6",
        quantityServed: 1,
      },
    ],
  })

  assert.equal(invalid.success, false)
})

test("updateMaterialRequestProcessingStatusInputSchema requires servedItems for IN_PROGRESS", () => {
  const invalid = updateMaterialRequestProcessingStatusInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    status: "IN_PROGRESS",
    processingPoNumber: "PO-2026-000555",
    processingSupplierName: "Acme Supplier Inc.",
  })

  assert.equal(invalid.success, false)
})

test("updateMaterialRequestProcessingStatusInputSchema rejects duplicate served item ids", () => {
  const invalid = updateMaterialRequestProcessingStatusInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    status: "IN_PROGRESS",
    processingPoNumber: "PO-2026-000555",
    processingSupplierName: "Acme Supplier Inc.",
    servedItems: [
      {
        materialRequestItemId: "5a79357e-53a2-42f4-9892-caf8de3a57c6",
        quantityServed: 1,
      },
      {
        materialRequestItemId: "5a79357e-53a2-42f4-9892-caf8de3a57c6",
        quantityServed: 2,
      },
    ],
  })

  assert.equal(invalid.success, false)
})

test("updateMaterialRequestProcessingStatusInputSchema accepts servedItems with positive qty", () => {
  const valid = updateMaterialRequestProcessingStatusInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    status: "IN_PROGRESS",
    processingPoNumber: "PO-2026-000555",
    processingSupplierName: "Acme Supplier Inc.",
    servedItems: [
      {
        materialRequestItemId: "5a79357e-53a2-42f4-9892-caf8de3a57c6",
        quantityServed: 1.25,
      },
    ],
  })

  assert.equal(valid.success, true)
})

test("getMaterialRequestPostingPageInputSchema supports posting filters", () => {
  const valid = getMaterialRequestPostingPageInputSchema.safeParse({
    companyId: COMPANY_ID,
    page: 1,
    pageSize: 10,
    search: "MR-PO-20260214-000001",
    status: "PENDING_POSTING",
  })

  assert.equal(valid.success, true)

  const invalid = getMaterialRequestPostingPageInputSchema.safeParse({
    companyId: COMPANY_ID,
    status: "INVALID_STATUS",
  })

  assert.equal(invalid.success, false)
})

test("postMaterialRequestInputSchema allows optional posting reference", () => {
  const withoutReference = postMaterialRequestInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    postingReference: "",
  })

  assert.equal(withoutReference.success, true)

  const valid = postMaterialRequestInputSchema.safeParse({
    companyId: COMPANY_ID,
    requestId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
    postingReference: "JV-2026-000991",
    remarks: "Posted in ERP module.",
  })

  assert.equal(valid.success, true)
})
