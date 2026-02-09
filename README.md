# Final Payroll System

Multi-company payroll and HR platform built with Next.js, TypeScript, Prisma, and next-auth.

## Tech Stack

- Next.js `16.1.6` (App Router)
- TypeScript (strict)
- next-auth `5.0.0-beta`
- Prisma + PostgreSQL
- shadcn/ui + Tabler Icons
- Framer Motion
- Sonner (toast notifications)

## Core Architecture

- Multi-tenant by company (`companyId`-scoped reads/writes)
- Company-aware routing (`/[companyId]/...`)
- Employee portal routing (`/[companyId]/employee-portal/...`) with EMPLOYEE-only workspace enforcement
- Company-scoped role access (`UserCompanyAccess.role`)
- Module/domain-based organization (`modules/*`)
- Typed server actions + Zod validation

## What Is Implemented So Far

### 1) Authentication and Session

- Credentials login with next-auth
- NextAuth catch-all API route configured
- Session/JWT extended with company fields (role, selected/default company, employee IDs)
- Tight redirect handling for login/root/legacy dashboard routes
- Force logout for invalid/malformed session states
- Session membership checks against active user/company access

### 2) Security and Session Controls

- Auto logout on inactivity (30 minutes)
- Server-side session expiry (30-minute max age)
- Active-session keepalive while user is using the app
- Dedicated logout route with animated forced-logout UX

### 3) Audit Logging Pattern

- Reusable audit utility: `modules/audit/utils/audit-log.ts`
- Structured audit payload (table, record, action, reason, field-level changes)
- Request metadata helper (IP/User-Agent)
- Applied to auth and company-switch actions

### 4) Multi-Company Context

- Active company resolver utility
- Company switcher integrated in sidebar
- Selected company persistence per user

### 5) Dashboard

- Canonical dashboard route: `/[companyId]/dashboard`
- Action Center layout integrated
- DB-backed dashboard data loader
- Timekeeping completion computed from active pay period (company-scoped)
- Critical action stats + cycle readiness wired to live data

### 6) Sidebar and Navigation

- Sidebar regrouped into:
  - Employees
  - Time Keeping
  - Payroll
  - Leave & Overtime
  - System Settings
- Removed old `nav-projects` section
- Tree-branch style company dropdown list
- Sidebar route config centralized in `modules/navigation/sidebar-config.ts`
- Proxy authz checks now use the same route-role mapping as sidebar config

### 7) Company Profile Module (New)

- Route: `/[companyId]/settings/company`
- Full company profile form mapped to Prisma company schema:
  - Identity/branding
  - Registration and government IDs
  - Classification and fiscal setup
  - Primary address/contact/email
- Server action for updates with:
  - Zod validation
  - company-scoped authz guard
  - transactional update/upsert for primary contact records
  - audit log write + path revalidation
- Compliance layout selected as the active design
- shadcn-style calendar picker for date of incorporation

### 8) Notifications and UX

- Sonner toaster mounted globally
- Save/reset flows use toast notifications
- Toast styling aligned with app tokens (not rich green)
- Toast icon placement adjusted to left with proper spacing

### 9) Organization Settings Module

- Route: `/[companyId]/settings/organization`
- Organization view now uses table-first UX for:
  - Departments
  - Divisions
  - Ranks
  - Branches
- Each section has its own dialog form (create/update)
- Edit action is enabled and pre-fills dialog data from selected row
- Save flow refreshes page data immediately after successful upsert
- Dedicated entity list routes also available:
  - `/[companyId]/settings/organization/departments`
  - `/[companyId]/settings/organization/positions`
  - `/[companyId]/settings/organization/branches`
  - `/[companyId]/settings/organization/divisions`
  - `/[companyId]/settings/organization/ranks`

### 10) Employment Settings Module (New)

- Route: `/[companyId]/settings/employment`
- Added centralized management page for:
  - Positions
  - Employment Statuses
  - Employment Types
  - Employment Classes
- Added table-level search and active/inactive filtering per section.
- Added server-side deactivation guardrails that block deactivation when records are still assigned to active employees.
- Added company-scoped, authz-protected upsert actions and view-model loader with audit logging.
- Added navigation entry under System Settings: `Employment Setup`.

### 10) Payroll Policies Module

- Route: `/[companyId]/settings/payroll`
- Payroll policies now use one unified form with monthly period rows:
  - Single policy header + rules section
  - Per-period row editor for first and second half cycles (month-by-month)
  - Row-level cutoff start/end/payment dates
  - Row-level status and working days
  - Year-specific rows managed via top year selector
  - Pay period container header shows selected year (for example: `Pay Period Rows (2026)`)
  - Dedicated `Archive Year` action in the period rows header (locks selected year to `LOCKED`)
  - Separate save actions in UI:
    - `Save Pattern` for pattern-level fields
    - `Save Period Rows` for per-period row dates/status
  - Table row layout remains the active experience
- Policy form covers pay-period pattern fields:
  - Pattern identity (`code`, `name`, `description`)
  - Pay frequency and periods/year
  - Payment day offset
  - Effectivity window (`effectiveFrom`, `effectiveTo`) with calendar picker
  - Active toggle
- Server action validates and upserts company-scoped `PayPeriodPattern`
- Server actions now include:
  - `updatePayrollPoliciesAction` for pattern + rows (existing flow)
  - `savePayrollPeriodRowsAction` for rows-only persistence (new)
  - `archivePayrollYearAction` for year lock/archive (new)
- Audit log + revalidation included after save

### 23) Payroll Module Bootstrap (In Progress)

- Added initial active payroll routes:
  - `/[companyId]/payroll`
  - `/[companyId]/payroll/runs`
  - `/[companyId]/payroll/runs/new`
  - `/[companyId]/payroll/runs/[runId]`
- Added initial payroll run lifecycle actions in `modules/payroll/actions/payroll-run-actions.ts`:
  - `createPayrollRunAction`
  - `validatePayrollRunAction`
  - `calculatePayrollRunAction`
  - `closePayrollRunAction`
  - `reopenPayrollRunAction`
- Added payroll module scaffolding for schemas, view-model loaders, and client run forms/details in `modules/payroll/**`.
- Added payroll validation utility (`modules/payroll/utils/validate-payroll-run.ts`) and wired it into run validation action with:
  - concurrent-run and pay-period-state checks
  - step sequence checks
  - employee readiness checks (salary/work schedule/pattern match)
  - pre-payroll DTR/leave/overtime diagnostics summary for validation notes
- Upgraded `calculatePayrollRunAction` toward reference parity with company-scoped batch computation behavior:
  - richer attendance-driven pay computation (rest days/holidays/paid-leave handling, overtime multipliers, night differential, tardiness/undertime rules)
  - statutory deductions (`SSS`, `PhilHealth`, `Pag-IBIG`, `withholding tax`) with semi-monthly contribution split behavior
  - withholding tax now resolves from active statutory `TaxTable` flex-rule rows (`baseTax + excess * taxRate`) using the latest effective tax-table set for the pay frequency
  - recurring deduction applicability and percentage-base handling (`GROSS`/`BASIC`/`NET`) per deduction settings
  - loan amortization deductions now apply in priority order with payroll-linked `LoanPayment` records and loan balance/status updates
  - prior manual adjustment line items are now carried over across recalculation reruns
  - structured payslip line item persistence via `PayslipEarning` and `PayslipDeduction`
  - stronger process-step transitions (`PROCESSING -> COMPUTED`) with failed-step fallback and audit entries
