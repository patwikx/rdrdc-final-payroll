# Demographic + Payroll Reporting Implementation Plan (Draft v2)

Date: 2026-02-16  
Status: Draft for review and iteration
Execution checklist: `docs/demographic-payroll-reports-execution-checklist.md`

## Decision Log (Locked - 2026-02-16)

1. TWC rule is company-specific (Tropicana Worldwide Corporation), not a generic employment-type assumption.
2. TWC 13th-month basis will use gross payslip earnings.
3. Payroll Register will use dynamic columns per deduction and earning types for adjustments/breakdown visibility (no generic Others).
4. New reports should move to a dedicated Reports module.
5. Historical department handling needs explicit design (see WS8).
6. TWC 13th-month computation is earned-to-date (no year-end projection).
7. TWC special policy will be stored in existing payroll policy config (no dedicated Prisma model for now).
8. WS8 (department snapshot integrity) is included in the same release.

## Skill Usage

- `vercel-react-best-practices`: used to shape server/client data flow, prevent waterfalls, and keep report pages performant.
- `frontend-design`: used to keep report UI intentional and readable while staying within the project's existing visual system.

## Objective

Implement the following enhancements in a production-safe, tenant-safe, PH-timezone-correct way:

1. Salary History Report of employees with date range filtering.
2. Payroll Register per Department.
3. Monthly BIR WTax Report.
4. Late and Overtime totals report per pay period, including top employees and top departments.
5. Separate 13th-month rule for Tropicana Worldwide Corporation (TWC): `Gross Payslip Earnings / 12` with proration support.
6. Payroll Register "Additional Deductions" must not be shown as generic `Others`.

## Current State Baseline

- Payroll reporting workspace exists at `app/(dashboard)/[companyId]/payroll/statutory/page.tsx`.
- Existing report view model exists at `modules/payroll/utils/get-payroll-statutory-view-model.ts`.
- Existing Payroll Register exists per run:
  - Preview route: `app/(dashboard)/[companyId]/payroll/runs/[runId]/report/page.tsx`
  - CSV export: `app/(dashboard)/[companyId]/payroll/runs/[runId]/report/export/route.ts`
  - Builder: `modules/payroll/utils/build-payroll-register-csv.ts`
- Current register computes `OTH` as residual amount, not explicit deduction-type breakdown.
- Existing payroll compute already stores useful metrics in payslip:
  - `overtimeHours`, `tardinessMins`, `undertimeMins`, `withholdingTax`
  - source: `prisma/schema/payroll.prisma`
- Salary history source is available:
  - `EmployeeSalaryHistory` model in `prisma/schema/employee.prisma`.
- Current 13th-month logic in `modules/payroll/actions/payroll-run-actions.ts` is:
  - `ytdRegularBasic / 12`, else prorated fallback based on coverage days.

## Delivery Strategy

Use incremental phases with explicit acceptance gates, and move reporting into a dedicated module (`/[companyId]/reports`) while preserving existing payroll/statutory outputs during migration.

## Proposed Workstreams

## WS0: Dedicated Reports Module Foundation

### Scope

- Create company-scoped reports route group and module structure.
- Migrate payroll reports entry-point from payroll submenu to reports module navigation.
- Keep backwards compatibility redirects from legacy `/payroll/statutory` route during rollout.

### Proposed files

- `app/(dashboard)/[companyId]/reports/page.tsx`
- `app/(dashboard)/[companyId]/reports/payroll/page.tsx`
- `modules/reports/payroll/components/*`
- `modules/reports/payroll/utils/*`
- `modules/navigation/sidebar-config.ts` (new Reports section)

### Acceptance criteria

- Users with reports access can open reports from dedicated module.
- Existing payroll report links continue to work during transition.

## WS1: Shared Report Filters and Contracts

### Scope

- Add a shared report filter schema module for:
  - `companyId`, `year`, `month`, `startDate`, `endDate`, `payPeriodId`, `topN`, `includeTrialRuns`.
- Enforce zod validation for each report fetch/action before DB reads.
- Keep typed result contracts so client UI logic is predictable.

### Proposed files

- `modules/payroll/reports/schemas/report-filter-schemas.ts`
- `modules/payroll/reports/types/report-view-models.ts`
- `modules/payroll/reports/utils/report-time-utils.ts`

### Edge cases

- Invalid month/year combinations.
- `startDate > endDate`.
- PH date boundaries crossing UTC day shift.
- Empty result sets.

## WS2: Salary History Report (Date Range)

### Scope

- Add salary history report with date-range filter.
- Source table: `EmployeeSalaryHistory`.
- Include at minimum:
  - employee number/name
  - effective date
  - previous salary
  - new salary
  - delta amount
  - adjustment type
  - reason/remarks
  - created timestamp
- Filters:
  - date range (effective date, PH semantics)
  - optional employee
  - optional department

