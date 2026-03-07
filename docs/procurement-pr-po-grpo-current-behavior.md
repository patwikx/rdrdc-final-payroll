# Procurement PR -> PO -> GRPO Current Behavior

Last updated: 2026-03-07

## Purpose

This document captures the current implemented behavior of the procurement purchase request flow in this app, specifically for:

- Purchase Request (`PR`)
- Purchase Order (`PO`)
- Goods Receipt PO (`GRPO`)

This is an as-built note, not a target-state design.

## Confirmed Behavior

### 1. One approved PR can create multiple POs

If a single approved purchase request has multiple item lines, those item lines can be distributed across multiple purchase orders.

Example:

- PR has Item A, Item B, Item C
- PO-1 can be created for Item A
- PO-2 can be created for Item B and Item C

This means the app does support awarding different PR items to different suppliers, as long as the split happens by item line.

### 2. A single PR item line can be split across multiple POs

The implementation now supports partial awarding of one PR item line across multiple purchase orders/suppliers.

Example:

- PR Item A quantity = 100
- PO-1 can award 60
- PO-2 can award the remaining 40

Server-side validation enforces that the total awarded quantity across active PO statuses does not exceed the PR item requested quantity.

### 3. PO creation is quantity-split based

During PO creation:

- users select which approved PR item lines to include
- users input the PO ordered quantity per selected line
- ordered quantity is validated against remaining allocable quantity per PR line

The UI now shows requested, allocated, and available quantities to support controlled split awarding.

### 4. PO lifecycle supports Draft then Open

Standard PO behavior now supports:

- create and save PO as `DRAFT`
- open draft PO later via explicit `Open` action
- only `OPEN` / `PARTIALLY_RECEIVED` POs can proceed to GRPO receiving

Draft POs can be cancelled. Opening sets the PO to `OPEN` and records opened timestamp.

### 5. PR approval supports Send Back for Edit

Purchase Request approvals now support three outcomes:

- approve
- reject
- send back for edit

When a request is sent back for edit:

- request status returns to `DRAFT`
- requester can edit and submit again
- on resubmission, approval flow is regenerated and restarts from step 1

### 6. PR creation supports manual item lines

Purchase Request draft create/update now supports:

- catalog-backed lines (`source = CATALOG`)
- manually encoded lines (`source = MANUAL`)

Manual lines allow ad hoc/service entries with nullable catalog reference (`procurementItemId = null`).

## Practical Meaning

Current procurement awarding behavior is:

- supported:
  - one PR to many POs by different item lines
  - one PR item line split across multiple POs by quantity
  - different suppliers per PO

## Current Limitation Summary

The system currently models:

- one approved PR
- many PR item lines
- each PR item line has requested quantity with allocable remaining quantity derived from active PO lines

It does not yet model:

- explicit persisted allocation ledger per PR item line (remaining is currently derived)
- structured revision cycle history for send-back/resubmission

## Reference Code

- PO source request filtering and available item selection:
  - `modules/procurement/utils/purchase-order-read-models.ts`
- PO creation validation against already-used PR item lines:
  - `modules/procurement/actions/purchase-order-actions.ts`
- PO create UI line handling:
  - `modules/procurement/components/purchase-order-create-page.tsx`
- PR approval actions currently available:
  - `modules/procurement/actions/purchase-request-actions.ts`
- PR request schema now supporting catalog + manual lines:
  - `modules/procurement/schemas/purchase-request-actions-schema.ts`
- PR create/edit UI supporting manual item lines:
  - `modules/procurement/components/purchase-request-draft-form-client.tsx`
- PR approval queue UI supporting send-back decision:
  - `modules/material-requests/components/material-request-approval-client.tsx`