- Added configurable statutory deduction timing policy in Payroll Settings (`PayPeriodPattern.statutoryDeductionSchedule`) so semi-monthly contribution timing is policy-driven instead of hardcoded.
  - Default schedule kept as current policy: `SSS=SECOND_HALF`, `PhilHealth=FIRST_HALF`, `Pag-IBIG=FIRST_HALF`, `Withholding Tax=EVERY_PERIOD`.
  - Payroll calculation now reads this policy and applies statutory deductions per configured timing.
- Added active payroll adjustments route and actions:
  - route: `/[companyId]/payroll/adjustments`
  - company-scoped manual payslip adjustment actions (add/remove earning or deduction adjustment lines)
  - adjustment-aware payslip/run totals recalculation with audit logging and revalidation
- Added active payroll payslips routes and loaders:
  - `/[companyId]/payroll/payslips`
  - `/[companyId]/payroll/payslips/[payslipId]`
  - run-filtered payslip listing, detailed line-item view, and direct review flow links to adjustments
  - added admin PDF download endpoint: `/[companyId]/payroll/payslips/[payslipId]/download`
- Added active payroll statutory reporting route:
  - `/[companyId]/payroll/statutory`
  - statutory reports workspace now uses locked Iteration 3 UX (left report selector + right report detail/preview)
  - includes printable/exportable report flows for:
    - `SSS Monthly Remittance`
    - `PhilHealth EPRS Remittance`
    - `Pag-IBIG MCRF (Contributions)`
    - `DOLE 13th Month Pay Report`
    - `BIR Annual Alphalist`
  - PhilHealth/Pag-IBIG/BIR now support print-ready report layouts and styled CSV export outputs
  - monthly statutory report source rows are safeguarded to `REGULAR` payroll runs only
  - statutory report currency labels use `PHP` code format consistently
  - report print behavior is now report-scoped (prints report content only, not full app chrome)
  - report print defaults include landscape paper mode, print footer metadata, and print-only metadata visibility
- Hardened payroll lifecycle stage transitions and gating:
  - added `completeReviewPayrollRunAction` (step 4 -> step 5 progression with validation checks)
  - added `generatePayslipsPayrollRunAction` (step 5 completion with payslip presence check, no auto-advance)
  - tightened `closePayrollRunAction` gating to require generate-payslips completion before close
  - added `proceedToClosePayrollRunAction` so payslip generation and close-step progression are explicitly separated
- Reworked payroll run detail UX to reference-style process flow using project default fonts/sizes/colors:
  - process stepper and step-specific panes (`validate`, `calculate`, `review/adjust`, `generate payslips`, `close`)
  - richer review register table with discrepancy filter, expandable earnings/deductions breakdown, and adjustment link flow
- Applied run-detail UX polish feedback:
  - removed duplicate top payroll run header and removed run snapshot block
  - updated validation log container to rounded/default styling with standard spinner loading state
  - refined validation status summary container presentation
  - reduced process stepper height for tighter vertical density
  - rounded process-stepper icon containers and increased step label size for clearer scanability
  - review-step adjust action now opens an inline adjustment dialog (matching reference interaction) instead of route redirect
  - switched adjustment dialog type input back to shadcn `Select` and set `SelectTrigger` width to full
  - added earning/deduction icons in adjustment-type select trigger and menu options
  - resolved duplicate icon rendering in adjustment-type select by keeping icon in the selected-value area only
  - adjusted adjustment dialog form to 2-column grid for `Type` and `Amount` fields
- Added statutory deduction diagnostics for troubleshooting missing mandatory deductions:
  - validation step notes now store statutory schedule applicability + active table counts per deduction type
  - calculation step notes now store per-type applied/skipped/no-bracket aggregate diagnostics
  - run detail view now surfaces a compact statutory diagnostics summary panel
  - fixed statutory deduction table lookup to match by effective date overlap (including historical version rows), not `isActive` flag only
- Updated validation workflow behavior to prevent immediate auto-step jump:
  - successful validation now remains on step 2 for review
  - added explicit proceed action/button to move from validation to calculation
- Updated calculation workflow behavior to prevent immediate auto-step jump:
  - successful calculation now remains on step 3 for review
  - added explicit proceed action/button to move from calculation to review/adjust
  - calculate step now shows employee-level calculated gross/deductions/net summary after run
  - removed run-detail statutory diagnostics strip during calculate flow and rounded calculate-step containers for cleaner review UI
- Updated Validate-step review experience:
  - removed statutory diagnostics block from validation summary panel
  - added employee-level attendance validation summary table (present/absent/tardiness/undertime/OT/CTO conversion hours)
- Reworked payroll runs page UX toward reference structure while keeping project default design tokens:
  - extracted runs list client with search/filter toolbar and workflow progress indicators
  - updated run table to reference-style cycle columns and action affordances
  - added run stat cards and aligned form/button controls to default sizing and color system
  - removed residual custom sizing classes on runs search/filter controls to keep strict default control sizing
  - added proper stat-card icons and switched aggregate currency labels to `PHP` code display
  - replaced runs-page create navigation with dialog-based payroll run creation flow
  - create-run form now defaults to the earliest OPEN pay period (lock-state progression), not current date
  - pay period field in create-run form is now a disabled display input (system-selected), not a user-selectable dropdown
  - pay period field now includes an info tooltip explaining unlocked-period auto-selection policy
- Current implementation is an active scaffold phase and will be expanded to full reference business-logic parity.
 - Added run-type-specific bonus calculations:
   - `THIRTEENTH_MONTH`: computes 13th month pay using YTD regular basic pay / 12, with prorated fallback for employees without regular-run history yet.
   - `MID_YEAR_BONUS`: computes fixed policy bonus as half of employee base salary (`baseSalary / 2`).
   - Bonus runs (`THIRTEENTH_MONTH`, `MID_YEAR_BONUS`) use pay period as context only and do not lock pay periods.

### 11) Work Schedules Module (New)

- Route: `/[companyId]/settings/attendance`
- Work schedules now have a dedicated settings page with:
  - Work schedules table for selecting existing schedules and creating a new schedule draft
  - Schedule identity (`code`, `name`, `description`, `scheduleTypeCode`)
  - Work policy defaults (`workStartTime`, `workEndTime`, break + grace + required hours)
  - Per-day matrix (Monday-Sunday) with row-level working toggle + configurable time in/time out
  - Effectivity dates with calendar pickers (`effectiveFrom`, `effectiveTo`)
  - Active toggle and reset/save flows with Sonner feedback
- Added company-scoped work schedules view model loader:
  - `modules/settings/attendance/utils/get-attendance-rules.ts`
- Added validated work schedule upsert action with:
  - Zod input validation
  - company-scoped authz guard
  - audit log write
  - revalidation after save
  - file: `modules/settings/attendance/actions/update-attendance-rules-action.ts`

### 12) Statutory Tables Module (New)

- Route: `/[companyId]/settings/statutory`
- Quick setup tabs for government-mandated contributions:
  - `SSS` bracket table
  - `PhilHealth` premium table
  - `Pag-IBIG` bracket table
  - `WTAX (Semi-Monthly)` bracket table
