# Project Agent Instructions

This repository uses skill-driven instructions in `.agents/skills`.
All coding agents working in this project should follow the rules below.

## Source of Truth

1. Root project instructions in this file.
2. Skill-specific instructions in `.agents/skills/**/SKILL.md`.
3. Expanded guidance in `.agents/skills/**/AGENTS.md` and `rules/*.md`.

If instructions overlap, prefer the most specific rule for the task.

## Skill Activation

### React and Next.js Work

When writing, reviewing, or refactoring React/Next.js code, apply:

- `.agents/skills/vercel-react-best-practices/SKILL.md`
- `.agents/skills/vercel-react-best-practices/AGENTS.md`

Priority order for optimizations:

1. Eliminate waterfalls (`async-*`)
2. Optimize bundle size (`bundle-*`)
3. Improve server-side performance (`server-*`)
4. Improve client data fetching (`client-*`)
5. Reduce re-renders (`rerender-*`)
6. Improve rendering performance (`rendering-*`)
7. Apply JavaScript hot-path optimizations (`js-*`)
8. Use advanced patterns when needed (`advanced-*`)

Non-negotiables for React/Next.js:

- Start independent async work early and await late.
- Use parallel fetch patterns and avoid sequential waterfalls.
- Keep client bundles lean (avoid heavy barrel imports; use dynamic import strategically).
- Treat Server Actions like public API routes (authN/authZ inside the action).
- Minimize RSC serialization payloads and avoid duplicate references.

### Frontend Design Work

When building UI, pages, components, or visual redesigns, apply:

- `.agents/skills/frontend-design/SKILL.md`

Design non-negotiables:

- Choose a clear, intentional aesthetic direction before implementation.
- Avoid generic AI-looking design patterns and overused defaults.
- Use distinctive typography and deliberate color systems.
- Add meaningful motion and atmosphere (not random micro-interactions).
- Match code complexity to design ambition.

## Execution Standard

- Prefer production-ready code over pseudo-code.
- Keep performance, accessibility, and maintainability in balance.
- Follow existing project patterns unless a rule above requires improvement.
- When in doubt, consult the corresponding skill `AGENTS.md` and `rules/*.md`.

## Project-Specific Development Rules

- Stack assumptions for all implementation work: Next.js `16.1.6`, TypeScript, `next-auth@beta`, Prisma, Framer Motion, shadcn/ui, and JetBrains Mono fonts.
- Database: PostgreSQL via Prisma.
- Enforce strict type safety: do not use `any` in application code.
- For UI work, do not modify `globals.css`.
- For UI work, keep and reuse the project's existing default color system.
- For UI work, always prefer shadcn/ui primitives/components over raw HTML controls when an equivalent shadcn component exists.
- Treat app date/time handling as Philippines-local by default (`Asia/Manila`), especially for calendar inputs and persistence boundaries.
- When saving selected calendar dates, preserve the user-selected PH local date semantics so the stored DB value matches the picked date.
- For form date fields (especially onboarding and settings), use shadcn/ui `Calendar` with popover-based date picking instead of plain text date entry.

## Codebase Organization Conventions

- Organize features by module/domain (for example: payroll, employees, attendance, auth, reports), not by generic technical layers only.
- Keep UI components grouped per module, while extracting truly shared UI into reusable common components.
- Keep server actions grouped per module and colocated with their related domain logic when practical.
- Prefer reusable, composable components and utilities to avoid duplication and keep the codebase clean.
- Follow consistent naming conventions across files, components, actions, and types; use clear, descriptive, domain-driven names.

## Definition of Done

- Every implemented feature must include: strict typings, loading and error states, required auth/authz checks, and appropriate test coverage.
- All work should be production-ready and integrated into the module structure with clear naming.

## Testing Standards

- Write unit tests for domain utilities, schemas, and pure business logic.
- Write integration tests for server actions, database flows, and module-level workflows.
- Write end-to-end tests for critical business paths (especially payroll, attendance, and role-restricted flows).

## Validation and Error Handling

- Validate all server action inputs using schema validation (prefer `zod`) before side effects or database writes.
- Use a consistent typed action result/error contract so UI handling is predictable across modules.

## Authorization and Access Control

- Treat every server action as a public endpoint; enforce authentication and authorization inside the action.
- Implement role-based access using a centralized authorization map/policy (module-to-allowed-roles mapping) so role/module access changes are made in one place.
- For protected modules and mutations, check permissions through shared authz utilities instead of duplicating inline role logic.
- Use company-scoped role assignment as the authoritative RBAC source (`UserCompanyAccess.role`) for module access checks.
- If a global/platform role is needed, keep it separate from tenant RBAC and do not use it as a substitute for company-level permissions.
- For approver-specific leave/overtime flows, use `User.isRequestApprover` as the active approver flag source.

## Approval Workflow Architecture

