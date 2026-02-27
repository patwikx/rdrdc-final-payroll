# School Financial System Comprehensive Plan

Last updated: 2026-02-26  
Owner: Finance System Planning (School ERP expansion)

## Purpose

This document is the master reference plan for building a comprehensive school financial system using learnings from the current payroll system schema and modules.

This plan is intended for a separate project clone and does not require immediate schema changes in this repository.

## Current baseline from existing schema

The current system is strong in:

1. Multi-company tenancy and access control (`Company`, `UserCompanyAccess`).
2. HR and payroll operations (`Employee`, `PayrollRun`, `Payslip`, leave/overtime/attendance).
3. Chart of accounts foundation (`GLAccount`, `AccountCategory`).
4. Procurement request workflow (`MaterialRequest*`) with approval, serving, receiving, and posting markers.

The current system is missing full finance backbone components:

1. General ledger transaction engine (journals, posting, trial balance, period close).
2. Student tuition billing and collections (AR subledger).
3. Accounts payable operational lifecycle (supplier invoice to payment).
4. Treasury and bank reconciliation.
5. Budget control engine.
6. Fixed assets and depreciation.

## Architecture principles

1. Keep `companyId` as mandatory tenant boundary across all finance tables.
2. Keep subledgers separate but integrated through a common posting engine.
3. Treat all operational modules as source documents; GL is the accounting truth.
4. Use immutable accounting entries after posting. Corrections use reversal + rebook.
5. Preserve PH-local date semantics (`Asia/Manila`) for date-only business fields.
6. Enforce RBAC via company-scoped access (`UserCompanyAccess.role`) with centralized policy.
7. Require full auditability for approvals, postings, and status transitions.

## Accounting-grade non-negotiables (no shortcuts)

1. No hard deletes for financial records. Use soft-delete only for setup/master data where allowed, and never for posted entries.
2. Posted journals and posted subledger entries are immutable.
3. Corrections must use reversal entries and replacement entries with explicit linkage.
4. Every financial event must have document lineage:
   Source document -> Subledger entry -> Posting batch -> Journal entry -> Journal lines.
5. Every approval-sensitive transaction uses maker-checker (initiator and approver cannot be the same user when policy requires).
6. Status transitions must be deterministic and recorded as audit events with actor, timestamp, and before/after state.
7. Period close must prevent backdated posting unless reopened with explicit authorization trail.
8. Financial numbering (OR, invoice, voucher, journal reference, check number) must be controlled, unique, and traceable.
9. All monetary values must use fixed precision decimals and store both transaction currency and base currency amounts if multi-currency is introduced.
10. Reconciliation artifacts (matches, adjustments, unresolved items) must be retained with full history.

## Standard procurement decision (important)

### Decision

`MaterialRequest` should represent Purchase Requisition (PR), not final Purchase Order (PO).

### Why

1. PR is internal demand and approval.
2. PO is supplier-facing commitment with legal/commercial terms.
3. Proper controls require distinct PR, PO, Receiving, AP Invoice, and Payment.
4. This enables 3-way match (`PO vs Receiving vs Supplier Invoice`).

### Practical transition from current flow

1. Keep `MaterialRequest` and `MaterialRequestItem` as PR source.
2. Create `PurchaseOrder` and `PurchaseOrderLine` from approved PR lines.
3. Keep link to source PR item (`sourceMaterialRequestItemId`).
4. Convert serving behavior into true receiving against PO lines.
5. Post AP invoice and AP payment from PO/receiving events.

## Target finance modules

1. Core Accounting (GL + periods + posting engine + financial statements)
2. Student Billing and AR (tuition, assessments, invoices, receipts, ledger)
3. Procurement and AP (supplier lifecycle, PO, invoice, payment)
4. Treasury and Cash Management (bank accounts, reconciliation, cashbook)
5. Budget Management (planning, revisions, controls, budget vs actual)
6. Fixed Assets (asset register, depreciation, disposal)
7. Finance Reporting and Compliance (BIR/VAT if applicable, aging, cash flow)

## Domain blueprint (recommended data model)

### 1) Core GL and accounting periods

1. `AccountingPeriod` (open/close/lock by company + fiscal year)
2. `JournalEntry` (header; source type/id; posting status; currency)
3. `JournalEntryLine` (double-entry lines; account; debit/credit; dimensions)
4. `PostingBatch` (idempotent posting groups per source module event)
5. `PostingRule` (map subledger events to GL account templates)
6. `TrialBalanceSnapshot` (optional performance table)

