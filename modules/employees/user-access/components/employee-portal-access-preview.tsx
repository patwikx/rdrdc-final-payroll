"use client"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  USER_ACCESS_FLAG_DEFINITIONS,
  getModuleAccessScope,
  type AccessScope,
  type CompanyRole,
  type ModuleKey,
} from "@/modules/auth/utils/authorization-policy"
import {
  resolveEmployeePortalCapabilityScopes,
  type EmployeePortalAccessSnapshot,
  type EmployeePortalCapability,
  type EmployeePortalCapabilityOverride,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"

const DASHBOARD_MODULE_PREVIEWS: Array<{ key: ModuleKey; label: string }> = [
  { key: "employees", label: "Employees" },
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave" },
  { key: "overtime", label: "Overtime" },
  { key: "payroll", label: "Payroll" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
]

export const PORTAL_ROUTE_PREVIEWS: Array<{ key: EmployeePortalCapability; label: string }> = [
  { key: "portal_routes.dashboard.view", label: "Dashboard" },
  { key: "portal_routes.payslips.view", label: "My Payslips" },
  { key: "portal_routes.leave_requests.view", label: "Leave Requests" },
  { key: "portal_routes.overtime_requests.view", label: "Overtime Requests" },
  { key: "portal_routes.material_requests.view", label: "Material Requests" },
  { key: "portal_routes.material_request_kpis.view", label: "Material Request KPI" },
  { key: "portal_routes.profile.view", label: "My Profile" },
  { key: "portal_routes.leave_approvals.view", label: "Leave Approvals" },
  { key: "portal_routes.overtime_approvals.view", label: "Overtime Approvals" },
  { key: "portal_routes.material_request_approvals.view", label: "MRS/PR Approvals" },
  { key: "portal_routes.approval_history.view", label: "Approval History" },
  { key: "portal_routes.material_request_processing.view", label: "Material Request Processing" },
  { key: "portal_routes.purchase_orders.view", label: "Purchase Orders" },
  { key: "portal_routes.goods_receipt_pos.view", label: "Goods Receipt PO" },
  { key: "portal_routes.material_request_posting.view", label: "Material Request Posting" },
  { key: "portal_routes.material_request_receiving_reports.view", label: "Receiving Reports" },
  { key: "portal_routes.request_settings.view", label: "MRS/PR Settings" },
  { key: "portal_routes.procurement_item_catalog.view", label: "Global Item Catalog" },
  { key: "portal_routes.purchase_requests.view", label: "Purchase Requests" },
  { key: "portal_routes.change_log.view", label: "Change Log" },
]

export const PORTAL_CAPABILITY_PREVIEWS: Array<{ key: EmployeePortalCapability; label: string }> = [
  { key: "portal.dashboard.view", label: "Dashboard" },
  { key: "profile.view", label: "Profile" },
  { key: "payslips.view", label: "Payslips" },
  { key: "leave_requests.manage", label: "Leave Requests" },
  { key: "overtime_requests.manage", label: "Overtime Requests" },
  { key: "material_requests.manage", label: "Material Requests" },
  { key: "material_requests.kpi.view", label: "Material Request KPI" },
  { key: "leave_approvals.view", label: "Leave Approvals" },
  { key: "overtime_approvals.view", label: "Overtime Approvals" },
  { key: "material_request_approvals.view", label: "MRS/PR Approvals" },
  { key: "approval_history.view", label: "Approval History" },
  { key: "material_requests.processing.manage", label: "Material Processing" },
  { key: "material_requests.posting.manage", label: "Material Posting" },
  { key: "material_requests.receiving_reports.view", label: "Receiving Reports" },
  { key: "request_settings.manage", label: "Request Settings" },
  { key: "procurement_item_catalog.manage", label: "Item Catalog" },
  { key: "purchase_requests.view", label: "Purchase Requests" },
  { key: "purchase_orders.manage", label: "Purchase Orders" },
  { key: "goods_receipt_pos.manage", label: "Goods Receipt PO" },
]

export const ACCESS_SCOPE_LABELS: Record<AccessScope, string> = {
  NONE: "No Access",
  OWN: "Own Only",
  APPROVAL_QUEUE: "Approval Queue",
  COMPANY: "Company-Wide",
}

const scopeBadgeVariant = (scope: AccessScope): "secondary" | "outline" | "default" => {
  if (scope === "COMPANY") return "default"
  if (scope === "APPROVAL_QUEUE") return "secondary"
  return "outline"
}

export function EmployeePortalAccessPreview({
  title,
  description,
  companyRole,
  isRequestApprover,
  isMaterialRequestPurchaser,
  isMaterialRequestPoster,
  isPurchaseRequestItemManager,
  hasEmployeeProfile,
  purchaseRequestWorkflowEnabled,
  capabilityOverrides = [],
  layout = "dialog",
}: {
  title: string
  description: string
  companyRole: CompanyRole
  isRequestApprover: boolean
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
  isPurchaseRequestItemManager: boolean
  hasEmployeeProfile: boolean
  purchaseRequestWorkflowEnabled: boolean
  capabilityOverrides?: readonly EmployeePortalCapabilityOverride[]
  layout?: "dialog" | "page"
}) {
  const accessSnapshot: EmployeePortalAccessSnapshot = {
    companyRole,
    purchaseRequestWorkflowEnabled,
    isRequestApprover,
    isMaterialRequestPurchaser,
    isMaterialRequestPoster,
    isPurchaseRequestItemManager,
    hasEmployeeProfile,
  }

  const activeFlags = {
    isRequestApprover,
    isMaterialRequestPurchaser,
    isMaterialRequestPoster,
    isPurchaseRequestItemManager,
  }

  const activeFlagDefinitions = USER_ACCESS_FLAG_DEFINITIONS.filter(
    (definition) => activeFlags[definition.key]
  )
  const capabilityScopes = resolveEmployeePortalCapabilityScopes(accessSnapshot, capabilityOverrides)
  const isPageLayout = layout === "page"

  return (
    <section className="space-y-4 border border-border/60 bg-muted/10 px-4 py-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{companyRole}</Badge>
          <Badge variant={purchaseRequestWorkflowEnabled ? "default" : "outline"}>
            {purchaseRequestWorkflowEnabled ? "PR Workflow On" : "PR Workflow Off"}
          </Badge>
          <Badge variant={hasEmployeeProfile ? "secondary" : "outline"}>
            {hasEmployeeProfile ? "Employee-linked" : "No employee profile"}
          </Badge>
        </div>
      </div>

      <div className={isPageLayout ? "grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]" : "grid gap-3 lg:grid-cols-[1.1fr_1fr]"}>
        <div className="space-y-3">
          <div className="border border-border/60 bg-background px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Special Flags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {USER_ACCESS_FLAG_DEFINITIONS.map((definition) => (
                <Badge
                  key={definition.key}
                  variant={activeFlags[definition.key] ? "default" : "outline"}
                  className="gap-1.5"
                >
                  <span>{definition.label}</span>
                  <span className="text-[10px] opacity-70">{definition.assignmentScope}</span>
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {activeFlagDefinitions.length > 0
                ? `${activeFlagDefinitions.length} special access flag${activeFlagDefinitions.length > 1 ? "s are" : " is"} active.`
                : "No extra access flags are active; role defaults will apply."}
            </p>
          </div>

          <div className="border border-border/60 bg-background">
            <div className="border-b border-border/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Portal Routes</p>
            </div>
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead>Sidebar Route</TableHead>
                    <TableHead className="w-[120px]">Visibility</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PORTAL_ROUTE_PREVIEWS.map((routePreview) => (
                    <TableRow key={routePreview.key}>
                      <TableCell className="font-medium text-foreground">{routePreview.label}</TableCell>
                      <TableCell>
                        <Badge variant={scopeBadgeVariant(capabilityScopes[routePreview.key] ?? "NONE")}>
                          {(capabilityScopes[routePreview.key] ?? "NONE") === "NONE" ? "Hidden" : "Visible"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="border border-border/60 bg-background">
            <div className="border-b border-border/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Dashboard Modules</p>
            </div>
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead className="w-[120px]">Access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DASHBOARD_MODULE_PREVIEWS.map((modulePreview) => (
                    <TableRow key={modulePreview.key}>
                      <TableCell className="font-medium text-foreground">{modulePreview.label}</TableCell>
                      <TableCell>
                        <Badge variant={scopeBadgeVariant(getModuleAccessScope(companyRole, modulePreview.key))}>
                          {ACCESS_SCOPE_LABELS[getModuleAccessScope(companyRole, modulePreview.key)]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="border border-border/60 bg-background">
          <div className="border-b border-border/60 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Employee Portal Access</p>
          </div>
          {isPageLayout ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[720px] text-xs">
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead>Page / Capability</TableHead>
                    <TableHead className="w-[150px]">Effective Access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PORTAL_CAPABILITY_PREVIEWS.map((capability) => (
                    <TableRow key={capability.key}>
                      <TableCell className="font-medium text-foreground">{capability.label}</TableCell>
                      <TableCell>
                        <Badge variant={scopeBadgeVariant(capabilityScopes[capability.key] ?? "NONE")}>
                          {ACCESS_SCOPE_LABELS[capabilityScopes[capability.key] ?? "NONE"]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mt-2 grid gap-2 px-3 py-3">
              {PORTAL_CAPABILITY_PREVIEWS.map((capability) => (
                <div
                  key={capability.key}
                  className="flex items-center justify-between gap-3 border border-border/50 px-2.5 py-2"
                >
                  <span className="text-xs font-medium text-foreground">{capability.label}</span>
                  <Badge variant={scopeBadgeVariant(capabilityScopes[capability.key] ?? "NONE")}>
                    {ACCESS_SCOPE_LABELS[capabilityScopes[capability.key] ?? "NONE"]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
