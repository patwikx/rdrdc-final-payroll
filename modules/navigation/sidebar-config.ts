import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"

type SidebarSubItem = {
  id: string
  label: string
  path: string
}

export type SidebarModule = {
  id: string
  label: string
  icon: "employees" | "timekeeping" | "payroll" | "leaveOvertime" | "settings"
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
      { id: "statutory-reports", label: "Statutory Reports", path: "/payroll/statutory" },
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
      { id: "settings-legacy-leave-ot-sync", label: "Legacy Leave/OT Sync", path: "/settings/leave-overtime/legacy-sync" },
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
    return ["EMPLOYEE"]
  }

  const matchedModule = SIDEBAR_MODULES.find((module) =>
    module.matchPrefixes.some((prefix) => matchesPrefix(modulePath, prefix))
  )

  return matchedModule?.roles ?? null
}
