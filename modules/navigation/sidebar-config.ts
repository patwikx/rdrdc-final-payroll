import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"

type SidebarSubItem = {
  id: string
  label: string
  path: string
}

export type SidebarModule = {
  id: string
  label: string
  icon: "employees" | "timekeeping" | "payroll" | "reports" | "leaveOvertime" | "settings"
  matchPrefixes: readonly string[]
  roles: readonly CompanyRole[]
  items: readonly SidebarSubItem[]
}

const ALL_ROLES: readonly CompanyRole[] = [
  "COMPANY_ADMIN",
  "HR_ADMIN",
  "PAYROLL_ADMIN",
  "APPROVER",
  "EMPLOYEE",
]

export const SIDEBAR_MODULES: readonly SidebarModule[] = [
  {
    id: "employees",
    label: "Employees",
    icon: "employees",
    matchPrefixes: ["/employees"],
    roles: ["COMPANY_ADMIN", "HR_ADMIN", "APPROVER"],
    items: [
      { id: "employee-masterlist", label: "Employee Masterlist", path: "/employees" },
      { id: "employee-onboarding", label: "Onboarding", path: "/employees/onboarding" },
      { id: "employee-movements", label: "Movements", path: "/employees/movements" },
      { id: "employee-user-access", label: "User Access", path: "/employees/user-access" },
    ],
  },
  {
    id: "timekeeping",
    label: "Time Keeping",
    icon: "timekeeping",
    matchPrefixes: ["/attendance"],
    roles: ALL_ROLES,
    items: [
      { id: "dtr", label: "Daily Time Record", path: "/attendance/dtr" },
      { id: "sync-biometrics", label: "Sync Biometrics", path: "/attendance/sync-biometrics" },
      { id: "sync-biometrics-device", label: "Device Sync", path: "/attendance/sync-biometrics/device" },
      { id: "schedules", label: "Leave Calendar", path: "/attendance/schedules" },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    icon: "payroll",
    matchPrefixes: ["/payroll"],
    roles: ["COMPANY_ADMIN", "PAYROLL_ADMIN"],
    items: [
      { id: "payroll-runs", label: "Payroll Runs", path: "/payroll/runs" },
      { id: "payroll-recurring-deductions", label: "Recurring Deductions", path: "/payroll/recurring-deductions" },
      { id: "payslips", label: "Payslips History", path: "/payroll/payslips" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "reports",
    matchPrefixes: ["/reports"],
    roles: ["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"],
    items: [
      { id: "reports-payroll", label: "Payroll Reports", path: "/reports/payroll" },
      {
        id: "reports-contact-emergency-directory",
        label: "Contact & Emergency Directory",
        path: "/reports/hr/contact-emergency-directory",
      },
      {
        id: "reports-employment-milestones",
        label: "Employment Milestones",
        path: "/reports/hr/employment-milestones",
      },
      {
        id: "reports-movement-change-log",
        label: "Movement & Change Log",
        path: "/reports/hr/movement-change-log",
      },
      {
        id: "reports-training-certification-compliance",
        label: "Training & Certification Compliance",
        path: "/reports/hr/training-certification-compliance",
      },
      {
        id: "reports-government-id-compliance",
        label: "Government ID Compliance",
        path: "/reports/hr/government-id-compliance",
      },
      {
        id: "reports-separation-attrition-detail",
        label: "Separation & Attrition Detail",
        path: "/reports/hr/separation-attrition-detail",
      },
      {
        id: "reports-certificate-of-employment",
        label: "Certificate of Employment",
        path: "/reports/payroll/certificate-of-employment",
      },
      { id: "reports-demographics", label: "Demographics", path: "/reports/payroll/demographics" },
      { id: "reports-salary-history", label: "Salary History", path: "/reports/payroll/salary-history" },
      { id: "reports-late-overtime", label: "Late & Overtime Totals", path: "/reports/payroll/late-overtime" },
    ],
  },
  {
    id: "leave-overtime",
    label: "Leave & Overtime",
    icon: "leaveOvertime",
    matchPrefixes: ["/leave", "/overtime", "/approvals"],
    roles: ALL_ROLES,
    items: [
      { id: "approval-queue", label: "Approval Queue", path: "/approvals" },
      { id: "leave-balances", label: "Leave Balance", path: "/leave/balances" },
    ],
  },
  {
    id: "system-settings",
    label: "System Settings",
    icon: "settings",
    matchPrefixes: ["/settings"],
    roles: ["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"],
    items: [
      { id: "settings-company", label: "Company Profile", path: "/settings/company" },
      { id: "settings-company-new", label: "New Company Setup", path: "/settings/company/new" },
      { id: "settings-organization", label: "Organization Setup", path: "/settings/organization" },
      { id: "settings-employment", label: "Employment Setup", path: "/settings/employment" },
      { id: "settings-legacy-employee-sync", label: "Legacy Employee Sync", path: "/settings/employment/legacy-sync" },
      { id: "settings-payroll", label: "Payroll Policies", path: "/settings/payroll" },
      { id: "settings-attendance", label: "Work Schedules", path: "/settings/attendance" },
      { id: "settings-leave-ot", label: "Leave / OT Policies", path: "/settings/leave-overtime" },
      { id: "settings-material-requests", label: "Material Request Approvals", path: "/settings/material-requests" },
      { id: "settings-legacy-leave-ot-sync", label: "Legacy Leave/OT Sync", path: "/settings/leave-overtime/legacy-sync" },
      { id: "settings-legacy-material-requests-sync", label: "Legacy Material Request Sync", path: "/settings/material-requests/legacy-sync" },
      { id: "settings-statutory", label: "Statutory Tables", path: "/settings/statutory" },
      { id: "settings-audit-logs", label: "Audit Logs", path: "/settings/audit-logs" },
    ],
  },
]

export const isCompanyRole = (value: string): value is CompanyRole => {
  return ALL_ROLES.includes(value as CompanyRole)
}

export const getSidebarModulesForRole = (role: string | null | undefined): SidebarModule[] => {
  if (!role || !isCompanyRole(role)) {
    return []
  }

  return SIDEBAR_MODULES.filter((module) => module.roles.includes(role))
}

export const toCompanyScopedPath = (companyId: string, path: string): string => {
  return `/${companyId}${path}`
}

const matchesPrefix = (path: string, prefix: string): boolean => {
  return path === prefix || path.startsWith(`${prefix}/`)
}

export const getRequiredRolesForCompanyPath = (pathname: string): readonly CompanyRole[] | null => {
  const parts = pathname.split("/").filter(Boolean)

  if (parts.length < 2) {
    return null
  }

  const modulePath = `/${parts.slice(1).join("/")}`

  if (matchesPrefix(modulePath, "/dashboard")) {
    return ALL_ROLES
  }

  if (matchesPrefix(modulePath, "/employee-portal")) {
    return ["EMPLOYEE", "APPROVER", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"]
  }

  const matchedModule = SIDEBAR_MODULES.find((module) =>
    module.matchPrefixes.some((prefix) => matchesPrefix(modulePath, prefix))
  )

  return matchedModule?.roles ?? null
}
