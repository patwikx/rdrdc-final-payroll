# Material Requests Prisma Schema Plan

Last updated: 2026-02-14
Owner: Payroll System (Material Requests rollout)

## Implementation status (2026-02-14)

This planning document has been largely implemented. The authoritative schema is now:

- `prisma/schema/material-request.prisma`

Implemented highlights beyond the original initial plan:

- Department flow supports multiple approvers per step via:
  - `@@unique([flowId, stepNumber, approverUserId])`
- Request-level selected approver snapshots are persisted per step:
  - `selectedInitialApproverUserId`
  - `selectedStepTwoApproverUserId`
  - `selectedStepThreeApproverUserId`
  - `selectedStepFourApproverUserId`
- Processing and posting lifecycle models are active:
  - `MaterialRequestProcessingStatus`
  - `MaterialRequestPostingStatus`
  - `MaterialRequestServeBatch`
  - `MaterialRequestServeBatchItem`
  - `MaterialRequestPosting`
- Legacy-sync trace fields and idempotent unique constraints are active for migration safety.

## Scope and constraints

- Material Requests will live in Employee Portal routes.
- Leave and Overtime approval flows are out of scope and must remain unchanged.
- Material Requests approval must support per-department configurable `1..4` sequential steps.
- Cross-subsidiary approvers must be supported through existing multi-company access rules.

## Legacy observation (important)

In the legacy module, "Add New Item" is already persisted by server actions:

- `createMaterialRequest` creates all submitted `items` with `itemCode: null` allowed for new items.
- `updateMaterialRequest` deletes existing lines and recreates submitted `items` (including new ones).

Reference: `legacy-leave-system/lib/actions/mrs-actions/material-request-actions.ts`

For the new module, we should still persist manual/new items explicitly and make their source clear in schema.

## Proposed schema (Material Requests only)

### Enums

```prisma
enum MaterialRequestSeries {
  PO
  JO
  OTHERS
}

enum MaterialRequestType {
  ITEM
  SERVICE
}

enum MaterialRequestStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
  CANCELLED
}

enum MaterialRequestStepStatus {
  PENDING
  APPROVED
  REJECTED
  SKIPPED
}

enum MaterialRequestItemSource {
  MANUAL
  CATALOG
}
```

### Department approval config

```prisma
model DepartmentMaterialRequestApprovalFlow {
  id String @id @default(uuid())

  companyId    String
  company      Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  departmentId String
  department   Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  requiredSteps Int     @default(1) // validated in app: 1..4
  isActive      Boolean @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?
  updatedById String?
  createdBy   User?    @relation("DepartmentMaterialRequestApprovalFlowCreatedBy", fields: [createdById], references: [id])
  updatedBy   User?    @relation("DepartmentMaterialRequestApprovalFlowUpdatedBy", fields: [updatedById], references: [id])

  steps DepartmentMaterialRequestApprovalFlowStep[]

  @@unique([companyId, departmentId])
  @@index([companyId])
  @@index([departmentId])
  @@index([isActive])
}

model DepartmentMaterialRequestApprovalFlowStep {
  id String @id @default(uuid())

  flowId String
  flow   DepartmentMaterialRequestApprovalFlow @relation(fields: [flowId], references: [id], onDelete: Cascade)

  stepNumber Int // validated in app: 1..4

  approverUserId String
  approverUser   User @relation("DepartmentMaterialRequestApprovalFlowStepApprover", fields: [approverUserId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([flowId, stepNumber])
  @@unique([flowId, approverUserId]) // avoid duplicate approvers in one flow
  @@index([approverUserId])
}
```

### Request header, steps snapshot, and items