- Includes simple row-based editing with add/remove actions and one Save flow.
- WTAX tab supports loading semi-monthly default brackets based on flex-rule style computation:
  - `baseTax + (taxableIncome - excessOver) * taxRatePercent`
  - round-up at 2 decimals is noted in the UI guidance.
- WTAX now includes `BIR 2023` flex-rules mode with optional lock toggle:
  - `Load BIR 2023 Flex Rules`
  - `Lock flex rules` to prevent accidental bracket edits.
- Added validated server save action with authz, audit logging, and revalidation:
  - `modules/settings/statutory/actions/upsert-statutory-tables-action.ts`
- Added view-model loader that hydrates latest active statutory versions:
  - `modules/settings/statutory/utils/get-statutory-tables.ts`

### 13) Employees Module (Onboarding + Masterlist + Profile)

- Onboarding route: `/[companyId]/employees/onboarding`
  - Practical 2-step flow (`Identity + Contact + Uploads`, `Employment + Payroll + Tax`)
  - Profile image and scanned document uploads
  - Confirm dialog before create (name-focused confirmation)
  - Friendly Sonner/Zod error messaging
  - Persistence includes employee, contact/email/address, salary, masked government IDs, emergency contact, and documents
- Masterlist route: `/[companyId]/employees`
  - Reference-matched admin list layout adapted to app defaults (fonts/colors/sizes)
  - Search/filter UX + company-scoped live data
  - Action column routes to employee profile page (`View Profile`)
- Employee profile route: `/[companyId]/employees/[employeeId]`
  - Tabbed 201 profile UX (Overview, Personal, Education & Family, Employment, Payroll, Medical, Qualifications, History, Documents)
  - Same-field inline edit mode (edit in place; no separate edit page)
  - Lookup-backed select editing (employment org fields, statuses, tax status, etc.)
  - Date editing via shadcn `Calendar` popovers for profile date fields
  - Work schedule selection auto-populates work start/end, hours/day, and grace period in edit draft
  - Expanded editable payroll fields (base/daily/hourly, divisor, hours/day, salary grade/band, min wage region)
  - Expanded editable personal/government fields (religion, blood type, birth date, height/weight, TIN/SSS/PhilHealth/Pag-IBIG/UMID)
  - Save action with company-scoped authz, zod validation, audit log, and revalidation
  - Profile edit now auto-writes movement history rows when changed in edit mode for:
    - salary (`EmployeeSalaryHistory`)
    - position (`EmployeePositionHistory`)
    - employment status (`EmployeeStatusHistory`)
    - rank (`EmployeeRankHistory`)
  - Employment tab layout updated so Employment Details uses a 5-column row layout on large screens.

- Onboarding step 2 enhancements:
  - Payroll section now auto-computes Daily/Hourly rates from Monthly Rate using annualized divisor formula:
    - `dailyRate = (monthlyRate * 12) / monthlyDivisor`
    - `hourlyRate = dailyRate / hoursPerDay`
  - Daily/Hourly are display-only in onboarding and auto-filled from Monthly Rate.
  - Monthly Divisor and Hours/Day are shown as disabled defaults in onboarding payroll form.
  - Step 2 select inputs now support inline dynamic creation via in-page add dialog for:
    - employment status, type, class
    - department, division, position, rank, branch

### 14) Attendance Operations (DTR + Biometrics + Leave Calendar)

- Daily Time Record route: `/[companyId]/attendance/dtr`
  - Directory View + Individual Calendar + Workbench tabs (reference-inspired layout, adapted to app defaults)
  - Date-range filtering, employee search, pagination, CSV export
  - Row/calendar manual correction sheet (status/time/remarks) with schedule autofill helper
  - Calendar now supports creating a DTR from empty dates (not only existing records)
  - Time display aligned to intended biometric clock values in Directory and Individual Calendar views
- Manual DTR corrections now require elevated roles and are approved immediately:
  - Allowed roles: `COMPANY_ADMIN`, `HR_ADMIN`, `PAYROLL_ADMIN`, `SUPER_ADMIN`
  - Action enforces role checks in-server and writes audit logs
- Sync Biometrics route: `/[companyId]/attendance/sync-biometrics`
  - `.txt` biometric import with parsing, validation, and DTR upsert processing
  - Old `/attendance/exceptions` path now redirects to sync biometrics route
- Leave Calendar route: `/[companyId]/attendance/schedules`
  - Full calendar-grid view (all employees) of submitted leave requests, including pending status
  - Date panel shows employee, leave type, status, half-day details, and reason

### 15) Approval Queue (HR Final Stage)

- Route: `/[companyId]/approvals`
- Queue now loads only `SUPERVISOR_APPROVED` leave/overtime requests for final HR validation.
- Final action server flows implemented for both request types:
  - Approve and Reject with required HR remarks/rejection reason
  - Status transition: `SUPERVISOR_APPROVED -> APPROVED | REJECTED`
  - HR-stage field updates (`hrApproverId`, `hrApprovedAt`/`hrRejectedAt`, `hrApprovalRemarks`/`hrRejectionReason`)
  - In-server role checks for final stage (`COMPANY_ADMIN`, `HR_ADMIN`, `PAYROLL_ADMIN`, optional `SUPER_ADMIN`)
  - Audit log writes + route revalidation
- Queue UI now includes row-level details drawer (supervisor remarks, filed date, schedule/duration, reason) and wired approve/reject dialogs.

### 16) Employee Portal (Self-Service)

- Dedicated employee portal route tree:
  - `/[companyId]/employee-portal`
  - `/[companyId]/employee-portal/leaves`
  - `/[companyId]/employee-portal/overtime`
  - `/[companyId]/employee-portal/payslips`
  - `/[companyId]/employee-portal/profile`
- EMPLOYEE-only workspace enforcement:
  - Logged-in users with role `EMPLOYEE` are redirected to portal routes for company-scoped paths.
  - Non-EMPLOYEE roles are redirected out of employee portal layout.
- Self-service request actions implemented:
  - Leave submit/cancel (tenant-scoped + audit log)
  - Overtime submit/cancel (tenant-scoped + audit log)
- Payslips experience now includes:
  - interactive details dialog
  - server-side PDF generation via Playwright (HTML/CSS template)
  - secure employee-scoped download endpoint
  - download audit metadata capture (`IP`, `User-Agent`) via audit log entries
  - branded PDF output with company logo support, signatory blocks, and optional watermark (`PAYSLIP_PDF_WATERMARK` fallback)

### 21) Company-Level Payslip Watermark Setting (New)

- Added a company profile setting field: `Payslip Watermark Text` under Settings > Company > Company Identity.
- Payslip PDF generation now resolves watermark text in this order:
  - `Company.payslipWatermarkText` (per-company UI setting)
  - `PAYSLIP_PDF_WATERMARK` (environment fallback)
  - no watermark if both are empty.

### 17) Leave Balance Initialization (New)

- Settings route now includes a manual yearly initialization action:
  - `/[companyId]/settings/leave-overtime`
- Initialization service is company-scoped and year-scoped with PH year handling (`Asia/Manila`).
- Leave balances are seeded idempotently per `(employeeId, leaveTypeId, year)` from:
  - Active employees in the selected company
  - Active leave types (company + global)
  - Matching leave policies by employment status + effectivity window
