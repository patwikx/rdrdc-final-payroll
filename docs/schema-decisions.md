# Schema Decisions (v1)

This document is the working source of truth for schema-level decisions before implementation.

## Core Decisions

- Multi-company is mandatory. Tenant-owned writes and reads must be scoped by `companyId` directly or by ownership chain.
- Company switcher is required. Active company is resolved from session + persisted selected company.
- Role checks must be centralized and company-aware. Avoid scattered inline role checks.
- Philippines-local date semantics (`Asia/Manila`) apply across UI, actions, and persistence boundaries.
- Strict TypeScript safety is required. No `any` in application code.

## Employee Data Decisions

- Employee identity source of truth:
  - Keep normalized records in `EmployeeGovernmentId` for extensibility and auditability.
  - Keep selected quick-access fields on `Employee` only if they are explicitly maintained by shared sync utilities.
- Date-only fields (birth date, hire date, contract dates, leave dates, holiday dates, etc.) should use `@db.Date` where time-of-day is not meaningful.
- Sensitive PII (government IDs, bank account numbers) should follow encryption-at-rest + masking in UI/logs.

## Company Switcher Preference Storage

- Persist selected company on `User.selectedCompanyId` (nullable) for last-used company behavior.
- Keep `UserCompanyAccess.isDefault` for first-time fallback/default provisioning.
- Track `User.lastCompanySwitchedAt` for auditability and debugging of context changes.
- Keep `preferredTimezone` on `User` defaulted to `Asia/Manila`.

## RBAC Source of Truth

- Tenant RBAC authority is `UserCompanyAccess.role`.
- `User.role` is treated as optional platform/global role only (for non-tenant capabilities such as super-admin operations).
- `User.isAdmin` and `User.isRequestApprover` are considered legacy flags and should be phased out from authorization checks.
- Authorization checks must always use active company context + centralized module policy map.
- Session payload should carry active company and company-scoped role, not only global role.

### Recommended Role Enum (Company Scope)

- `SUPER_ADMIN` (optional, platform-owned, not tenant substitute)
- `COMPANY_ADMIN`
- `HR_ADMIN`
- `PAYROLL_ADMIN`
- `APPROVER`
- `EMPLOYEE`

## Tenant Safety Decisions

- Prefer tenant-safe uniques: `@@unique([companyId, code])` for company-owned dictionaries.
- For models that support global templates (`companyId = null`) plus company overrides, use explicit strategy:
  - either separate global tables, or
  - partial unique indexes via SQL migrations when needed.
- Global unique IDs/numbers are allowed only when intentionally designed as globally generated identifiers.

## Numbering Strategy

- Keep `runNumber`, `payslipNumber`, `requestNumber`, and `loanNumber` globally unique.
- Generate these identifiers from centralized services/utilities to avoid collisions.
- Company context may be embedded in display formats, but uniqueness stays global.

## Approval Model Decision

Approval workflows remain on the current two-stage model for leave/overtime and do not introduce generic workflow engine tables at this time.

### Direction

- Use `User.isRequestApprover` as the active approver designation flag.
- Keep existing two-stage leave/overtime flow:
  - Supervisor stage (`PENDING -> SUPERVISOR_APPROVED`)
  - HR final stage (`SUPERVISOR_APPROVED -> APPROVED | REJECTED`)
- Keep existing request-level approver fields (`supervisorApproverId`, `hrApproverId`, `approverId`) and audit logs.
- Keep HR-facing queue scoped to `SUPERVISOR_APPROVED` requests.
- Generic approval-engine models (`ApprovalWorkflow*`, `ApprovalInstance*`) are out of scope.

## Employee Portal and Payslip Export Decisions

- Employee self-service routes are company-scoped under `/{companyId}/employee-portal/*`.
- Users with tenant role `EMPLOYEE` are restricted to employee-portal routes for company-scoped navigation.
- Leave and overtime self-service mutations must enforce:
  - active company context
  - employee ownership (`employee.userId === session.user.id`)
  - tenant scope (`employee.companyId === activeCompanyId`)
- Payslip downloads must be generated server-side (not client-generated) for consistency and security.
- Payslip PDF generation should use a server HTML/CSS template renderer (Playwright) to balance design quality with backend controls.

## Initial Execution Order

1. Add tenant-safe unique/index rules to company-owned lookup models.
2. Normalize employee date-only fields.
3. Implement leave balance yearly initialization and lifecycle updates.
4. Continue hardening shared authz policy map + active company resolver.