Key rules:

1. Sum(debit) must equal Sum(credit) per journal entry.
2. Posted entries are immutable.
3. Use reversal entries for corrections.

### 2) Student master and tuition AR

1. `Student` (or external SIS reference if SIS remains source of truth)
2. `AcademicYear`, `Term`, `StudentEnrollment`
3. `FeeType` and `FeeSchedule`
4. `StudentAssessment` and `StudentAssessmentLine`
5. `ARInvoice` and `ARInvoiceLine`
6. `ARReceipt` and `ARReceiptAllocation`
7. `ARCreditMemo` and `ARDebitMemo`
8. `ARLedgerEntry` (student statement facts)

Key rules:

1. Support scholarships/discounts/sponsor billing.
2. Support installment plans and penalties.
3. Keep per-student receivable aging.

### 3) Procurement and AP

1. `Supplier` and supplier contacts/tax profile
2. `PurchaseOrder` and `PurchaseOrderLine`
3. `GoodsReceipt` and `GoodsReceiptLine`
4. `APInvoice` and `APInvoiceLine`
5. `APVoucher`
6. `APPayment` and payment allocations
7. `APLedgerEntry` (supplier statement facts)

Key rules:

1. One PR may become many POs.
2. PO allows partial receipts.
3. AP invoice is validated against PO and receipt.
4. Support AP aging by due date.

### 4) Treasury and cash

1. `TreasuryBankAccount`
2. `CashbookEntry`
3. `BankStatementImport`
4. `BankReconciliationSession` and `BankReconciliationLine`
5. `PettyCashFund` and `PettyCashTransaction`
6. `CheckRegister`

Key rules:

1. Cash movement must always point to source document.
2. Reconciliation keeps matched/unmatched traces.

### 4.1) Bank reconciliation detail requirements

1. `BankReconciliationSession` must store:
   company, bank account, statement period, opening bank balance, closing bank balance, opening book balance, closing book balance, preparedBy, reviewedBy, approvedBy, and timestamps.
2. `BankReconciliationLine` must classify each item as:
   matched, unmatched-bank-only, unmatched-book-only, bank-adjustment, book-adjustment.
3. Each line must keep:
   source reference (cashbook entry id or statement line id), amount, value date, description, match group id, and resolution status.
4. Adjustment entries (bank charge, interest income, returned checks, direct credits/debits) must generate controlled book-side entries with approval trail.
5. Session outputs must include:
   outstanding checks, deposits in transit, bank errors, book errors, adjusted bank balance, adjusted book balance, and final difference.
6. Reconciliation cannot be finalized unless final difference is zero or approved exception is documented.
7. Re-opened reconciliations must preserve prior version snapshots.

### 5) Budgeting

1. `BudgetVersion` (Original, Revised, Forecast)
2. `BudgetHeader` and `BudgetLine`
3. `BudgetControlRule`
4. `BudgetCommitment` (encumbrance from PR/PO)
5. `BudgetActualFact` (posted actuals by period/account/dimension)

Key rules:

1. Control checks at PR and PO creation.
2. Budget vs actual should be periodized.

### 6) Fixed assets

1. `AssetCategory`
2. `FixedAsset`
3. `AssetAcquisition`
4. `DepreciationRun` and `DepreciationEntry`
5. `AssetTransfer`
6. `AssetDisposal`

Key rules:

1. Support book values and depreciation methods.
2. All asset movements post to GL.

## Posting integration map

### Existing modules that should generate finance entries

1. Payroll run finalization to GL journals.
2. Material request lifecycle to budget commitments and AP pipeline.
3. Loan disbursement and payment to GL liability/cash entries.
4. Leave conversion to cash and final pay impacts to payroll/GL.

### Required posting controls

1. Idempotency key per source event (`sourceType + sourceId + eventType + version`).
2. Re-post safe behavior (no duplicate posted journals).
3. Central posting service for all modules.
4. Posting audit trail with user and timestamp.

### Source-to-GL traceability contract

1. Every posted journal line stores:
   `sourceModule`, `sourceDocumentType`, `sourceDocumentId`, `sourceLineId` (when applicable), `postingBatchId`.
2. Every subledger transaction stores:
   `postedJournalEntryId` and posting status (`UNPOSTED`, `POSTED`, `REVERSED`).
3. Drilldown path must work both ways:
   source document to journal, and journal back to exact source record.