- Proration logic is applied based on `LeaveProrationMethod` for in-year hires.
- Prior-year carry-over is applied using leave type carry-over settings and max cap.
- Initialization writes leave balance ledger rows (`LeaveBalanceTransaction`) for carry-over and entitlement credits.

### 18) Leave Balance Lifecycle on Requests (New)

- Leave request submission now reserves leave credits immediately:
  - `pendingRequests` increases
  - `availableBalance` decreases
- Employee cancellation of a pending request releases the reserved credits back.
- HR final approval now consumes reserved credits:
  - `creditsUsed` increases
  - `currentBalance` decreases
  - `pendingRequests` decreases
- HR final rejection now releases reserved credits back to available balance.
- All leave balance mutations are transaction-safe and write `LeaveBalanceTransaction` ledger entries with request references.
- Cross-year leave requests are temporarily blocked (submit separate requests per year) to keep yearly balance accounting consistent.

### 20) Overtime-to-CTO Conversion Policy (New)

- Overtime requests now enforce a minimum duration of 1 hour.
- On HR final approval, overtime requests are converted to CTO leave credits (1:1) when either condition is true:
  - Employee is not overtime-pay eligible, or
  - Employee is supervisor-and-up (detected by having active direct reports)
- CTO conversion writes to leave balances (`creditsEarned`, `currentBalance`, `availableBalance`) and records a `LeaveBalanceTransaction` ledger entry with `OVERTIME_REQUEST` reference.
- If CTO leave type or yearly leave balance is missing, final approval returns a validation error and prevents inconsistent conversion.

### 19) Leave / OT Policies DB-Backed Settings (New)

- Settings route `/[companyId]/settings/leave-overtime` now loads live records instead of static table rows.
- Leave settings now persist:
  - Leave type fields (`code`, `name`, paid/carry-over/half-day/approval/active flags)
  - Primary leave policy fields (`employmentStatus`, `annualEntitlement`, accrual/proration methods, effective-from)
- Overtime settings now persist `OvertimeRate` records (`overtimeTypeCode`, multiplier, active flag, effective-from, description).
- Added server-side schemas and actions with company-scoped authz checks and audit log writes.

## Directory Highlights

- `app/(dashboard)/[companyId]/...` - company-scoped pages
- `modules/auth/*` - auth/session/company access utilities and actions
- `modules/dashboard/*` - dashboard UI and data loader
- `modules/settings/company/*` - company profile schemas/actions/components
- `modules/settings/organization/*` - organization overview tables, dialogs, and entity actions
- `modules/settings/payroll/*` - payroll policy schemas/actions/components
- `modules/navigation/sidebar-config.ts` - nav + role mapping source of truth
- `modules/audit/utils/audit-log.ts` - reusable audit logger
- `modules/attendance/dtr/*` - DTR tabs, calendar, correction sheet, and action utilities
- `modules/attendance/sync/*` - biometric import UI and sync action
- `modules/attendance/leaves/*` - leave calendar loader and UI
- `modules/approvals/queue/*` - leave/overtime HR approval queue data + UI
- `app/(employee-portal)/[companyId]/employee-portal/*` - employee self-service routes and layout
- `modules/employee-portal/*` - employee portal actions, schemas, UI clients, and PDF utility
- `prisma/schema/*` - modular Prisma schema by domain

## Module Access Matrix

Current company-scoped role policy:

| Module | COMPANY_ADMIN | HR_ADMIN | PAYROLL_ADMIN | APPROVER | EMPLOYEE |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Yes | Yes | Yes | Yes | Yes |
| Employees | Yes | Yes | No | No | No |
| Attendance | Yes | Yes | Yes | Yes | Yes |
| Leave | Yes | Yes | No | Yes | Yes |
| Overtime | Yes | Yes | Yes | Yes | Yes |
| Loans | Yes | Yes | Yes | Yes | Yes |
| Payroll | Yes | No | Yes | No | No |
| Reports | Yes | Yes | Yes | No | No |
| Settings | Yes | No | No | No | No |
| Approval Workflows | Yes | Yes | No | No | No |

Reference source: `modules/auth/utils/authorization-policy.ts`.

## Local Development

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

## Quality Checks

```bash
npm run lint
npx tsc --noEmit --pretty false
```

## Current To-Dos

Project backlog and active to-do list now live in `tasks/todo.md`.

- Priority focus has shifted to Payroll module build-out and payroll/DTR alignment.
- Payroll implementation policy source: `payroll-actions-reference/**` business logic.
- Payroll UI/route reference source: `payroll-page-reference/**` and `payroll-components-reference/**`.
- Implementation must follow this project's module/code structure (`modules/*`, `app/(dashboard)/[companyId]/*`) and not mirror reference folder structure directly.
- DTR policy note: manual DTR auto-approval is intentional for the HR-operated workflow.
- Approval direction: continue using `User.isRequestApprover` for approver assignment and access in current portal flows.
- Approval workflow engine expansion is currently out of scope.
- Final Pay / Separation Pay calculation policy is pending HR process confirmation before implementation in payroll run logic.

## Recent Changes

- 2026-02-09: Added Employment Setup module at `/[companyId]/settings/employment` with CRUD management for positions, employment status/type/class, table search/filter controls, and server-side deactivation guardrails for active employee assignments.
- 2026-02-09: Migrated `EmploymentStatus`, `EmploymentType`, and `EmploymentClass` to company-scoped models (`companyId`-scoped) with migration-based cloning/remapping, app query/action updates, and tenant-safety enforcement (`companyId + code` uniqueness).
- 2026-02-09: Added verification script `npm run verify:employment:scope` to validate company-scoping consistency (null-company checks, cross-company assignment mismatches, and per-company coverage counts).
- 2026-02-09: Enhanced employee profile edit flow to auto-create salary/position/status/rank history records on change and updated `Edit Record` primary action styling to blue.
- 2026-02-09: Enhanced onboarding Step 2 with computed payroll rates and dynamic select creation dialogs (with blue `+ Add` option) for employment/organization references.
- 2026-02-09: Implemented payroll run-type bonus calculations for `THIRTEENTH_MONTH` (with prorated fallback support) and `MID_YEAR_BONUS` (`baseSalary / 2`), while keeping bonus runs non-locking for pay periods.
- 2026-02-09: Added in-code TODO marker for `FINAL_PAY`/separation-pay calculation flow pending HR-approved business process and formula definition.
- 2026-02-09: Reworked statutory reports page to locked Iteration 3 design and added full printable report templates for PhilHealth, Pag-IBIG, and BIR Alphalist with print-only metadata footer and report-scoped print mode.
- 2026-02-09: Added styled CSV export output for PhilHealth, Pag-IBIG, and BIR reports to mirror report headings/column structure.
- 2026-02-09: Added statutory safeguard so monthly contribution reports only source rows from `REGULAR` payroll runs.
- 2026-02-09: Upgraded BIR annual alphalist computation to use annual WTAX table logic (gross compensation, mandatory contributions, non-taxable benefit cap, taxable compensation, annual tax due, and tax variance vs withheld).
- 2026-02-09: Refined payroll withholding computation to use annual-projected WTAX delta method when annual tax-table rows are available, with period-bracket fallback behavior when annual tables are unavailable.
- 2026-02-09: Added full HTML report templates for `SSS Monthly Remittance` and `DOLE 13th Month Pay Report` in statutory reports, matching print/export workflow used by PhilHealth/Pag-IBIG/BIR.
- 2026-02-09: Added compact BIR per-employee `Calc Trace` section (gross, non-taxable cap applied, taxable base, annual tax due, YTD withheld, delta) for HR audit visibility.
- 2026-02-09: Fixed annual withholding projection to include YTD pre-tax recurring deductions (not current-period only), preventing over-withholding on semi-monthly runs.
- 2026-02-09: Refactored statutory view-model data loading to use Promise.all for independent DB calls (`user`, `payslips`, `birPayslips`, `annualTaxRows`) for better performance.
- 2026-02-09: Reworked payroll payslips history page to bounded client-fetch architecture via `/api/payroll/payslips` (paginated/date-scoped slices) instead of serializing full payslip arrays from RSC.
- 2026-02-09: Added recurring deductions management page at `/[companyId]/payroll/recurring-deductions` with company-scoped create and status-management actions (activate/suspend/cancel), PH-local effective-date calendar inputs, payroll module authorization checks, and audit logging.
- 2026-02-09: Added payroll navigation entry for `Recurring Deductions` under Payroll module.
- 2026-02-09: Updated recurring deductions deduction-type selector behavior:
  - excluded government-mandated/system deduction types from selectable options on recurring deductions page.
  - added dynamic `+ Create Deduction Type` flow in selector via in-page dialog, with payroll-authz scoped server action and audit logging.
