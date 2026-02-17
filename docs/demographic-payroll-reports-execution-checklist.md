# Demographic + Payroll Reports Execution Checklist

Date: 2026-02-16  
Plan baseline: `docs/demographic-payroll-reports-implementation-plan.md` (Draft v2)

## Scope Locks

- Dedicated reports module (`/[companyId]/reports`).
- TWC 13th-month formula is company-policy override.
- TWC formula basis: earned-to-date gross payslip earnings, then `/ 12`.
- Dynamic columns for deduction and earning adjustments in Payroll Register.
- WS8 department snapshot integrity is in-scope for this same release.

## Phase 1: Reports Module Foundation

## PR-01: Create Dedicated Reports Module and Navigation

### Files

- `modules/navigation/sidebar-config.ts`
- `components/app-sidebar.tsx`
- `app/(dashboard)/[companyId]/reports/page.tsx` (new)
- `app/(dashboard)/[companyId]/reports/payroll/page.tsx` (new)
- `app/(dashboard)/[companyId]/payroll/statutory/page.tsx` (redirect compatibility)

### Actions

- [ ] Add `Reports` sidebar module with payroll report entry item(s).
- [ ] Add matching icon mappings for new sidebar IDs.
- [ ] Create reports landing route and payroll reports route.
- [ ] Keep legacy payroll statutory route working via redirect.
- [ ] Ensure access checks use reports/payroll role policy consistently.

### Tests

- [ ] Update/extend route access assertions in `tests/authz-policy.test.ts`.
- [ ] Add navigation smoke test for reports route visibility by role (new test file).

