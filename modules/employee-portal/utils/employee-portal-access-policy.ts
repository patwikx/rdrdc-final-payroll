import {
  getHigherAccessScope,
  hasModuleAccess,
  type AccessScope,
  type CompanyRole,
} from "@/modules/auth/utils/authorization-policy"

export const EMPLOYEE_PORTAL_CAPABILITIES = [
  "portal_routes.dashboard.view",
  "portal_routes.payslips.view",
  "portal_routes.leave_requests.view",
  "portal_routes.overtime_requests.view",
  "portal_routes.material_requests.view",
  "portal_routes.material_request_kpis.view",
  "portal_routes.profile.view",
  "portal_routes.leave_approvals.view",
  "portal_routes.overtime_approvals.view",
  "portal_routes.material_request_approvals.view",
  "portal_routes.approval_history.view",
  "portal_routes.material_request_processing.view",
  "portal_routes.purchase_orders.view",
  "portal_routes.goods_receipt_pos.view",
  "portal_routes.material_request_posting.view",
  "portal_routes.material_request_receiving_reports.view",
  "portal_routes.request_settings.view",
  "portal_routes.procurement_item_catalog.view",
  "portal_routes.purchase_requests.view",
  "portal_routes.change_log.view",
  "portal.dashboard.view",
  "profile.view",
  "payslips.view",
  "leave_requests.manage",
  "overtime_requests.manage",
  "material_requests.manage",
  "material_requests.kpi.view",
  "material_requests.kpi.view_company",
  "leave_approvals.view",
  "overtime_approvals.view",
  "material_request_approvals.view",
  "approval_history.view",
  "material_requests.processing.manage",
  "material_requests.posting.manage",
  "material_requests.receiving_reports.view",
  "material_requests.receiving_reports.view_company",
  "request_settings.manage",
  "procurement_item_catalog.manage",
  "purchase_requests.view",
  "purchase_requests.create",
  "purchase_requests.view_all",
  "purchase_requests.manage_all",
  "purchase_requests.approve",
  "purchase_orders.manage",
  "goods_receipt_pos.manage",
] as const

export type EmployeePortalCapability = (typeof EMPLOYEE_PORTAL_CAPABILITIES)[number]

export type EmployeePortalAccessSnapshot = {
  companyRole: CompanyRole
  purchaseRequestWorkflowEnabled: boolean
  isRequestApprover: boolean
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
  isPurchaseRequestItemManager: boolean
  hasEmployeeProfile: boolean
}

export type EmployeePortalCapabilityScopes = Partial<Record<EmployeePortalCapability, AccessScope>>
export type EmployeePortalCapabilityOverride = {
  capability: EmployeePortalCapability
  accessScope: AccessScope
}

export const isEmployeePortalCapability = (value: string): value is EmployeePortalCapability => {
  return EMPLOYEE_PORTAL_CAPABILITIES.includes(value as EmployeePortalCapability)
}

export const toEmployeePortalCapabilityOverrideEntries = (
  overrides: ReadonlyArray<{ capability: string; accessScope: AccessScope }>
): EmployeePortalCapabilityOverride[] => {
  return overrides.flatMap((override) =>
    isEmployeePortalCapability(override.capability)
      ? [
          {
            capability: override.capability,
            accessScope: override.accessScope,
          },
        ]
      : []
  )
}

const HR_PORTAL_ROLES = new Set<CompanyRole>(["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"])
const PURCHASE_REQUEST_WORKFLOW_CAPABILITIES = new Set<EmployeePortalCapability>([
  "portal_routes.purchase_orders.view",
  "portal_routes.goods_receipt_pos.view",
  "portal_routes.request_settings.view",
  "portal_routes.procurement_item_catalog.view",
  "portal_routes.purchase_requests.view",
  "procurement_item_catalog.manage",
  "purchase_requests.view",
  "purchase_requests.create",
  "purchase_requests.view_all",
  "purchase_requests.manage_all",
  "purchase_requests.approve",
  "purchase_orders.manage",
  "goods_receipt_pos.manage",
])