- 2026-02-09: Updated `Create Deduction Type` dialog layout so `Pay Period Applicability` and `Pre-tax deduction` render in a two-column grid for cleaner form density.
- 2026-02-09: Aligned `Pre-tax deduction` row height to match adjacent `Pay Period Applicability` select control in `Create Deduction Type` dialog.
- 2026-02-09: Refined `Create Deduction Type` two-column alignment by adding a matching label row and fixed-height controls (`h-9`) for both `Pay Period Applicability` and `Pre-tax Deduction` fields.
- 2026-02-09: Renamed `Pay Period Applicability` label to shorter `Payroll Timing` in `Create Deduction Type` dialog.
- 2026-02-09: Removed extra bordered container wrapper around `Pre-tax Deduction` checkbox row in `Create Deduction Type` dialog.
- 2026-02-09: Aligned `Pre-tax Deduction` checkbox row spacing with adjacent `Payroll Timing` select control (matching left inset and control row height).
- 2026-02-09: Refined recurring-deduction deduction-type selector:
  - excluded statutory/system deduction codes (including `SSS`, `PHILHEALTH`, `PAGIBIG`, `WTAX`) from available options.
  - simplified option labels to show deduction `name` only (no code prefix).
- 2026-02-09: Removed separate `Recurring Category` user input from recurring-deductions create flow; category is now derived internally from selected deduction type metadata.
- 2026-02-09: Updated recurring deductions page to use the same core UX layout pattern as Leave / OT Policies (left records list + right sticky form panel) for consistency across policy configuration screens.
- 2026-02-09: Enhanced recurring deductions table/form UX:
  - status badges now use solid semantic colors (`ACTIVE` green, `SUSPENDED` amber, `CANCELLED` red).
  - row selection now auto-populates the right-side form for editing existing recurring deductions.
  - added inline status filter button beside search.
  - action buttons adapt styling when row is selected within blue-highlight context.
- 2026-02-09: Adjusted recurring-deductions toolbar so filter control sits directly beside the search input with matched control height.
- 2026-02-09: Enabled reactivation path for cancelled recurring deductions from records table actions (`Reactivate` action now available for `CANCELLED` rows).
- 2026-02-09: Added idempotency hardening for critical payroll side effects:
  - close-run action now behaves idempotently for already-closed runs and uses guarded state transition update to prevent duplicate concurrent close transitions.
  - batch payslip email send now has a short duplicate-dispatch guard window to block accidental double-trigger sends.
- 2026-02-09: Added payslip email security hardening:
  - escaped dynamic email-template fields and sanitized subject lines to mitigate injection/XSS vectors.
  - switched preview rendering to sandboxed iframe-based HTML preview.
  - added server-side rate limiting and retry cooldown guards for batch send/retry email actions.
- 2026-02-09: Added backfill utility for legacy step-3 records (`npm run backfill:payroll:calc-meta`) so historical payroll runs receive `calculationVersion`, `formulaPolicy`, and `employeeCalculationTraces` metadata required by the PH audit harness.
- 2026-02-09: Verified post-backfill PH payroll audit returns clean (`failures: 0`, `warnings: 0`) on current local run dataset.
- 2026-02-09: Added calculation trace and formula version stamping in payroll calculation step notes (`calculationVersion`, `formulaPolicy`, `employeeCalculationTraces`) for auditability and dispute explainability.
- 2026-02-09: Extended PH payroll audit harness to verify presence/readability of calculation trace metadata in step-3 notes.
- 2026-02-09: Hardened payroll calculation edge handling for policy-risk scenarios:
  - DTR half-day detection now supports additional normalized markers (`[HALF_DAY]`, `HALF DAY`, `HALFDAY`).
  - `ON_LEAVE` DTR days without matching approved leave records are now treated as unpaid (instead of defaulting to payable).
  - Recurring deductions marked as pre-tax are now deducted from taxable income before withholding-tax computation.