- Current direction is fixed two-stage request approvals for leave/overtime (Supervisor -> HR final stage).
- Approval workflow engine tables and generic multi-step workflow expansion are out of scope for now.
- Keep request-level approval fields and status transitions explicit in business request records.

## Multi-Company and Tenant Scope

- This is a multi-company payroll system; implement and maintain a company switcher for users who can access multiple companies.
- Resolve active company context through a shared utility (session + selected company) and reuse it across server actions and data loaders.
- Scope all company-owned reads and writes by `companyId`; never execute cross-company queries without explicit authorized intent.
- Enforce company-level authorization alongside role checks (user must have access to the active company and the module/action).
- Prefer composite indexes/uniques that include `companyId` for tenant-safe constraints and query performance.

## Date and Database Conventions

- Define and follow a clear storage contract for temporal data (`DATE` vs `TIMESTAMPTZ`) per use case.
- Use shared date conversion utilities at UI, action, and persistence boundaries to preserve Philippines-local date semantics.
- Keep Prisma schema and migrations explicit, reversible when possible, and aligned with domain naming.

## Naming and Module Blueprint

- Follow consistent action naming such as `createEmployeeAction`, `updateAttendanceAction`, `getPayrollSummaryAction`.
- Keep a consistent module layout where applicable: `components`, `actions`, `schemas`, `types`, `utils`.
- Keep shared cross-module UI in reusable common locations and keep domain-specific logic inside its module.

## Reusability Rules

- Prefer composable reusable building blocks over one-off implementations.
- Apply the "extract after 2 uses" rule for shared components, hooks, and utilities.

## Accessibility and Theme Compatibility

- All new UI must support both light mode and dark mode without breaking readability, contrast, or visual hierarchy.
- Preserve compatibility with the existing design system and default project colors in both themes.
- Ensure accessibility baselines: keyboard navigation, visible focus states, semantic labels, and adequate color contrast.
- For forms, visibly mark required fields with a red asterisk (`*`) next to the label.

## Quality Gates

- Before considering work complete, ensure `typecheck`, `lint`, `test`, and `build` pass.
- Do not merge or finalize work with failing quality checks unless explicitly requested with a documented reason.

## Progress and Lessons Log

Use this section as the single running log for implementation lessons/progress notes instead of creating additional one-off markdown files.

### Employee Portal (Current)

- Keep reference UX structure, but use project-default visual language: compact spacing, default typography, rounded surfaces, semantic colors.
- Use shadcn/ui components when available (for example `Checkbox`, `Select`, `Calendar`) instead of raw HTML form controls.
- Keep date UX predictable:
  - Start/End controls remain user-controllable.
  - End date should not allow earlier dates than selected start date where range semantics apply.
  - Preserve PH-local (`Asia/Manila`) date semantics at UI/action/persistence boundaries.
- Leave balance cards should be rendered by leave type so cards still appear even when explicit balance rows are zero/missing.
- For leave balances, show concise metrics (starting balance + current available) with leave-type-specific icons.
- Employee Portal scope note: Loan Applications and Loan Calculator are currently out of scope; do not expose them in the employee-portal sidebar.

### Cross-Module Progress Notes (2026-02-09)

- Added `Employment Setup` route (`/[companyId]/settings/employment`) for centralized management of positions, employment status/type/class.
- Added table-level search + status filters and server-side deactivation guardrails to prevent deactivating records currently assigned to active employees.
- Migrated `EmploymentStatus`, `EmploymentType`, and `EmploymentClass` to company-scoped data (`companyId`) and updated read/write flows to enforce tenant-safe lookups.
- Added post-migration verification script `npm run verify:employment:scope` to check null-company rows, cross-company employee/status-type-class mismatches, and per-company coverage counts.
- Updated employee profile edit flow to auto-create movement history for salary, position, employment status, and rank changes.
- Updated employee profile Employment tab layout to support 5-column Employment Details rows on large screens.
- Updated onboarding payroll behavior to auto-calculate daily/hourly from monthly rate using annualized divisor formula and keep derived fields read-only.
- Added onboarding Step 2 dynamic select creation dialog flow for employment/organization references (status/type/class, department/division/position/rank/branch) with in-select blue `+ Add` affordance.
- Reworked statutory reports to locked Iteration 3 workspace and added print-ready HTML report templates for SSS, PhilHealth, Pag-IBIG, DOLE 13th Month, and BIR Alphalist with report-scoped print mode.
- Added styled CSV exports that mirror report headers/column structures for SSS/PhilHealth/Pag-IBIG/DOLE/BIR report flows.
- Added annual BIR tax projection and payroll withholding refinements:
  - annual WTAX-table based annual tax due computation in BIR report outputs,
  - annual withholding delta method in payroll calculation,
  - YTD pre-tax recurring deduction accumulation in annual taxable projection.