const PORTAL_ROUTE_SOURCE_CAPABILITIES: Partial<Record<EmployeePortalCapability, EmployeePortalCapability>> = {
  "portal_routes.dashboard.view": "portal.dashboard.view",
  "portal_routes.payslips.view": "payslips.view",
  "portal_routes.leave_requests.view": "leave_requests.manage",
  "portal_routes.overtime_requests.view": "overtime_requests.manage",
  "portal_routes.material_requests.view": "material_requests.manage",
  "portal_routes.material_request_kpis.view": "material_requests.kpi.view",
  "portal_routes.profile.view": "profile.view",
  "portal_routes.leave_approvals.view": "leave_approvals.view",
  "portal_routes.overtime_approvals.view": "overtime_approvals.view",
  "portal_routes.material_request_approvals.view": "material_request_approvals.view",
  "portal_routes.approval_history.view": "approval_history.view",
  "portal_routes.material_request_processing.view": "material_requests.processing.manage",
  "portal_routes.purchase_orders.view": "purchase_orders.manage",
  "portal_routes.goods_receipt_pos.view": "goods_receipt_pos.manage",
  "portal_routes.material_request_posting.view": "material_requests.posting.manage",
  "portal_routes.material_request_receiving_reports.view": "material_requests.receiving_reports.view",
  "portal_routes.request_settings.view": "request_settings.manage",
  "portal_routes.procurement_item_catalog.view": "procurement_item_catalog.manage",
  "portal_routes.purchase_requests.view": "purchase_requests.view",
}

export const isEmployeePortalHrRole = (role: CompanyRole): boolean => {
  return HR_PORTAL_ROLES.has(role)
}

const canApplyEmployeePortalCapabilityOverride = (
  snapshot: EmployeePortalAccessSnapshot,
  capability: EmployeePortalCapability
): boolean => {
  const sourceCapability = PORTAL_ROUTE_SOURCE_CAPABILITIES[capability]
  if (sourceCapability) {
    return canApplyEmployeePortalCapabilityOverride(snapshot, sourceCapability)
  }

  if (
    PURCHASE_REQUEST_WORKFLOW_CAPABILITIES.has(capability) &&
    !snapshot.purchaseRequestWorkflowEnabled
  ) {
    return false
  }

  if (capability === "purchase_requests.create" && !snapshot.hasEmployeeProfile) {
    return false
  }

  return true
}

export const resolveEmployeePortalCapabilities = (
  snapshot: EmployeePortalAccessSnapshot,
  overrides: readonly EmployeePortalCapabilityOverride[] = []
): Set<EmployeePortalCapability> => {
  return new Set(
    Object.entries(resolveEmployeePortalCapabilityScopes(snapshot, overrides))
      .filter(([, scope]) => scope && scope !== "NONE")
      .map(([capability]) => capability as EmployeePortalCapability)
  )
}

const setCapabilityScope = (
  scopes: EmployeePortalCapabilityScopes,
  capability: EmployeePortalCapability,
  scope: AccessScope
): void => {
  const currentScope = scopes[capability] ?? "NONE"
  scopes[capability] = getHigherAccessScope(currentScope, scope)
}

const inheritRouteScope = (
  scopes: EmployeePortalCapabilityScopes,
  routeCapability: EmployeePortalCapability
): void => {
  const sourceCapability = PORTAL_ROUTE_SOURCE_CAPABILITIES[routeCapability]
  if (!sourceCapability) {
    return
  }

  const sourceScope = scopes[sourceCapability] ?? "NONE"
  if (sourceScope !== "NONE") {
    setCapabilityScope(scopes, routeCapability, sourceScope)
  }
}