```prisma
model MaterialRequest {
  id String @id @default(uuid())

  companyId String
  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  requestNumber String
  series        MaterialRequestSeries
  requestType   MaterialRequestType
  status        MaterialRequestStatus @default(DRAFT)

  requesterEmployeeId String
  requesterEmployee   Employee @relation("MaterialRequestRequesterEmployee", fields: [requesterEmployeeId], references: [id], onDelete: Restrict)
  requesterUserId     String
  requesterUser       User     @relation("MaterialRequestRequesterUser", fields: [requesterUserId], references: [id], onDelete: Restrict)

  departmentId String
  department   Department @relation(fields: [departmentId], references: [id], onDelete: Restrict)

  datePrepared DateTime @db.Date
  dateRequired DateTime @db.Date

  chargeTo   String?
  bldgCode   String?
  purpose    String? @db.Text
  remarks    String? @db.Text
  deliverTo  String?
  isStoreUse Boolean @default(false)

  freight   Decimal @default(0) @db.Decimal(12, 2)
  discount  Decimal @default(0) @db.Decimal(12, 2)
  subTotal  Decimal @default(0) @db.Decimal(14, 2)
  grandTotal Decimal @default(0) @db.Decimal(14, 2)

  requiredSteps Int
  currentStep   Int?

  submittedAt DateTime?
  approvedAt  DateTime?
  rejectedAt  DateTime?
  cancelledAt DateTime?

  finalDecisionByUserId String?
  finalDecisionByUser   User? @relation("MaterialRequestFinalDecisionByUser", fields: [finalDecisionByUserId], references: [id], onDelete: SetNull)
  finalDecisionRemarks  String? @db.Text

  cancellationReason String? @db.Text
  cancelledByUserId  String?
  cancelledByUser    User? @relation("MaterialRequestCancelledByUser", fields: [cancelledByUserId], references: [id], onDelete: SetNull)

  // Migration trace (idempotent sync)
  legacySourceSystem  String?
  legacyRecordId      String?
  legacyBusinessUnitId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  steps MaterialRequestApprovalStep[]
  items MaterialRequestItem[]

  @@unique([companyId, requestNumber])
  @@unique([companyId, legacySourceSystem, legacyRecordId])
  @@index([companyId, status])
  @@index([departmentId])
  @@index([requesterEmployeeId])
  @@index([submittedAt])
}

model MaterialRequestApprovalStep {
  id String @id @default(uuid())

  materialRequestId String
  materialRequest   MaterialRequest @relation(fields: [materialRequestId], references: [id], onDelete: Cascade)

  stepNumber Int

  approverUserId String
  approverUser   User @relation("MaterialRequestApprovalStepApprover", fields: [approverUserId], references: [id], onDelete: Restrict)

  status  MaterialRequestStepStatus @default(PENDING)
  actedAt DateTime?
  actedByUserId String?
  actedByUser   User? @relation("MaterialRequestApprovalStepActor", fields: [actedByUserId], references: [id], onDelete: SetNull)
  remarks String? @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([materialRequestId, stepNumber])
  @@index([approverUserId, status])
  @@index([materialRequestId, status])
}

model MaterialRequestItem {
  id String @id @default(uuid())

  materialRequestId String
  materialRequest   MaterialRequest @relation(fields: [materialRequestId], references: [id], onDelete: Cascade)

  lineNumber Int
  source     MaterialRequestItemSource @default(MANUAL)

  itemCode    String?
  description String
  uom         String
  quantity    Decimal @db.Decimal(12, 3)
  unitPrice   Decimal? @db.Decimal(12, 2)
  lineTotal   Decimal? @db.Decimal(14, 2)
  remarks     String? @db.Text

  legacyItemId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([materialRequestId, lineNumber])
  @@index([materialRequestId])
  @@index([itemCode])
}
```

## Cross-subsidiary approver behavior

Use existing `UserCompanyAccess` as the authority:

- A user can be assigned as approver for Company X only if they have active `UserCompanyAccess` to Company X.
- This supports approvers from other subsidiaries without hardcoded IDs.
- Approval action should also re-check active company access at execution time.

Validation policy for config save:

- `requiredSteps` must be `1..4`.
- Steps `1..requiredSteps` must exist and be unique.
- Each approver user must have active access to the same target company.
- Optional: require `User.isRequestApprover = true` for assigned users.

## Submission and approval behavior (planned)

On submit:

- Load the department flow config.
- Snapshot configured steps into `MaterialRequestApprovalStep`.
- Set request `status = PENDING_APPROVAL`, `currentStep = 1`, `requiredSteps = flow.requiredSteps`.

On approve:

- Only `approverUserId` of the current step may approve.
- Mark current step `APPROVED`.
- If last step, set request `APPROVED`; else increment `currentStep`.

On reject:

- Only current step approver may reject.
- Mark current step `REJECTED`.
- Set request `REJECTED`.

On cancel:

- Requester can cancel only while in allowed statuses (policy to be finalized).

## What this replaces from legacy

The new design removes legacy special statuses and hardcoded role/user exceptions:

- Remove `FOR_REVIEW`
- Remove `PENDING_BUDGET_APPROVAL`
- Remove `FOR_REC_APPROVAL`
- Remove `FOR_FINAL_APPROVAL`
- Replace with one pending state + ordered step snapshot records

## Migration mapping notes (legacy -> new)

- `DRAFT` -> `DRAFT`
- Any in-flight legacy approval statuses -> `PENDING_APPROVAL` with best-effort step snapshot
- `FINAL_APPROVED` / served-like terminal states -> `APPROVED` (plus migration notes)
- `DISAPPROVED` -> `REJECTED`
- `CANCELLED` -> `CANCELLED`

Use `legacySourceSystem` + `legacyRecordId` unique key for idempotent re-sync.

## Explicit non-goals for this iteration

- No changes to Leave or Overtime approval schemas/actions.
- No generic workflow engine tables for all modules.
- No cross-company query bypass without explicit company access checks.
