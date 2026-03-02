export type EmployeePortalChangeLogEntry = {
  id: string
  version: string
  date: string
  commit: string
  type: "major" | "minor" | "patch"
  module: "EMPLOYEE_PORTAL" | "MATERIAL_REQUESTS" | "LEAVE_OVERTIME" | "NOTIFICATIONS"
  title: string
  changes: string[]
  legacyParity: boolean
  relatedRoute?: string
}

// Curated release notes derived from repository history and legacy feature parity checks.
export const EMPLOYEE_PORTAL_CHANGE_LOG_ENTRIES: EmployeePortalChangeLogEntry[] = [
  {
    id: "2026-03-02-approval-queue-optimistic-refresh",
    version: "3.1.1",
    date: "2026-03-02",
    commit: "c09381b",
    type: "patch",
    module: "LEAVE_OVERTIME",
    title: "Approval Queue Immediate Clearing",
    changes: [
      "Approver queue now clears approved leave and overtime rows immediately in-page.",
      "Follow-up optimistic update fix was added to remove stale rows without router refresh.",
    ],
    legacyParity: false,
    relatedRoute: "/employee-portal/approvers",
  },
  {
    id: "2026-03-02-approval-queue-optimistic-updates",
    version: "3.1.1",
    date: "2026-03-02",
    commit: "a2d8a23",
    type: "patch",
    module: "LEAVE_OVERTIME",
    title: "Optimistic Leave & Overtime Approvals",
    changes: [
      "Leave and overtime approvals now update the request list optimistically after action completion.",
      "Approver pages keep pending queues in sync without hard page refresh behavior.",
    ],
    legacyParity: false,
    relatedRoute: "/employee-portal/approvers",
  },
  {
    id: "2026-03-02-leave-balance-inline-editing",
    version: "3.1.1",
    date: "2026-03-02",
    commit: "acce630",
    type: "minor",
    module: "LEAVE_OVERTIME",
    title: "Per-Employee Leave Balance Editing",
    changes: [
      "Leave balances page now supports direct per-employee leave balance edits.",
      "Balance maintenance flow was streamlined for HR update actions.",
    ],
    legacyParity: false,
  },
  {
    id: "2026-02-24-supplier-item-api",
    version: "3.1.1",
    date: "2026-02-24",
    commit: "331218e",
    type: "patch",
    module: "MATERIAL_REQUESTS",
    title: "Supplier & Existing Item API Wiring",
    changes: [
      "Material Request Processing now reads supplier options directly from /api/suppliers.",
      "Add Existing Items now loads catalog items from /api/mrs-items for real-time selection.",
      "Supplier picker handles nullable supplier rows safely to prevent runtime crashes.",
    ],
    legacyParity: true,
    relatedRoute: "/employee-portal/material-request-processing",
  },
  {
    id: "2026-02-24-material-request-item-supplier-ux",
    version: "3.1.1",
    date: "2026-02-24",
    commit: "53db6b5",
    type: "major",
    module: "MATERIAL_REQUESTS",
    title: "Material Request Item/Supplier Workflow Upgrade",
    changes: [
      "Added Add Existing Items flow in Material Request creation with multi-select support.",
      "Auto-generated item codes now include duplicate safeguards in UI and server validation.",
      "Request item tables were compacted and aligned with serve-dialog table structure.",
    ],
    legacyParity: true,
    relatedRoute: "/employee-portal/material-requests",
  },
  {
    id: "2026-02-24-cross-company-approvals",
    version: "3.1.1",
    date: "2026-02-24",
    commit: "03b8ab6",
    type: "major",
    module: "LEAVE_OVERTIME",
    title: "Cross-Company Approvals in Default Company View",
    changes: [
      "Approvers and reporting managers now see cross-company approvals without switching company context.",
      "Leave, Overtime, and Material approval visibility was aligned with multi-company access policy.",
      "Manager/reporting flows were updated to include employees across accessible companies.",
    ],
    legacyParity: false,
    relatedRoute: "/employee-portal/approvers",
  },
  {
    id: "2026-02-23-consolidated-approval-history",
    version: "3.1.0",
    date: "2026-02-23",
    commit: "0d3ffdc",
    type: "minor",
    module: "EMPLOYEE_PORTAL",
    title: "Consolidated Approval History UX",
    changes: [
      "Approval history loading was unified across Material Requests, Leave, and Overtime.",
      "Dialog and table behavior were standardized for a more consistent approver experience.",
      "Employee-portal approval pages now share the same history interaction pattern.",
    ],
    legacyParity: false,
    relatedRoute: "/employee-portal/approvers",
  },
  {
    id: "2026-02-23-material-request-receipt-hardening",
    version: "3.1.0",
    date: "2026-02-23",
    commit: "b2f1619",
    type: "patch",
    module: "MATERIAL_REQUESTS",
    title: "Receipt Acknowledgment & Completion Hardening",
    changes: [
      "Receipt acknowledgment state handling was tightened to reduce request completion mismatches.",
      "Material request edge-case handling was hardened for processing and posting transitions.",
    ],
    legacyParity: false,
    relatedRoute: "/employee-portal/material-requests",
  },
  {
    id: "2026-02-15-request-notification-emails",
    version: "2.5.0",
    date: "2026-02-15",
    commit: "447220d",
    type: "minor",
    module: "NOTIFICATIONS",
    title: "Request Notification Emails",
    changes: [
      "Supervisor and material purchaser email notifications were added for request events.",
      "Notification flow was aligned to improve response time on pending approvals and processing.",
    ],
    legacyParity: false,
    relatedRoute: "/employee-portal/approvers",
  },
  {
    id: "2026-02-14-material-request-rollout-and-legacy-sync",
    version: "2.4.0",
    date: "2026-02-14",
    commit: "1836aa0",
    type: "major",
    module: "MATERIAL_REQUESTS",
    title: "Material Requests Rollout + Legacy Sync Foundation",
    changes: [
      "Completed employee-portal material-request workflow rollout (create, approve, process, post).",
      "Introduced legacy-sync foundation to reconcile records from the old system.",
      "Request lifecycle and logs were standardized for migration-era traceability.",
    ],
    legacyParity: true,
    relatedRoute: "/employee-portal/material-requests",
  },
  {
    id: "2026-02-12-portal-sidebar-scope-cleanup",
    version: "2.3.1",
    date: "2026-02-12",
    commit: "dccfc87",
    type: "patch",
    module: "EMPLOYEE_PORTAL",
    title: "Employee Portal Sidebar Scope Cleanup",
    changes: [
      "Removed out-of-scope loan entry points from the employee portal sidebar.",
      "Navigation scope was tightened to active modules for cleaner end-user flow.",
    ],
    legacyParity: false,
    relatedRoute: "/employee-portal",
  },
]