- 2026-02-09: Completed quality-gate validation pass after payroll updates: repository-wide `eslint` and full `next build` now pass cleanly.
- 2026-02-09: Executed PH payroll audit sweep on available recent runs (current local dataset: `RUN-2026-00001`) with zero failures and zero warnings under refined policy checks.
- 2026-02-09: Refined PH payroll audit policy checks so paid-vs-locked enforcement applies to `REGULAR` runs only (trial/non-regular runs are evaluated without mandatory period lock failure).
- 2026-02-09: Added Philippines-focused payroll E2E audit harness script (`npm run audit:payroll:ph`) to validate DTR/payroll run consistency, PH statutory timing behavior, gross/deductions/net integrity, step progression gating, and lock-state policy checks on latest or specified run.
- 2026-02-09: Added per-payslip email preview-before-send flow in Generate Payslips step (HTML + plain-text preview modal with direct single-send action) to align with reference email preview method beyond batch send.
- 2026-02-09: Fixed `/login` prerender build blocker by wrapping login client flow in `Suspense` to satisfy `useSearchParams()` CSR-bailout requirements.
- 2026-02-09: Fixed `/logout` prerender build blocker by wrapping logout client flow in `Suspense` to satisfy `useSearchParams()` CSR-bailout requirements during static prerender.
- 2026-02-09: Fixed strict nullability in employee user-access approver update action by capturing linked-user identity before transaction usage (`employee.user` guarded then normalized to non-null locals), unblocking production build type-check path.
- 2026-02-09: Resolved payslip email action typing friction by using typed payload variables before `generatePayslipPdfBuffer` calls, keeping base-salary enriched PDF payloads while avoiding object-literal excess-property issues in strict TS editor checks.
- 2026-02-09: Improved payslip email template copy/content to reference-style wording: email now states payslip period context using period half + formatted pay period range (e.g., `Dec 23 to Jan 7, 2026`) instead of payroll run number phrasing.
- 2026-02-09: Updated payslip email delivery flow to follow reference batch-send method: confirmation dialog, progress UI, summary of sent/failed items, failed-email list, and per-item retry action.
- 2026-02-09: Updated Generate Payslips delivery actions to solid blue styling for `Download All Payslips`, `Send Payslips via Email`, and per-employee `Download` buttons.
- 2026-02-09: Updated payslip earnings/deductions panel alignment so totals separators align horizontally between `Gross Pay` and `Total Deductions` columns.
- 2026-02-09: Standardized attendance deduction display label in payslip output to `Tardiness` (aggregated from late/tardiness deduction lines).
- 2026-02-09: Corrected payslip `Basic Pay` display to use semi-monthly half of monthly base salary in the template output (instead of duplicating/mirroring gross figure in certain cases).
- 2026-02-09: Updated payslip deductions section styling and labels: reduced deduction line-item font size and standardized totals label to `Total Deductions`.
- 2026-02-09: Fixed payslip PDF details: removed duplicate `Basic Pay` line in earnings, and expanded deductions display to include attendance deductions (`Late/Tardiness`, `Undertime`) alongside pay-period statutory deductions.
- 2026-02-09: Updated generated payslip PDF formatting to follow the reference payslip template preview structure (clean white card, simple header, employee/pay-period blocks, split earnings/deductions table, and net-pay strip).
- 2026-02-09: Payslip PDF deductions section now shows only statutory deductions applicable to the pay period (SSS, PhilHealth, Pag-IBIG, Withholding Tax) with statutory total.
- 2026-02-09: Reworked payslip PDF template to match reference visual structure (black technical header, profile/pay-period split, earnings-vs-deductions grid, bold net disbursement totals band, and integrity footer) for download/email outputs.
- 2026-02-09: Aligned Review-step toolbar layout so `Generate Payroll Register Report` is right-aligned at the row end on desktop.
- 2026-02-09: Replaced Review-step `Discrepancies` toolbar button with `Generate Payroll Register Report`, and aligned search/report control heights while constraining employee search input width (no full-width desktop stretch).
- 2026-02-09: Moved Review-step `Generate Payroll Register Report` button outside and above the Run Totals card container.
- 2026-02-09: Updated Review-step `Generate Payroll Register Report` action to a solid blue button style for stronger primary-action emphasis.
- 2026-02-09: Repositioned `Generate Payroll Register Report` to the top of the Review-step Run Totals card container for faster access before final confirmation actions.
- 2026-02-09: Added payroll register legend section to both on-page report preview and print document output for reference parity.
- 2026-02-09: Updated payroll register report UX to match reference workflow: added `Back to Review`, removed card-like header wrapper, changed action colors (solid blue `Print`, solid green `Export CSV`), and switched print behavior to document-style register output in a dedicated print window.
- 2026-02-09: Added payroll register preview/print page at `/[companyId]/payroll/runs/[runId]/report` with reference-style register table and actions for `Print` plus `Export CSV`.
- 2026-02-09: Moved CSV export endpoint to `/[companyId]/payroll/runs/[runId]/report/export` so review-step report action opens preview/print first, then export remains available.
- 2026-02-09: Added Review-step payroll register report generation (CSV download) with department grouping, sub-totals, grand totals, and reference-aligned register columns; wired as direct export action after optional manual adjustments.
- 2026-02-09: Fixed Calculate step post-run rendering so calculated employee summary list remains visible after calculation completes (no longer hidden by persisted progress state).
- 2026-02-09: Payroll run status presentation now shows `LOCKED` (with lock icon) for closed/locked runs while preserving underlying persisted `PAID` state; updated run list/detail status UI to use icon badges and non-vertical status container.
- 2026-02-09: Centered the close-step `Period Locked` button alignment and switched close-step amount labels to `PHP` currency code display.
- 2026-02-09: Center-aligned close-step critical action text block (including locked-state message) for clearer visual emphasis.
- 2026-02-09: Added confirmation alert dialog for `Close Pay Period` and updated close-step copy/button state to show period is already locked after successful close.
- 2026-02-09: Moved `Export Payroll Register` action from Close step to Review step so register export stays in the review workflow context.
- 2026-02-09: Updated Generate Payslips flow to stay on step 5 after generation and require explicit proceed action before moving to Close step.
- 2026-02-09: Rounded Generate Payslips and Close step cards/containers to remove sharp-edge visuals in final payroll lifecycle steps.
- 2026-02-09: Updated Generate Payslips step to support in-step direct download (per employee and download-all) and send-by-email actions without redirecting to another page.
- 2026-02-08: Updated payslip adjust dialog trigger button to a blue primary visual state and aligned review-step monetary labels to `PHP` display expectations.
- 2026-02-08: Updated review-step `READY` badge to solid green (non-diluted) for clearer status contrast.
- 2026-02-08: Removed calculate-phase statutory diagnostics strip from run detail, rounded calculate-step containers, and kept employee-level calculation summary as the primary review output.
- 2026-02-08: Changed calculation flow to stay on Calculate step after success, added explicit proceed-to-review action, and surfaced employee-level calculation result summaries.
- 2026-02-08: Removed non-actionable error/warning count chips from Validate step panel to keep review focused on actionable details.
- 2026-02-08: Removed the "Latest Validation Summary" heading text from Validate step panel while keeping error/warning chips and detailed validation content.
- 2026-02-08: Fixed Validate-step attendance table runtime error for legacy validation notes by defaulting missing OT/CTO values to `0.00`.
- 2026-02-08: Updated Validate step output to show employee-level attendance summary (including OT/CTO conversion hours) and removed statutory diagnostics from the validation summary panel.
- 2026-02-08: Moved Statutory `effectiveFrom` calendar control beside section-level flex-rule actions and removed standalone Quick Setup labels block.
- 2026-02-08: Removed redundant statutory `effectiveYear` form input and now derive effective year from `effectiveFrom` (calendar date) for save and flex-rule preset behaviors.
- 2026-02-08: Removed card-like container wrappers from Statutory Tables quick setup and bracket sections, and switched effective date input to shadcn Calendar popover.
- 2026-02-08: Fixed payroll statutory table lookup in validation/calculation to use effective-date overlap instead of `isActive`-only filtering, preventing false zero-match diagnostics for historical/payroll-cutoff periods.
- 2026-02-08: Changed payroll validation flow to stay on Validate step after success and require explicit "Proceed to Next Step" action before calculation.
- 2026-02-08: Revised create-run pay period logic to default by pay-period lock progression (earliest OPEN period) instead of date-based selection, and changed pay-period input to disabled system-selected display field.
- 2026-02-08: Added pay-period selection policy tooltip to create payroll run form.
- 2026-02-08: Reworked payroll runs page list UX closer to reference structure with search/filter controls, workflow progress column, and richer row action layout.
- 2026-02-08: Added payroll runs stat cards and normalized runs-page controls to default size/color styling.
- 2026-02-08: Removed remaining custom sizing overrides on payroll-runs search/filter controls to use strict default field/button sizes.
- 2026-02-08: Added stat-card icons and changed aggregate currency display to `PHP` code format on payroll runs page.
- 2026-02-08: Switched payroll run creation from page navigation to in-page dialog flow on payroll runs page.
- 2026-02-08: Added auto-default pay-period selection in create payroll run form based on current open pay period (PH-local date), with next-open fallback.
- 2026-02-08: Polished payroll run detail UX by removing duplicate headers/snapshot block, smoothing validation log/status visuals, normalizing loading animation, and reducing process stepper height.
- 2026-02-08: Updated process stepper visuals with rounded icon containers and larger step labels for improved readability.
- 2026-02-08: Updated review-step adjustment interaction to use inline dialog-based editing flow for payslip adjustments.
- 2026-02-08: Updated payslip adjustment type input back to select control and set full-width select trigger.
- 2026-02-08: Added visual icons for earning/deduction options in payslip adjustment type select.
- 2026-02-08: Fixed duplicate icon rendering in payslip adjustment type select value.
- 2026-02-08: Updated adjustment dialog layout to a 2-column type/amount grid.
- 2026-02-08: Added statutory diagnostics in validation and calculation notes, and surfaced run-level diagnostics in payroll run detail to explain zero statutory deductions.
- 2026-02-08: Implemented stricter payroll lifecycle progression (`review -> generate payslips -> close`) with new guarded actions and close-step precondition checks, and reworked run detail UX into a reference-style process step flow while preserving project default visual tokens.
- 2026-02-08: Added active payroll statutory reports route with run-filtered totals and employee-level statutory contribution breakdown linked to payslip detail pages.
- 2026-02-08: Added active payroll payslips listing/detail routes with run filtering and full earning/deduction breakdown, including direct links into payroll adjustments review flow.
- 2026-02-08: Added active payroll adjustments workflow at `/[companyId]/payroll/adjustments` with manual payslip adjustment dialogs, company-scoped add/remove adjustment actions, and run/payslip totals recalculation with audit logs.
- 2026-02-08: Extended payroll run calculation with statutory WTAX flex-rule table resolution, loan amortization posting/balance updates, and manual adjustment carry-over across recalculation reruns; retained stronger calculation step transitions (`PROCESSING`/`COMPUTED`/`FAILED`) with run-level totals and audit logging.
- 2026-02-08: Added configurable statutory deduction timing in Payroll Policies and wired payroll calculation to policy-driven timing (with existing semi-monthly split as default behavior).
- 2026-02-08: Added payroll validation utility integration for run validation with pre-payroll diagnostics (DTR completeness, unresolved leave/overtime overlaps, overtime-without-approval checks) and stored structured validation notes per run step.
- 2026-02-08: Started active Payroll module implementation with new `/[companyId]/payroll/runs*` routes, payroll lifecycle action scaffolding (create/validate/calculate/close/reopen), and initial run list/create/detail UI wired to company-scoped authz and audit logging.
- 2026-02-08: Documented Payroll implementation direction to follow reference payroll business logic/pages/components while implementing within the project's existing code structure, and recorded the intentional manual DTR auto-approval policy for HR-operated workflows.
- 2026-02-08: Repaired Prisma migration chain by adding a baseline schema migration, resolving legacy migration history in the current environment, and syncing DB schema state to unblock subsequent migration operations.
- 2026-02-08: Added per-company payslip watermark setting in Company Profile and wired payslip PDF rendering to use company-level watermark text with env fallback.
- 2026-02-08: Expanded employee self-service profile update flow to include document entry management, added typed schema validation for documents, and added audit trail logging for profile mutations (contact/address/emergency/documents).
- 2026-02-08: Enhanced payslip PDF route and renderer with download request audit metadata (`IP`, `User-Agent`), company branding support (logo/legal name), signatory blocks, and optional watermark text via environment variable.
- 2026-02-08: Extended CTO conversion preview badges to overtime approval history rows in Employee Portal HR view for clearer post-decision audit visibility.
- 2026-02-08: Added CTO conversion preview badges to overtime approval UIs (employee portal and admin Approval Queue) so HR can see which overtime requests will convert to CTO (1:1) before final approval.
- 2026-02-08: Added overtime-to-CTO conversion policy on HR final overtime approval (1:1 credit, min 1 hour, applies to supervisor-and-up or non-OT-eligible employees) with leave balance ledger crediting and validation guards.
- 2026-02-08: Updated the Leave / OT Policies "+ Add New" action button to use the default primary button style for stronger action emphasis.
- 2026-02-08: Updated selected row styling in Leave / OT Policies tables to use the default primary selected color treatment (matching selected-route emphasis behavior used in sidebar navigation).
- 2026-02-08: Repositioned Leave Balance Initialization to the top of the Leave Types section header so it appears above the Leave Types label and table controls.
- 2026-02-08: Moved Leave Balance Initialization UI into the Leave Types container in Settings > Leave / OT Policies for tighter leave-policy workflow grouping.
- 2026-02-08: Improved Leave / OT Policies UX with status icons on active/inactive badges, enforced full-width select triggers, and added leave eligibility setting (`All including probationary` vs `Regular only`) to support LWOP/probationary policy configuration.
- 2026-02-08: Updated active status badges in Settings > Leave / OT Policies to use green (`bg-green-600`) for clearer status semantics.
- 2026-02-08: Converted Settings > Leave / OT Policies from static UI to DB-backed management with live loaders and save actions for leave types/policies and overtime rates.
- 2026-02-08: Fixed sidebar active-route hover behavior so selected items keep `sidebar-primary` colors even while hovered.
- 2026-02-08: Updated sidebar component active-state tokens so selected routes use `sidebar-primary`/`sidebar-primary-foreground` at the UI primitive level (`SidebarMenuButton`/`SidebarMenuSubButton`) while hover states continue using accent colors.
- 2026-02-08: Refined sidebar active-route styling so primary/default sidebar color is applied only to selected routes, not on hover states.
- 2026-02-08: Fixed sidebar route-state behavior by deriving active module/sub-item from pathname, switching sub-item navigation to `next/link`, applying selected-route default sidebar primary colors, and auto-syncing collapsible section state to the active route (including System Settings -> Leave / OT Policies).
- 2026-02-08: Updated Leave Balance Initialization controls layout so the Year label appears on the same line as the year input and Initialize button.
- 2026-02-08: Corrected Leave Balance Initialization year input control to use the same control height as the default Initialize button size.
- 2026-02-08: Adjusted Leave Balance Initialization year input control height to visually match the Initialize action button in Settings > Leave / OT Policies.
- 2026-02-08: Implemented leave balance lifecycle mutations on leave request transitions (reserve on submit, release on cancel/reject, consume on HR final approve) with transaction-safe ledger writes and cross-year request guard.
- 2026-02-08: Implemented manual yearly leave balance initialization in Settings > Leave / OT Policies with company-scoped, idempotent seeding, policy-based entitlement calculation, proration support, carry-over handling, and leave balance transaction ledger entries.
- 2026-02-08: Updated project direction docs and backlog to prioritize leave balance initialization and retain `isRequestApprover` as the active approver model; approval workflow engine work is out of scope.
- 2026-02-08: Added Attendance Operations flow with DTR tabs (`Directory`, `Individual Calendar`, `Workbench`) and aligned styling to app default sizes/colors/fonts.
- 2026-02-08: Added Sync Biometrics route (`/[companyId]/attendance/sync-biometrics`) with import parser/upsert action and redirected legacy `/attendance/exceptions` path.
- 2026-02-08: Added Leave Calendar full-grid route (`/[companyId]/attendance/schedules`) showing all submitted leave requests including pending status.
- 2026-02-08: Added Leave & Overtime Approval Queue route (`/[companyId]/approvals`) that loads only `SUPERVISOR_APPROVED` requests for final HR validation.
- 2026-02-08: Added 5 design explorations for Approval Queue and finalized Iteration 1 (dense table-first layout) with app-default styling.
- 2026-02-08: Improved approval queue copy/terminology (`Requested Date/Time`, `Requested Duration`) and added empty-table placeholder state.
- 2026-02-08: Implemented production HR final-stage queue actions for leave/overtime (approve/reject with remarks/reason, role checks, HR-stage fields, audit logs, and revalidation).
- 2026-02-08: Wired approval queue action dialogs to server actions and added row-level details drawer (supervisor remarks, filed date, schedule/duration, reason).
- 2026-02-08: Simplified admin sidebar Leave & Overtime submenu to `Approval Queue` as the primary final-approval entry point.
- 2026-02-08: Added EMPLOYEE-only Employee Portal route tree and enforced redirect guard so employee users are scoped to `/[companyId]/employee-portal/*`.
- 2026-02-08: Added self-service Leave/Overtime request submit/cancel flows with typed validation, company-scoped checks, and audit logging.
- 2026-02-08: Added interactive Employee Payslips detail dialog and secure server-side PDF download using Playwright-rendered HTML template.
- 2026-02-08: Enabled creating manual DTR from empty calendar dates through the modify sheet (create-or-update action path).
- 2026-02-08: Enforced manual DTR correction role gate (`COMPANY_ADMIN`, `HR_ADMIN`, `PAYROLL_ADMIN`, `SUPER_ADMIN`) and switched manual corrections to immediate approval.
- 2026-02-08: Fixed DTR time rendering drift in Directory/Calendar/Modify flows by using consistent clock-time formatting for imported biometric records.
- 2026-02-08: Stabilized Individual Calendar employee fetch behavior to prevent rapid repeated server calls while selecting employees.
- 2026-02-07: Completed in-place Employee Profile edit mode (same field locations as view mode) with `Edit Record` -> `Cancel/Save Changes` flow and server-backed persistence.
- 2026-02-07: Added profile lookup option hydration + select editing for employment/status/tax and org assignment fields (department/division/position/rank/branch/manager/work schedule/pay pattern).
- 2026-02-07: Added PH-local calendar-popover date editing in employee profile for birth/employment lifecycle dates (hire/application/interview/job-offer/probation/regularization/contract dates).
- 2026-02-07: Added work-schedule-driven draft auto-population in profile edit (work start, work end, hours/day, grace period).
- 2026-02-07: Expanded profile edit save schema/action to persist additional personal/payroll/statutory fields (religion, blood type, height/weight, gov IDs, salary details, date fields).
- 2026-02-07: Aligned profile presentation polish with app defaults (default control sizes, rectangular profile image, centered empty states, improved tax-status display labels, and PHP text currency formatting).
- 2026-02-07: Finalized Employee Profile route (`/[companyId]/employees/[employeeId]`) with reference-matched tabbed UX structure (Overview, Personal, Education & Family, Employment, Payroll, Medical, Qualifications, History, Documents) adapted to app default fonts/colors/sizes.
- 2026-02-07: Added company-scoped Employee Profile data loader (`modules/employees/profile/utils/get-employee-profile-data.ts`) that hydrates core profile, employment, compensation, tax, family, qualifications, history, and documents.
- 2026-02-07: Aligned masterlist action column to route into employee profile pages (`View Profile`) and completed masterlist + profile UX pass without reference-folder runtime dependency.
- 2026-02-07: Cleaned workspace by removing temporary `employees-reference/` and `employees-components-reference/` folders after UX migration.
- 2026-02-07: Reworked Employee Masterlist to a single reference-inspired layout with filter sidebar, practical search controls, and company-scoped live employee data.
- 2026-02-07: Removed temporary multi-variant masterlist approach and replaced it with one admin-friendly view aligned to current dashboard aesthetics.
- 2026-02-07: Completed Employee Onboarding as a practical 2-step flow (`Identity + Contact + Uploads`, `Employment + Payroll + Tax`) with a header-level create action and confirmation dialog.
- 2026-02-07: Added profile image upload and scanned document upload experience in onboarding step 1 with user-friendly upload interactions.
- 2026-02-07: Updated onboarding create action persistence for employee core record, contact/email/address, salary, government IDs (masked/encoded), optional emergency contact, and uploaded employee documents.
- 2026-02-07: Improved onboarding validation/action errors into user-friendly Sonner toast messages.
- 2026-02-07: Added Statutory Tables settings page with quick setup tabs (SSS, PhilHealth, Pag-IBIG, Semi-Monthly WTAX) and bracket-style save flow.
- 2026-02-07: Reworked Settings > Attendance into Work Schedules with multi-schedule table and per-day time matrix (Mon-Sun row-level time in/out configuration).
- 2026-02-07: Added year-level archive flow for payroll periods via `archivePayrollYearAction` (sets selected year rows to `LOCKED` with audit logging and revalidation).
- 2026-02-07: Added dedicated rows-only save flow via `savePayrollPeriodRowsAction` so period row updates no longer depend on pattern save.
- 2026-02-07: Updated payroll UI to show selected year in the pay period container title (`Pay Period Rows (YEAR)`) and moved archive action into the same header line.
- 2026-02-07: Fixed PH-local year/date handling in payroll policy data mapping and save boundaries to prevent year/date drift.
- 2026-02-07: Separated loading state handling for `Save Pattern` and `Save Period Rows` controls to avoid cross-triggered save indicators.