- Added compact BIR per-employee calculation trace section for HR audit visibility (gross, non-taxable cap, taxable base, annual due, YTD withheld, delta).
- Reworked admin payslips history page to bounded data loading via paginated/date-scoped API fetches instead of sending full payslip arrays from RSC.
- Added report-scoped print behavior so statutory print actions render report HTML only (not full application page chrome).
- Updated annual withholding projection to include YTD pre-tax recurring deductions in annual taxable projection math.
- Updated movement history capture to include null-transition events (status/position/rank clear/unassign), with nullable `new*Id` history fields.

### Cross-Module Progress Notes (2026-02-14)

- Expanded Material Requests end-to-end in employee portal with dedicated request create/detail pages, configurable department-driven `1..4` approval steps, and request-level selected approvers.
- Added custom material-request step names in settings and propagated those labels across request forms, approval views, request logs/details, and print outputs.
- Implemented Material Request processing and posting lifecycle:
  - processing states (`PENDING_PURCHASER`, `IN_PROGRESS`, `COMPLETED`)
  - posting states (`PENDING_POSTING`, `POSTED`)
  - serve-batch tracking with partial-serve support and multi-entry serving history
- Reworked Material Request processing UX from modal-only flow to dedicated detail page with table-based item display and print-ready document output.
- Added Material Request posting workspace and posting action flow for completed served requests, with posting reference currently optional.
- Expanded employee user-access management with multi-company assignment editing and company-level purchaser/poster flags.
- Added Material Request legacy-sync unmatched-row workspace hardening:
  - row-level save and selected-rows save
  - selectable columns, search/filters, pagination
  - bulk department apply for selected rows
  - legacy reconciliation columns (legacy department, recommending/final approvers + statuses, mapped new status)
- Tightened legacy requester resolution to legacy requester employee-id/number matching against new `employeeNumber` (no name fallback).
- Updated employee-portal material-request ownership visibility to `requesterUserId` so cross-company-access users can see/create/edit their requests in accessible companies even without a local employee row in that company.
- Added server-side paginated approval history + animated accordion expansion for Material Requests, and applied the same server-driven history pattern to Leave and Overtime approvals.
- Applied request-log UX standardization across Material Requests (processing/posting/approvals), Overtime Requests, Leave Requests, and Employee-Portal Payslips:
  - non-rounded table containers
  - fixed desktop search width (no `w-full`)
  - compact table text/badge/action spacing parity
  - filter changes applied immediately in UI flows where applicable.
- Replaced row action dropdown patterns in employee request logs with inline icon actions + tooltips where requested (material processing, overtime requests, leave requests, payslips).
- Added pending-request edit/update flows for Overtime and Leave request logs:
  - new server actions: `updateOvertimeRequestAction`, `updateLeaveRequestAction`
  - update-in-place behavior (no duplicate request creation)
  - retained company-scoped authz, ownership checks, and audit logging.
- Expanded Material Request editability behavior so pending requests with no acted approval history can be updated, including route/action guard alignment and create-vs-update CTA distinction.
- Aligned leave/overtime create+update date parsing paths to shared PH date utility usage (`parsePhDateInputToUtcDateOnly`) to preserve expected PH-local date semantics.

### Cross-Module Progress Notes (2026-02-17)

- Added company-scoped HR employee-detail reports under the existing Reports module (`/[companyId]/reports/hr/*`) with dedicated pages, filters, table views, print outputs, and CSV exports:
  - Contact & Emergency Directory
  - Employment Milestones
  - Movement & Change Log
  - Training & Certification Compliance
  - Government ID Compliance
  - Separation & Attrition Detail
- Removed `Master Data Completeness` report route and related report implementation files based on revised requirements.
- Updated Reports sidebar mapping to include icon coverage for the new HR report entries and added a safe fallback icon for any unmapped future sub-item IDs.
- Standardized new HR report table layouts to:
  - use shadcn `Table` primitives,
  - avoid viewport-width overflow (`w-full`/wrapped cell content),
  - and render explicit per-cell borders for document-like readability.
- Removed the `Employee Scope` switch UI from all newly added HR report filter toolbars.

### Cross-Module Progress Notes (2026-02-19)

- Updated manual DTR leave handling so `ON_LEAVE` entries can carry explicit leave type selection in DTR correction flows (Sick Leave, Vacation Leave, Compensary Time Off, Leave Without Pay, Mandatory Leave).
- Added payroll/validation policy alignment for manual DTR `ON_LEAVE` without approved leave requests:
  - selected paid leave types are treated as payable days,
  - selected unpaid leave types are treated as unpaid absences.
- Added internal DTR remarks token persistence for selected leave type so manual DTR leave behavior remains stable across correction, validation, and payroll calculation steps.
- Updated manual DTR leave balance mutation policy so only paid leave types deduct employee leave balances; unpaid leave types do not consume leave balance.