### Data notes

- Department context for a salary event can be:
  - current department (faster), or
  - historical department as-of effective date (more accurate).
- Recommendation: deliver v1 with current department and mark historical department as v1.1 improvement unless required immediately.

### Edge cases

- First salary record has `previousSalary = null`.
- Multiple salary changes on same effective date.
- Inactive employees should still appear for historical accuracy.
- Imported records missing adjustment type/reason.

### Acceptance criteria

- Date range is inclusive and PH-local correct.
- Exported data matches UI rows.
- No cross-company leakage.

## WS3: Payroll Register per Department

### Scope

- Extend existing Payroll Register to support stronger department-centric reporting:
  - Department filter.
  - Department subtotals.
  - Grand total + headcount.
  - CSV parity with preview.

### Required fix

- Remove residual generic `OTH` behavior.
- Replace with explicit "Additional Deductions" structure (see WS6).

### Data notes

- Current register uses employee's current department relation.
- Historical risk: department changes after payroll run can distort old reports.
- Recommendation: plan snapshot strategy for department-at-payslip-time to improve historical integrity.

### Edge cases

- Employees without department (`UNASSIGNED` bucket).
- Department renamed/deactivated after run.
- Runs with no payslips.

## WS4: Monthly BIR WTax Report

### Scope

- Add monthly withholding tax report, separate from annual BIR alphalist.
- Group and display by employee for a selected `year + month`, based on pay period cutoff end date.
- Show:
  - employee number/name
  - TIN
  - department
  - run references included in month
  - monthly WTAX total

### Data source

- Payslip `withholdingTax` + payroll run + pay period + employee government IDs.
- Default source: regular runs only.
- Optional switch: include trial runs (off by default, explicit label).

### Edge cases

- Missing TIN.
- Negative/zero WTAX months.
- Multiple runs in same month.
- Cross-year month selection.

### Acceptance criteria

- Monthly total equals sum of selected payslips for that month.
- CSV/print output totals match screen.

## WS5: Late + Overtime Totals Report

### Scope

- Add pay-period analytics report for:
  - total late minutes
  - total overtime hours
  - total overtime pay
  - total late deduction amount
- Add rankings:
  - top employees for late and overtime
  - top departments for late and overtime

### Computation source

- Preferred source: payslips in selected pay period:
  - `tardinessMins`
  - `overtimeHours`
  - overtime earning line amount
  - tardiness deduction line amount
- Why: aligns with posted payroll numbers and avoids DTR-vs-payroll mismatch.

### Edge cases

- Employees with OT hours but OT pay zero (eligibility/policy).
- Late minutes with no tardiness deduction due to threshold rules.
- Ties in top rankings.
- Department changes after run (same snapshot concern as WS3).

### Acceptance criteria

- Report totals reconcile with selected payslip set.
- Ranking logic is deterministic (stable sort for ties).

## WS6: Additional Deductions Must Be Comprehensive (No Generic Others)

### Scope

- Replace `OTH` residual in register with explicit breakdown of non-core deductions.

### Proposed model

- Keep core fixed columns:
  - SSS, PHI, HDMF, TAX, SSSL, ABS, LTE, UT
- Add dynamic additional deduction columns by deduction type (excluding core types), sorted by code/name.
- Add `ADDL_TOTAL` as sum of dynamic additional columns.
- Keep row-level details available in print/CSV for audit readability.
- Include dynamic non-core earnings visibility (allowances/adjustments/etc.) with the same deterministic ordering strategy.

### Implementation points

- Refactor `modules/payroll/utils/build-payroll-register-csv.ts`:
  - stop residual computation from `totalDeductions`.
  - build totals from actual deduction lines.
- Update preview in `modules/payroll/components/payroll-register-preview-client.tsx`.
- Update CSV headers and totals to match dynamic columns.

### Edge cases

- Same deduction type appears with different descriptions.
- Legacy deduction lines without reliable deduction type code.
- Extremely wide CSV due to many deduction types.

### Acceptance criteria

- `OTH` column removed or retained only as transitional alias with value `0.00`.
- Every additional deduction is traceable to at least one explicit type/column.
- Manual review-step adjustments are visible under explicit deduction/earning columns.

## WS7: 13th Month Separate Rule for `TWC`

### Scope

- Add TWC-specific 13th-month formula at company-policy level:
  - `Gross Payslip Earnings / 12`, with proration.
- Preserve existing non-TWC logic and legal default behavior for other companies.

### Compliance note

- Legal baseline for 13th-month in PH is tied to basic salary; TWC gross-earnings basis should be treated as company-specific policy override and clearly documented in payroll policy/audit trace.

### Proposed logic (target behavior)

- If active company has 13th-month formula policy `GROSS_PAYSLIP_EARNINGS`:
  - compute covered gross earnings for qualified regular payrolls in coverage window (earned-to-date only).
  - divide by 12.
  - coverage window remains hire/separation aware.
