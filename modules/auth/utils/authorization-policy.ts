export const COMPANY_ROLES = [
  "COMPANY_ADMIN",
  "HR_ADMIN",
  "PAYROLL_ADMIN",
  "APPROVER",
  "EMPLOYEE",
] as const

export type CompanyRole = (typeof COMPANY_ROLES)[number]

export const MODULE_KEYS = [
  "dashboard",
  "employees",
  "attendance",
  "leave",
  "overtime",
  "loans",
  "payroll",
  "reports",
  "settings",
  "approval-workflows",
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

type RoleSet = ReadonlySet<CompanyRole>

const asRoleSet = (roles: readonly CompanyRole[]): RoleSet => new Set(roles)

export const AUTHORIZATION_POLICY: Readonly<Record<ModuleKey, RoleSet>> = {
  dashboard: asRoleSet(["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER", "EMPLOYEE"]),
  employees: asRoleSet(["COMPANY_ADMIN", "HR_ADMIN"]),
  attendance: asRoleSet(["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER", "EMPLOYEE"]),
  leave: asRoleSet(["COMPANY_ADMIN", "HR_ADMIN", "APPROVER", "EMPLOYEE"]),
  overtime: asRoleSet(["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER", "EMPLOYEE"]),
  loans: asRoleSet(["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER", "EMPLOYEE"]),
  payroll: asRoleSet(["COMPANY_ADMIN", "PAYROLL_ADMIN"]),
  reports: asRoleSet(["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"]),
  settings: asRoleSet(["COMPANY_ADMIN"]),
  "approval-workflows": asRoleSet(["COMPANY_ADMIN", "HR_ADMIN"]),
}

export const hasModuleAccess = (role: CompanyRole, moduleKey: ModuleKey): boolean => {
  return AUTHORIZATION_POLICY[moduleKey].has(role)
}