## Lessons Learned

- For biometric-imported clock times, UI display should avoid unintended timezone drift; use a consistent display strategy for `actualTimeIn`/`actualTimeOut` across table, calendar, and edit sheet.
- Individual-calendar fetch effects must be scoped to stable dependencies; otherwise combobox interactions can spam repeated server calls.
- Manual DTR correction flows should support both update and create paths so users can correct missing-day records directly from calendar cells.
- Elevated manual correction privileges should be enforced in-server (not only in UI) and can bypass pending approval when policy requires trusted-role immediate approval.
- Approval queue UX should use domain language (Leave/OT request semantics) instead of generic labels (for example avoid "Qty" in mixed request tables).
- Data-heavy operations tables must include explicit empty-state placeholders so users understand filter/search outcomes immediately.
- Avoid nesting interactive elements (`button` inside `button`) in selectable cards; use a focusable container (`role="button"`) with keyboard handlers instead.
- Keep create vs update flows explicit in server actions; upsert can blur expected UX when "new" should stay unsaved until explicit create.
- For schedule-driven forms, default to empty state when no selection exists; avoid auto-selecting first record to prevent accidental edits.
- PH-local date semantics should use stable conversion boundaries; avoid naive UTC getters for year-sensitive views.
- Shared pending/loading states across unrelated actions create false feedback; isolate save state per action.
- For onboarding and settings forms, use shadcn `Calendar` popover date pickers to preserve PH-local date semantics and avoid manual date input errors.
- For employee onboarding UX, a concise multi-step flow (2-step) with larger section bodies improves completion and keeps complex related records manageable.
- For destructive/final actions (like employee creation), add a confirmation dialog with contextual details (employee name) before execution.
- Prefer user-friendly zod validation mapping (field + section guidance) over raw technical error strings in UI toasts.