- Else:
  - retain current formula (`ytdRegularBasic/12` or prorated fallback).

### Company Identification Strategy

- Do not hardcode company name checks inside payroll compute.
- Add explicit company-level payroll policy flag for 13th-month formula.
- Seed Tropicana Worldwide Corporation to use `GROSS_PAYSLIP_EARNINGS`.
- Other companies default to current `BASIC/YTD` computation.

### Data/model impact

- Locked: add policy fields to existing payroll policy payload/storage, not a new standalone model.
- Example policy enum:
  - `BASIC_YTD_OR_PRORATED` (current default)
  - `GROSS_PAYSLIP_EARNINGS` (TWC)

### Edge cases

- Employee moved into/out of TWC mid-year.
- Missing salary periods.
- Trial run vs regular run behavior.
- Re-runs after adjustment.
- Retro salary adjustments after earlier periods already closed.

### Acceptance criteria

- Non-TWC employees remain unaffected.
- TWC 13th-month calculation trace explicitly shows formula path.
- Result is reproducible from trace data.

## WS8: Historical Department Snapshot Integrity

### Why

- Current report joins department via current employee relation.
- Historical reports can drift when employees transfer departments after run posting.

### Option A (recommended)

- Add snapshot fields to `Payslip` (migration, no new model required):
  - `departmentIdSnapshot` (nullable)
  - `departmentNameSnapshot` (nullable)
- Populate snapshot at payroll compute time.
- Reports read snapshot first, fallback to current relation only for legacy rows.

### Option B

- Create a separate snapshot table for reporting context.
- More flexible, but higher implementation and query complexity.

### Recommendation

- Use Option A now for speed + integrity.
- This is a Prisma migration, but not necessarily a new Prisma model.

### Edge cases

- Legacy payslips without snapshot values.
- Department renamed after snapshot.
- Null department at run time.

## UI/UX Integration Plan

- Build reports in dedicated module (`/[companyId]/reports/payroll`) with payroll-focused tabs/cards.
- Maintain redirect from `/[companyId]/payroll/statutory` during transition.
- Add new report keys in payroll reports client:
  - `salary-history`
  - `bir-monthly-wtax`
  - `late-overtime`
  - updated `payroll-register` behavior
- Maintain current visual language:
  - compact table style
  - immediate filter apply where appropriate
  - print and CSV parity

## Security and Tenant Boundaries

- Enforce active company context for every report query.
- Enforce role checks:
  - reports module gate (`reports`) for dedicated reports routes.
  - payroll module checks for payroll-mutation endpoints.
- Scope all reads by `companyId`.
- Add audit logs for export actions (CSV/print endpoints).

## Performance Notes (Vercel Skill Alignment)

- Start independent queries early and await late.
- Use `Promise.all` for independent data fetch branches.
- Keep heavy aggregation server-side.
- Paginate high-cardinality reports:
  - salary history
  - late/overtime rankings
- Avoid sending full record arrays to client when server-side pagination can be used.

## Test Plan

## Unit tests

- Register deduction classification and dynamic-column builder.
- Monthly WTAX aggregation by month/year.
- Late/OT ranking helpers and tie-break behavior.
- TWC 13th-month formula helper, including proration.

## Integration tests

- Report actions with authz + company scoping.
- Trial-run toggle behavior.
- Salary history filters and date boundary correctness.
- Payroll register export columns and totals parity.

## E2E tests

- Payroll report workspace:
  - open each new report
  - apply filters
  - verify totals
  - export CSV
- 13th-month run:
  - TWC employee vs non-TWC employee expected output.

## Rollout Phases

## Phase 1: Data and Contracts

- WS0 + WS1 + WS2 server/query contracts.
- Add test scaffolding for report aggregators.

## Phase 2: Register and WTAX

- WS3 + WS4 implementation.
- Remove generic `OTH` and ship explicit deduction breakdown.

## Phase 3: Late/OT Analytics

- WS5 with top employee/department rankings.

## Phase 4: TWC 13th-month Rule

- WS7 compute update + trace visibility + regression tests.

## Phase 5: Snapshot Integrity + Hardening

- WS8 snapshot rollout + legacy fallback behavior.
- Full quality gates: `typecheck`, `lint`, `test`, `build`.
- UAT with sample companies and historical data.

## Key Risks and Mitigations

- Historical department accuracy risk:
  - Mitigation: WS8 payslip department snapshot fields + fallback strategy.
- Ambiguous TWC definition risk:
  - Mitigation: company-level policy flag with Tropicana-specific configuration.
- CSV width/readability risk for many deduction types:
  - Mitigation: add `ADDL_TOTAL` plus optional detailed breakdown export mode.

## Decisions Needed Before Implementation

- None (all current scope decisions are locked for execution).
