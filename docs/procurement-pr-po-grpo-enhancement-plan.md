# Procurement PR -> PO -> GRPO Enhancement Plan

Last updated: 2026-03-07

## Scope

This is a living plan for improving the procurement PR -> PO -> GRPO flow in this app.

Initial confirmed gap:

- one approved PR can generate multiple POs by item line
- one PR item line cannot yet be split across multiple POs/suppliers

## Implemented Baselines (2026-03-07)

These items are already implemented and are no longer pending:

- Purchase Request approvers can `Send Back for Edit` (with required remarks).
- Returned PRs go back to `DRAFT` and, when resubmitted, restart approval from step 1.
- Purchase Request create/update supports both catalog and manual item lines.
- Purchase Order creation supports split awarding by quantity from the same PR line across multiple POs.
- Remaining allocable quantity per PR line is validated server-side at PO creation time.
- Purchase Orders support standard lifecycle staging: save as `DRAFT` then explicit `OPEN`.

## Current Problem Statement

The current implementation is sufficient only when each approved PR item line is fully awarded to a single supplier.

It breaks for common procurement scenarios such as:

- one item line awarded to multiple suppliers
- one item line partially awarded now and partially awarded later
- one item line re-sourced after only part of the demand is fulfilled

## Target Direction

Support supplier awarding at the quantity level, not only at the item-line level.

Desired future behavior:

- one approved PR can still generate multiple POs
- one PR item line can be split across multiple POs
- each PO line carries awarded quantity (`quantityOrdered`)
- the system tracks remaining awardable quantity per PR item line (currently derived, not persisted)

## Approval Return For Edit

### Recommended Behavior

Add a third approver outcome for purchase requests:

- `APPROVE`
- `REJECT`
- `SEND_BACK_FOR_EDIT`

Recommended default on resubmission:

- if a PR is returned for edit and the requester changes the request, resubmission should restart the approval flow from step 1
- previous approvals should remain in history only
- previous approvals should not remain active for the revised version

### Why restart from step 1

This is the safer procurement rule because:

- step 1 approved the old request content, not the revised one
- item, quantity, purpose, pricing context, and delivery need may have changed
- restarting is easier to reason about in audit trails and approval accountability

### Suggested Data/Workflow Direction

- add a request status such as `FOR_EDIT` or `NEEDS_REVISION`
- store:
  - `returnedByStepNumber`
  - `returnedByUserId`
  - `returnedAt`
  - `returnRemarks`
  - `revisionNumber`
  - `approvalCycleNumber`
- on resubmission:
  - increment revision/cycle metadata
  - regenerate active approval steps
  - restart from step 1
- keep old cycle decisions as historical approval records

### Optional Future Variant

If business later wants more flexibility, support two return types:

- `Minor Edit`:
  resume from the same step that returned the PR
- `Material Edit`:
  restart from step 1

For now, the recommended default is:

- all returned-and-edited PRs restart from step 1

Status: implemented.

## Manual PR Items

### Recommended Behavior

Purchase request creation should allow manual item entry when the request type or business case requires it.

Recommended direction:

- `ITEM` requests:
  allow both catalog-backed and manual lines
- `SERVICE` requests:
  allow manual lines by default

### Manual Line Fields

For manual PR lines, support:

- item description
- UOM
- quantity
- estimated unit price
- line remarks

Suggested persistence behavior:

- `source = MANUAL`
- `procurementItemId = null`

### Why this is needed

- not all requested goods/services exist in the catalog
- service requests often do not map cleanly to stocked item masters
- procurement teams still need structured PR approval even for ad hoc requests

Status: implemented.

## Proposed Work Plan

### Phase 1: Functional Design

- define the intended business rule for split awarding
- confirm whether split awarding is allowed for all PR types or only selected cases
- confirm whether a PR item can be awarded to multiple suppliers at the same time
- confirm whether a closed/cancelled/partially received PO should release remaining PR quantity back for re-PO
- define return-for-edit behavior and requester editing permissions
- define which request changes should force full approval restart
- define when manual PR lines are allowed by request type

### Phase 2: Data Model Changes

- done:
  - shift PR item sourcing behavior to quantity-based allocation across multiple POs
  - use PO line `quantityOrdered` as awarded quantity per PR source line
  - derive remaining allocable quantity from active PO allocations and enforce in action validation
- remaining:
  - optional persisted allocation ledger/snapshot if audit/reporting needs strict point-in-time balances
- add return-for-edit request state and revision/cycle tracking
- allow manual PR lines with nullable catalog reference

### Phase 3: PO Creation Flow

- done:
  - PO creation UI accepts ordered quantity per selected PR line
  - server validation blocks over-allocation beyond remaining quantity
  - same PR line can be reused in future POs until fully allocated

### Phase 4: Approval Revision Flow

- done:
  - add approver action for `Send Back for Edit`
  - allow requester to edit returned PRs via `DRAFT` state
  - on resubmission, restart approval from step 1
- remaining:
  - preserve prior cycle approvals in structured cycle history (currently replaced on resubmission)

### Phase 5: Lifecycle Rules

- define how cancellation affects allocated quantity
- define how PO closure affects remaining allocable quantity
- define how partial receipt interacts with unawarded vs awarded balance
- define whether amendment/reopen flows are required

### Phase 6: PR Entry UX

- done:
  - add manual item entry mode to PR form
  - support mixed manual and catalog lines
  - validate required fields by line source
- remaining:
  - add stricter request-type-specific business rules if needed

### Phase 7: Reporting and Visibility

- show allocated quantity, received quantity, and remaining quantity per PR item
- show which suppliers/POs were awarded from a single PR item line
- make PR detail and PO detail pages reflect split-award history clearly

### Phase 8: Testing

- add unit tests for quantity allocation rules
- add integration tests for multi-PO sourcing from one PR
- add regression tests for cancellation, partial receipt, and re-PO scenarios
- add tests for return-for-edit and approval restart behavior
- add tests for manual PR line validation and resubmission flows

## Open Questions

- Should one PR item line be allowed across multiple suppliers immediately after approval?
- Should the system support re-awarding leftover quantity after a PO is cancelled?
- Should partial non-delivery on a PO reopen remaining quantity for another supplier automatically or manually?
- Should GRPO affect allocable quantity, or only ordered/received tracking?
- Should any edit after send-back automatically restart approval from step 1, or only material edits?
- Which fields count as material edits:
  - items
  - quantities
  - request type
  - department
  - required date
  - purpose
- Should manual lines be allowed for both `ITEM` and `SERVICE`, or only `SERVICE`?

## Next Additions

Add future notes here for:

- approval behavior changes
- PO approval/release requirements
- GRPO reversal/return behavior
- supplier master integration
- inventory and accounting downstream effects