export const resolveEmployeePortalCapabilityScopes = (
  snapshot: EmployeePortalAccessSnapshot,
  overrides: readonly EmployeePortalCapabilityOverride[] = []
): EmployeePortalCapabilityScopes => {
  const scopes: EmployeePortalCapabilityScopes = {}

  setCapabilityScope(scopes, "portal.dashboard.view", "OWN")
  setCapabilityScope(scopes, "profile.view", "OWN")
  setCapabilityScope(scopes, "material_requests.manage", "OWN")
  setCapabilityScope(scopes, "material_requests.kpi.view", "OWN")
  setCapabilityScope(scopes, "material_requests.receiving_reports.view", "OWN")

  const isHrRole = isEmployeePortalHrRole(snapshot.companyRole)

  if (snapshot.companyRole === "EMPLOYEE") {
    setCapabilityScope(scopes, "payslips.view", "OWN")
    setCapabilityScope(scopes, "leave_requests.manage", "OWN")
    setCapabilityScope(scopes, "overtime_requests.manage", "OWN")
  }

  if (isHrRole || snapshot.isRequestApprover) {
    setCapabilityScope(scopes, "leave_approvals.view", "APPROVAL_QUEUE")
    setCapabilityScope(scopes, "overtime_approvals.view", "APPROVAL_QUEUE")
    setCapabilityScope(scopes, "material_request_approvals.view", "APPROVAL_QUEUE")
    setCapabilityScope(scopes, "approval_history.view", "APPROVAL_QUEUE")
    setCapabilityScope(scopes, "purchase_requests.approve", "APPROVAL_QUEUE")
  }

  if (
    isHrRole ||
    snapshot.isRequestApprover ||
    snapshot.isMaterialRequestPurchaser ||
    snapshot.isMaterialRequestPoster
  ) {
    setCapabilityScope(scopes, "material_requests.kpi.view_company", "COMPANY")
  }

  if (isHrRole || snapshot.isMaterialRequestPurchaser || snapshot.isMaterialRequestPoster) {
    setCapabilityScope(scopes, "material_requests.receiving_reports.view_company", "COMPANY")
  }

  if (isHrRole || snapshot.isMaterialRequestPurchaser) {
    setCapabilityScope(scopes, "material_requests.processing.manage", "COMPANY")
    setCapabilityScope(scopes, "purchase_requests.view_all", "COMPANY")
  }

  if (isHrRole || snapshot.isMaterialRequestPoster) {
    setCapabilityScope(scopes, "material_requests.posting.manage", "COMPANY")
  }

  if (snapshot.purchaseRequestWorkflowEnabled) {
    setCapabilityScope(scopes, "purchase_requests.view", "OWN")

    if (snapshot.hasEmployeeProfile) {
      setCapabilityScope(scopes, "purchase_requests.create", "OWN")
    }

    if (isHrRole) {
      setCapabilityScope(scopes, "purchase_requests.manage_all", "COMPANY")
    }

    if (isHrRole || snapshot.isMaterialRequestPurchaser) {
      setCapabilityScope(scopes, "purchase_orders.manage", "COMPANY")
      setCapabilityScope(scopes, "goods_receipt_pos.manage", "COMPANY")
    }

    if (isHrRole || snapshot.isPurchaseRequestItemManager) {
      setCapabilityScope(scopes, "procurement_item_catalog.manage", "COMPANY")
    }
  }

  if (hasModuleAccess(snapshot.companyRole, "approval-workflows")) {
    setCapabilityScope(scopes, "request_settings.manage", "COMPANY")
  }

  inheritRouteScope(scopes, "portal_routes.dashboard.view")
  inheritRouteScope(scopes, "portal_routes.payslips.view")
  inheritRouteScope(scopes, "portal_routes.leave_requests.view")
  inheritRouteScope(scopes, "portal_routes.overtime_requests.view")
  inheritRouteScope(scopes, "portal_routes.material_requests.view")
  inheritRouteScope(scopes, "portal_routes.material_request_kpis.view")
  inheritRouteScope(scopes, "portal_routes.profile.view")
  inheritRouteScope(scopes, "portal_routes.leave_approvals.view")
  inheritRouteScope(scopes, "portal_routes.overtime_approvals.view")
  inheritRouteScope(scopes, "portal_routes.material_request_approvals.view")
  inheritRouteScope(scopes, "portal_routes.approval_history.view")
  inheritRouteScope(scopes, "portal_routes.material_request_processing.view")
  inheritRouteScope(scopes, "portal_routes.purchase_orders.view")
  inheritRouteScope(scopes, "portal_routes.goods_receipt_pos.view")
  inheritRouteScope(scopes, "portal_routes.material_request_posting.view")
  inheritRouteScope(scopes, "portal_routes.material_request_receiving_reports.view")
  inheritRouteScope(scopes, "portal_routes.request_settings.view")
  inheritRouteScope(scopes, "portal_routes.procurement_item_catalog.view")
  inheritRouteScope(scopes, "portal_routes.purchase_requests.view")
  setCapabilityScope(scopes, "portal_routes.change_log.view", "OWN")

  for (const override of overrides) {
    if (canApplyEmployeePortalCapabilityOverride(snapshot, override.capability)) {
      scopes[override.capability] = override.accessScope
    }
  }

  return scopes
}

export const hasEmployeePortalCapability = (
  capabilities: Iterable<EmployeePortalCapability>,
  capability: EmployeePortalCapability
): boolean => {
  if (capabilities instanceof Set) {
    return capabilities.has(capability)
  }

  return new Set(capabilities).has(capability)
}

export const getEmployeePortalCapabilityScope = (
  capabilityScopes: EmployeePortalCapabilityScopes,
  capability: EmployeePortalCapability
): AccessScope => {
  return capabilityScopes[capability] ?? "NONE"
}

export const getEmployeePortalCapabilities = (
  snapshot: EmployeePortalAccessSnapshot,
  overrides: readonly EmployeePortalCapabilityOverride[] = []
): EmployeePortalCapability[] => {
  return Object.entries(resolveEmployeePortalCapabilityScopes(snapshot, overrides))
    .filter(([, scope]) => scope && scope !== "NONE")
    .map(([capability]) => capability as EmployeePortalCapability)
    .sort()
}
