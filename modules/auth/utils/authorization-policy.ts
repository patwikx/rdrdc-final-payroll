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

export const ACCESS_SCOPES = ["NONE", "OWN", "APPROVAL_QUEUE", "COMPANY"] as const

export type AccessScope = (typeof ACCESS_SCOPES)[number]

export const USER_ACCESS_FLAG_DEFINITIONS = [
  {
    key: "isRequestApprover",
    label: "Request Approver",
    assignmentScope: "user",
    description: "Lets the user act on assigned approval queues across accessible companies.",
  },
  {
    key: "isMaterialRequestPurchaser",
    label: "Material Request Purchaser",
    assignmentScope: "company",
    description: "Lets the user process material requests and company procurement work in one company.",
  },
  {
    key: "isMaterialRequestPoster",
    label: "Material Request Poster",
    assignmentScope: "company",
    description: "Lets the user post completed material requests and company receiving work in one company.",
  },
  {
    key: "isPurchaseRequestItemManager",
    label: "Purchase Request Item Manager",
    assignmentScope: "company",
    description: "Lets the user maintain the procurement item catalog for one company.",
  },
] as const

export type UserAccessFlagDefinition = (typeof USER_ACCESS_FLAG_DEFINITIONS)[number]
export type UserAccessFlagKey = UserAccessFlagDefinition["key"]
export type UserAccessFlagAssignmentScope = UserAccessFlagDefinition["assignmentScope"]

type RoleSet = ReadonlySet<CompanyRole>

const asRoleSet = (roles: readonly CompanyRole[]): RoleSet => new Set(roles)
const ATTENDANCE_SENSITIVE_ROLES = asRoleSet(["COMPANY_ADMIN", "HR_ADMIN"])
const ACCESS_SCOPE_RANK: Record<AccessScope, number> = {
  NONE: 0,
  OWN: 1,
  APPROVAL_QUEUE: 2,
  COMPANY: 3,
}

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

export const getModuleAccessScope = (role: CompanyRole, moduleKey: ModuleKey): AccessScope => {
  return hasModuleAccess(role, moduleKey) ? "COMPANY" : "NONE"
}

export const isAccessScopeAtLeast = (
  actualScope: AccessScope,
  requiredScope: Exclude<AccessScope, "NONE">
): boolean => {
  return ACCESS_SCOPE_RANK[actualScope] >= ACCESS_SCOPE_RANK[requiredScope]
}

export const getHigherAccessScope = (left: AccessScope, right: AccessScope): AccessScope => {
  return ACCESS_SCOPE_RANK[left] >= ACCESS_SCOPE_RANK[right] ? left : right
}

export const getUserAccessFlagDefinition = (
  key: UserAccessFlagKey
): UserAccessFlagDefinition => {
  const definition = USER_ACCESS_FLAG_DEFINITIONS.find((entry) => entry.key === key)

  if (!definition) {
    throw new Error(`Unknown user access flag: ${key}`)
  }

  return definition
}

export const hasAttendanceSensitiveAccess = (role: CompanyRole): boolean => {
  return ATTENDANCE_SENSITIVE_ROLES.has(role)
}