4. Reversal entries must store:
   `reversesJournalEntryId` and reason code.

## Phase-by-phase implementation roadmap

### Phase 0: Foundation and governance

1. Define accounting policies, fiscal calendar rules, and chart standards.
2. Define module ownership and approval matrix.
3. Finalize master data strategy (Student/Supplier/Items).

Deliverables:

1. Finance architecture decision record.
2. Canonical enums and source-document map.
3. Posting rule framework specification.

### Phase 1: Core GL engine

1. Build accounting periods, journal engine, posting batches, trial balance.
2. Build close/lock workflows.
3. Build basic GL reports.

Deliverables:

1. Auditable and balanced journal system.
2. Period control and posting APIs.

### Phase 2: Payroll to GL integration

1. Replace marker-only payroll posting with journal generation.
2. Post earnings, liabilities, employer contributions, cash/clearing.
3. Support reversal/repost.

Deliverables:

1. Payroll journals tied to `PayrollRun`.
2. Reconciliation between payroll summaries and GL totals.

### Phase 3: PR to PO to AP

1. Keep `MaterialRequest` as PR.
2. Add PO models and PO workflows.
3. Add receiving and AP invoice matching.
4. Add AP payment and AP aging.

Deliverables:

1. Full procure-to-pay flow.
2. AP subledger with posting to GL.

### Phase 4: Student billing and AR

1. Add fee schedules, student assessments, invoices.
2. Add receipts, allocations, credits, penalties.
3. Add AR aging and student ledger statements.

Deliverables:

1. End-to-end tuition and collection process.
2. AR subledger with posting to GL.

### Phase 5: Treasury and reconciliation

1. Add treasury bank accounts and cashbook.
2. Add bank import and reconciliation module.
3. Add petty cash and check handling.

Deliverables:

1. Bank/cash controls with matching evidence.
2. Cash position and movement reports.

### Phase 6: Budget and fixed assets

1. Add budget versions and controls.
2. Add commitments and budget-vs-actual.
3. Add fixed asset register and depreciation.

Deliverables:

1. Budget control and planning dashboards.
2. Depreciation postings and asset roll-forward reports.

## Non-functional requirements

1. Strong indexing and partition-aware design for ledger-scale tables.
2. Full audit logs for approvals and postings.
3. Deterministic status machines per module.
4. Idempotent APIs and safe retry patterns.
5. Strict input validation and typed action contracts.
6. Security controls for PII and financial data access.

## Internal controls and audit trail matrix

1. Master data changes (accounts, suppliers, fee setup):
   require change logs with field-level before/after values.
2. Transaction lifecycle events:
   Draft, Submitted, Approved, Posted, Reversed, Cancelled must each generate event logs.
3. User accountability:
   store actor user id, role context, company context, IP/user-agent where feasible.
4. Segregation of duties:
   enforce policy checks for requestor vs approver vs poster.
5. Period-end controls:
   keep close checklist evidence, lock metadata, and reopening authorization logs.
6. Report reproducibility:
   financial reports should be reproducible from posted ledgers and period state.

## Migration and transition strategy

1. Use source-document adapters to map old module events into new posting service.
2. Keep backward compatibility during transition via dual-write only where required.
3. Backfill historical data in controlled batches with reconciliation checkpoints.
4. Cut over by module (Payroll first, then AP/AR).
5. Freeze destructive schema changes after cutover windows.

## Risks and mitigations

1. Risk: treating requisition as PO creates audit/control gaps.  
   Mitigation: enforce dedicated PO document and statuses.
2. Risk: duplicate postings during retries.  
   Mitigation: posting idempotency keys and unique constraints.
3. Risk: inconsistent tenant scoping.  
   Mitigation: `companyId` required in every finance table and policy checks.
4. Risk: report mismatch between subledgers and GL.  
   Mitigation: daily reconciliation jobs and exception reports.

## Immediate next planning outputs

1. Core GL Prisma schema draft (`AccountingPeriod`, `JournalEntry`, `JournalEntryLine`, `PostingBatch`).
2. PR to PO transition schema draft (new `PurchaseOrder*` models + links from `MaterialRequestItem`).
3. Posting rule matrix for payroll, AP, and AR events.
4. Integration contract definitions for source modules.

## Summary decision

Your current `MaterialRequest` design is a strong Purchase Requisition foundation.  
Best practice is to keep it as PR and add dedicated PO/AP/GL layers for a complete school financial system.