### Verify

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`

## PR-02: Shared Reports Contracts and Filter Schemas

### Files

- `modules/reports/payroll/schemas/report-filter-schemas.ts` (new)
- `modules/reports/payroll/types/report-view-models.ts` (new)
- `modules/reports/payroll/utils/report-time-utils.ts` (new)

### Actions

- [ ] Implement shared zod schemas for date/month/pay-period filters.
- [ ] Implement typed result contracts for all targeted reports.
- [ ] Add PH-time helper utilities for month/date boundaries.
- [ ] Ensure validators reject invalid ranges (`startDate > endDate`).

### Tests

- [ ] `tests/reports/report-filter-schemas.test.ts` (new)
- [ ] `tests/reports/report-time-utils.test.ts` (new)

### Verify

- [ ] `npm run typecheck`
- [ ] `npm run test`

## Phase 2: New Reports (Salary, WTAX, Late/OT)

## PR-03: Salary History Report (Date Range)

### Files

- `modules/reports/payroll/utils/get-salary-history-report-view-model.ts` (new)
- `modules/reports/payroll/components/salary-history-report-client.tsx` (new)
- `app/(dashboard)/[companyId]/reports/payroll/page.tsx`
- `app/(dashboard)/[companyId]/reports/payroll/salary-history/export/route.ts` (new)

### Actions

- [ ] Query `EmployeeSalaryHistory` scoped by `companyId`.
- [ ] Add date-range filter (inclusive, PH-local semantics).
- [ ] Add optional employee and department filters.
- [ ] Add CSV export with audit log.
- [ ] Add loading/empty/error states in client view.

### Tests

- [ ] `tests/reports/salary-history-report.test.ts` (new)
- [ ] Cover null previous salary and multiple changes on same date.

### Verify

- [ ] `npm run typecheck`
- [ ] `npm run test`

## PR-04: Monthly BIR WTAX Report

### Files

- `modules/reports/payroll/utils/get-monthly-bir-wtax-report-view-model.ts` (new)
- `modules/reports/payroll/components/monthly-bir-wtax-report-client.tsx` (new)
- `app/(dashboard)/[companyId]/reports/payroll/monthly-bir-wtax/export/route.ts` (new)
- `modules/audit/utils/audit-log.ts` (reuse; no API change expected)

### Actions

- [ ] Aggregate payslip `withholdingTax` by employee for selected `year-month`.
- [ ] Default source to regular runs; optional include-trial toggle.
- [ ] Show run references and monthly totals.
- [ ] Add CSV export parity with table totals.
- [ ] Add missing-TIN safe rendering.

### Tests

- [ ] `tests/reports/monthly-bir-wtax-report.test.ts` (new)
- [ ] Cover no-data month, mixed regular/trial runs, missing TIN.

### Verify

- [ ] `npm run typecheck`
- [ ] `npm run test`

## PR-05: Late and Overtime Totals Report (Per Pay Period + Top Rankings)

### Files

- `modules/reports/payroll/utils/get-late-overtime-report-view-model.ts` (new)
- `modules/reports/payroll/components/late-overtime-report-client.tsx` (new)
- `app/(dashboard)/[companyId]/reports/payroll/late-overtime/export/route.ts` (new)

### Actions

- [ ] Compute totals from payslip set in selected pay period using `tardinessMins`, `overtimeHours`, overtime pay lines, and tardiness deduction lines.
- [ ] Add top employees for late and overtime.
- [ ] Add top departments for late and overtime.
- [ ] Apply deterministic tie-breakers.
- [ ] Add CSV export for totals and rankings.

### Tests

- [ ] `tests/reports/late-overtime-report.test.ts` (new)
- [ ] Cover ties, OT hours with zero OT pay, late minutes with zero tardiness deduction.

### Verify

- [ ] `npm run typecheck`
- [ ] `npm run test`

## Phase 3: Payroll Register Improvements

## PR-06: Dynamic Payroll Register Columns for Deductions and Earnings

### Files

- `modules/payroll/utils/build-payroll-register-csv.ts`
- `modules/payroll/components/payroll-register-preview-client.tsx`
- `app/(dashboard)/[companyId]/payroll/runs/[runId]/report/page.tsx`
- `app/(dashboard)/[companyId]/payroll/runs/[runId]/report/export/route.ts`

### Actions

- [ ] Remove residual `OTH` computation path.
- [ ] Build explicit dynamic deduction columns (non-core deduction types).
- [ ] Build explicit dynamic earning adjustment columns (non-core earning types).
- [ ] Add deterministic column order and corresponding totals.
- [ ] Keep `ADDL_TOTAL` style summary for readability.

### Tests

- [ ] `tests/payroll/payroll-register-dynamic-columns.test.ts` (new)
- [ ] Validate CSV header/data parity and subtotal/grand-total integrity.

### Verify

- [ ] `npm run typecheck`
- [ ] `npm run test`

## Phase 4: TWC 13th-Month Policy

## PR-07: Add Company-Level 13th-Month Formula Policy (No Dedicated Model)

### Files

- `modules/settings/payroll/schemas/payroll-policies-schema.ts`
- `modules/settings/payroll/components/payroll-policies-page.tsx`
- `modules/settings/payroll/actions/update-payroll-policies-action.ts`
- `modules/payroll/actions/payroll-run-actions.ts`

### Actions

- [ ] Extend existing payroll policy config payload with 13th-month formula field.
- [ ] Add settings UI control for formula selection.
- [ ] Implement compute branch for `BASIC_YTD_OR_PRORATED` (existing default) and `GROSS_PAYSLIP_EARNINGS` (TWC override).
- [ ] Implement earned-to-date scope (no year-end projection).
- [ ] Keep calculation trace notes explicit about applied formula.

### Tests

- [ ] `tests/payroll/twc-thirteenth-month-policy.test.ts` (new)
- [ ] Cover hire/separation boundaries and non-TWC unaffected path.

### Verify

- [ ] `npm run typecheck`
- [ ] `npm run test`

## Phase 5: WS8 Snapshot Integrity

## PR-08: Department Snapshot on Payslip for Historical Reporting Integrity

### Files

- `prisma/schema/payroll.prisma`
- `prisma/migrations/<timestamp>_add_payslip_department_snapshot/migration.sql` (new)
- `modules/payroll/actions/payroll-run-actions.ts`
- `app/(dashboard)/[companyId]/payroll/runs/[runId]/report/page.tsx`
- `app/(dashboard)/[companyId]/payroll/runs/[runId]/report/export/route.ts`
- `modules/reports/payroll/utils/get-monthly-bir-wtax-report-view-model.ts`
- `modules/reports/payroll/utils/get-late-overtime-report-view-model.ts`
- `scripts/backfill-payslip-department-snapshot.mjs` (new, optional but recommended)

### Actions

- [ ] Add payslip snapshot fields for department id/name.
- [ ] Populate snapshots during payroll computation.
- [ ] Update reports to read snapshot first, fallback for legacy rows.
- [ ] Add one-time backfill script for existing payslips.

### Tests

- [ ] `tests/payroll/payslip-department-snapshot.test.ts` (new)
- [ ] Cover legacy fallback and renamed department behavior.

### Verify

- [ ] `npm run typecheck`
- [ ] `npm run test`

## Phase 6: Hardening and Release

## PR-09: Consolidated QA, Performance, and Release Prep

### Files

- `docs/demographic-payroll-reports-implementation-plan.md`
- `docs/demographic-payroll-reports-execution-checklist.md`
- Test files created in prior PRs

### Actions

- [ ] Run full quality gates and fix regressions.
- [ ] Validate report totals against known payroll samples.
- [ ] Validate print/CSV parity for each report.
- [ ] Validate multi-company scoping and role restrictions.
- [ ] Validate PH date semantics end-to-end.

### Tests/Checks

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run audit:payroll:ph`

## Release Notes Checklist

- [ ] Add migration and rollback notes for snapshot fields.
- [ ] Add user-facing note: payroll reports moved to dedicated Reports module.
- [ ] Add admin note: TWC 13th-month formula is company policy override.
- [ ] Add data caveat note for legacy rows before snapshot backfill completion.
