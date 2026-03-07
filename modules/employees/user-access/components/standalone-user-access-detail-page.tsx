"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconArrowLeft,
  IconBuilding,
  IconEye,
  IconKey,
  IconShieldCheck,
  IconUser,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AccessScope, CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  createStandaloneSystemUserAction,
  updateStandaloneSystemUserAction,
} from "@/modules/employees/user-access/actions/manage-employee-user-access-action"
import {
  ACCESS_SCOPE_LABELS,
  EmployeePortalAccessPreview,
} from "@/modules/employees/user-access/components/employee-portal-access-preview"
import {
  resolveEmployeePortalCapabilityScopes,
  type EmployeePortalCapability,
  type EmployeePortalCapabilityOverride,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"
import type { StandaloneUserAccessFormData } from "@/modules/employees/user-access/utils/get-standalone-user-access-detail-data"

type OverrideSelection = AccessScope | "INHERIT"

type CapabilityEditorItem = {
  capability: EmployeePortalCapability
  label: string
  description: string
  allowedScopes: readonly AccessScope[]
  controlMode?: "full" | "hide-only"
  requiresEmployeeProfile?: boolean
}

const EMPLOYEE_PORTAL_ROUTE_ITEMS: CapabilityEditorItem[] = [
  {
    capability: "portal_routes.dashboard.view",
    label: "Dashboard",
    description: "Show the employee portal dashboard in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.payslips.view",
    label: "My Payslips",
    description: "Show the payslips route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.leave_requests.view",
    label: "Leave Requests",
    description: "Show the leave requests route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.overtime_requests.view",
    label: "Overtime Requests",
    description: "Show the overtime requests route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.material_requests.view",
    label: "Material Requests",
    description: "Show the material requests route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.material_request_kpis.view",
    label: "Material Request KPI",
    description: "Show the material request KPI route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.profile.view",
    label: "My Profile",
    description: "Show the profile route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.leave_approvals.view",
    label: "Leave Approvals",
    description: "Show the leave approvals queue in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.overtime_approvals.view",
    label: "Overtime Approvals",
    description: "Show the overtime approvals queue in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.material_request_approvals.view",
    label: "MRS/PR Approvals",
    description: "Show the material and purchase request approvals queue in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.approval_history.view",
    label: "Approval History",
    description: "Show the approval history route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.material_request_processing.view",
    label: "Material Request Processing",
    description: "Show the material request processing workspace in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.purchase_orders.view",
    label: "Purchase Orders",
    description: "Show the purchase orders workspace in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.goods_receipt_pos.view",
    label: "Goods Receipt PO",
    description: "Show the goods receipt PO workspace in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.material_request_posting.view",
    label: "Material Request Posting",
    description: "Show the material request posting workspace in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.material_request_receiving_reports.view",
    label: "Receiving Reports",
    description: "Show the receiving reports route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.request_settings.view",
    label: "MRS/PR Settings",
    description: "Show the request settings route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.procurement_item_catalog.view",
    label: "Global Item Catalog",
    description: "Show the procurement item catalog route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.purchase_requests.view",
    label: "Purchase Requests",
    description: "Show the purchase requests route in the sidebar.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
  {
    capability: "portal_routes.change_log.view",
    label: "Change Log",
    description: "Show the change log link in the sidebar footer.",
    allowedScopes: ["OWN"],
    controlMode: "hide-only",
  },
]

const PROCUREMENT_ACCESS_CONTROL_ITEMS: CapabilityEditorItem[] = [
  {
    capability: "material_requests.manage",
    label: "Material Requests Access",
    description: "Allow the user to open and manage their own material requests.",
    allowedScopes: ["OWN"],
  },
  {
    capability: "material_requests.kpi.view",
    label: "Material Request KPI Access",
    description: "Allow KPI and summary access for material requests.",
    allowedScopes: ["OWN", "COMPANY"],
  },
  {
    capability: "material_requests.receiving_reports.view",
    label: "Receiving Reports Access",
    description: "Allow receiving report visibility for own requests, or company-wide when elevated.",
    allowedScopes: ["OWN", "COMPANY"],
  },
  {
    capability: "purchase_requests.view",
    label: "Purchase Requests Access",
    description: "Allow the user to open purchase request records.",
    allowedScopes: ["OWN", "COMPANY"],
  },
  {
    capability: "purchase_requests.create",
    label: "Create Purchase Requests",
    description: "Allow creation and draft editing of purchase requests owned by the user.",
    allowedScopes: ["OWN"],
    requiresEmployeeProfile: true,
  },
  {
    capability: "material_requests.processing.manage",
    label: "Process Material Requests",
    description: "Review, fulfill, and manage incoming material requests for the selected company.",
    allowedScopes: ["COMPANY"],
  },
  {
    capability: "material_requests.posting.manage",
    label: "Post Material Requests",
    description: "Finalize and post completed material requests in the selected company.",
    allowedScopes: ["COMPANY"],
  },
  {
    capability: "material_requests.kpi.view_company",
    label: "Company Material KPI",
    description: "Allow company-wide KPI and summary visibility for material requests.",
    allowedScopes: ["COMPANY"],
  },
  {
    capability: "material_requests.receiving_reports.view_company",
    label: "Company-Wide Receiving Reports",
    description: "Allow visibility into all receiving reports produced by the selected company.",
    allowedScopes: ["COMPANY"],
  },
  {
    capability: "procurement_item_catalog.manage",
    label: "Manage Item Catalog",
    description: "Maintain the procurement item catalog used by the selected company.",
    allowedScopes: ["COMPANY"],
  },
  {
    capability: "purchase_requests.view_all",
    label: "View All Purchase Requests",
    description: "Allow visibility into all purchase requests in the selected company.",
    allowedScopes: ["COMPANY"],
  },
  {
    capability: "purchase_requests.manage_all",
    label: "Manage All Purchase Requests",
    description: "Allow action-taking across purchase requests in the selected company.",
    allowedScopes: ["COMPANY"],
  },
  {
    capability: "purchase_orders.manage",
    label: "Manage Purchase Orders",
    description: "Allow creation, editing, and maintenance of purchase orders for the selected company.",
    allowedScopes: ["COMPANY"],
  },
  {
    capability: "goods_receipt_pos.manage",
    label: "Manage GRPO",
    description: "Allow goods receipt posting and management against purchase orders for the selected company.",
    allowedScopes: ["COMPANY"],
  },
]

const PROCUREMENT_PERMISSION_GROUPS: Array<{
  key: string
  title: string
  description: string
  badgeLabel: string
  items: CapabilityEditorItem[]
}> = [
  {
    key: "routes",
    title: "Employee Portal Routes",
    description:
      "Control which employee portal sidebar routes are visible for the selected company. Route toggles can hide available pages, but they do not grant access by themselves.",
    badgeLabel: "Route Control",
    items: EMPLOYEE_PORTAL_ROUTE_ITEMS,
  },
  {
    key: "access",
    title: "Procurement Access Control",
    description:
      "Control what the user can do inside procurement-related routes, including data scope, workflow actions, and processing authority.",
    badgeLabel: "Action Control",
    items: PROCUREMENT_ACCESS_CONTROL_ITEMS,
  },
]

const buildOverrideSelections = (
  entries: StandaloneUserAccessFormData["user"]["portalCapabilityOverrides"]
): Partial<Record<EmployeePortalCapability, OverrideSelection>> => {
  const next: Partial<Record<EmployeePortalCapability, OverrideSelection>> = {}

  for (const entry of entries) {
    next[entry.capability] = entry.accessScope
  }

  return next
}

const scopeOptionLabel = (scope: OverrideSelection) =>
  scope === "INHERIT" ? "Inherit Role Default" : ACCESS_SCOPE_LABELS[scope]

const isBinaryCapabilityItem = (item: CapabilityEditorItem): boolean => item.allowedScopes.length === 1

const getSingleAllowedScope = (item: CapabilityEditorItem): AccessScope | null =>
  item.allowedScopes.length === 1 ? item.allowedScopes[0] : null

const getSectionOverrideCount = (
  items: CapabilityEditorItem[],
  overrideSelections: Partial<Record<EmployeePortalCapability, OverrideSelection>>
): number => items.filter((item) => (overrideSelections[item.capability] ?? "INHERIT") !== "INHERIT").length

const getSectionEnabledCount = (
  items: CapabilityEditorItem[],
  effectiveCapabilityScopes: Partial<Record<EmployeePortalCapability, AccessScope>>
): number => items.filter((item) => (effectiveCapabilityScopes[item.capability] ?? "NONE") !== "NONE").length

export function StandaloneUserAccessDetailPage({
  data,
  mode = "edit",
}: {
  data: StandaloneUserAccessFormData
  mode?: "edit" | "create"
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [previewOpen, setPreviewOpen] = useState(false)
  const initialOverrideSelections = useMemo(
    () => buildOverrideSelections(data.user.portalCapabilityOverrides),
    [data.user.portalCapabilityOverrides]
  )

  const [firstName, setFirstName] = useState(data.user.firstName)
  const [lastName, setLastName] = useState(data.user.lastName)
  const [username, setUsername] = useState(data.user.username)
  const [password, setPassword] = useState("")
  const [isActive, setIsActive] = useState(data.user.isActive)
  const [companyRole, setCompanyRole] = useState(data.user.companyRole)
  const [isRequestApprover, setIsRequestApprover] = useState(data.user.isRequestApprover)
  const [isMaterialRequestPurchaser, setIsMaterialRequestPurchaser] = useState(data.user.isMaterialRequestPurchaser)
  const [isMaterialRequestPoster, setIsMaterialRequestPoster] = useState(data.user.isMaterialRequestPoster)
  const [isPurchaseRequestItemManager, setIsPurchaseRequestItemManager] = useState(data.user.isPurchaseRequestItemManager)
  const [enableExternalRequesterProfile, setEnableExternalRequesterProfile] = useState(
    data.user.hasExternalRequesterProfile
  )
  const [externalRequesterBranchId, setExternalRequesterBranchId] = useState(
    data.user.externalRequesterBranchId ?? ""
  )
  const [overrideSelections, setOverrideSelections] = useState<
    Partial<Record<EmployeePortalCapability, OverrideSelection>>
  >(initialOverrideSelections)

  const capabilityOverrides = useMemo<readonly EmployeePortalCapabilityOverride[]>(
    () =>
      Object.entries(overrideSelections).flatMap(([capability, accessScope]) =>
        accessScope && accessScope !== "INHERIT"
          ? [
              {
                capability: capability as EmployeePortalCapability,
                accessScope,
              },
            ]
          : []
      ),
    [overrideSelections]
  )

  const defaultCapabilityScopes = useMemo(
    () =>
      resolveEmployeePortalCapabilityScopes({
        companyRole,
        purchaseRequestWorkflowEnabled: data.purchaseRequestWorkflowEnabled,
        isRequestApprover,
        isMaterialRequestPurchaser,
        isMaterialRequestPoster,
        isPurchaseRequestItemManager,
        hasEmployeeProfile: enableExternalRequesterProfile,
      }),
    [
      companyRole,
      data.purchaseRequestWorkflowEnabled,
      enableExternalRequesterProfile,
      isMaterialRequestPoster,
      isMaterialRequestPurchaser,
      isPurchaseRequestItemManager,
      isRequestApprover,
    ]
  )

  const effectiveCapabilityScopes = useMemo(
    () =>
      resolveEmployeePortalCapabilityScopes(
        {
          companyRole,
          purchaseRequestWorkflowEnabled: data.purchaseRequestWorkflowEnabled,
          isRequestApprover,
          isMaterialRequestPurchaser,
          isMaterialRequestPoster,
          isPurchaseRequestItemManager,
          hasEmployeeProfile: enableExternalRequesterProfile,
        },
        capabilityOverrides
      ),
    [
      capabilityOverrides,
      companyRole,
      data.purchaseRequestWorkflowEnabled,
      enableExternalRequesterProfile,
      isMaterialRequestPoster,
      isMaterialRequestPurchaser,
      isPurchaseRequestItemManager,
      isRequestApprover,
    ]
  )

  const overrideCount = Object.values(overrideSelections).filter(
    (accessScope) => accessScope && accessScope !== "INHERIT"
  ).length

  const grantedCapabilityCount = PROCUREMENT_PERMISSION_GROUPS.flatMap((section) => section.items).filter(
    (item) => (effectiveCapabilityScopes[item.capability] ?? "NONE") !== "NONE"
  ).length
  const selectedExternalRequesterBranchLabel = useMemo(() => {
    const selectedBranch = data.branchOptions.find((branch) => branch.id === externalRequesterBranchId)
    if (!selectedBranch) return null
    return selectedBranch.code ? `${selectedBranch.code} - ${selectedBranch.name}` : selectedBranch.name
  }, [data.branchOptions, externalRequesterBranchId])
  const isCreateMode = mode === "create"
  const isAgencyAccount = enableExternalRequesterProfile || Boolean(data.user.hasExternalRequesterProfile)
  const pageTitle = isCreateMode ? "Create Standalone Account" : isAgencyAccount ? "Agency User Access" : "Standalone User Access"
  const pageDescription = isCreateMode
    ? "Create an unlinked company account with workflow flags, branch assignment, and employee portal sidebar controls."
    : isAgencyAccount
      ? "Update login setup, requester-profile status, and employee portal permissions for this standalone agency account."
      : "Update login setup, workflow flags, and employee portal permissions for this standalone company account."
  const headerStatusBadgeLabel = isCreateMode ? "New Account" : data.user.externalRequesterCode ?? "Standalone"
  const submitButtonLabel = isCreateMode ? "Create System Account" : "Save Access Changes"
  const footerDescription = isCreateMode
    ? "Create the account after reviewing credentials, workflow flags, branch assignment, and employee portal permission overrides."
    : "Save updates after reviewing credentials, workflow flags, and employee portal permission overrides."
  const summaryStatusText = isCreateMode
    ? "New account has not been saved yet."
    : isAgencyAccount
      ? "Changes apply to the active company and this standalone agency account."
      : "Changes apply to the active company and this standalone company account."
  const previewDescription = isCreateMode
    ? `Preview the resolved route visibility and capabilities for ${data.companyName} before creating the account.`
    : `Resolved route visibility and capabilities for ${data.companyName} based on role, workflow flags, requester profile state, and overrides.`

  const hasUnsavedChanges =
    firstName !== data.user.firstName ||
    lastName !== data.user.lastName ||
    username !== data.user.username ||
    isActive !== data.user.isActive ||
    companyRole !== data.user.companyRole ||
    isRequestApprover !== data.user.isRequestApprover ||
    isMaterialRequestPurchaser !== data.user.isMaterialRequestPurchaser ||
    isMaterialRequestPoster !== data.user.isMaterialRequestPoster ||
    isPurchaseRequestItemManager !== data.user.isPurchaseRequestItemManager ||
    enableExternalRequesterProfile !== data.user.hasExternalRequesterProfile ||
    externalRequesterBranchId !== (data.user.externalRequesterBranchId ?? "") ||
    JSON.stringify(overrideSelections) !== JSON.stringify(initialOverrideSelections) ||
    password.trim().length > 0

  const setOverrideSelection = (
    capability: EmployeePortalCapability,
    nextScope: OverrideSelection
  ) => {
    setOverrideSelections((previous) => {
      if (nextScope === "INHERIT") {
        const { [capability]: _removed, ...restSelections } = previous
        return restSelections
      }

      return {
        ...previous,
        [capability]: nextScope,
      }
    })
  }

  const toggleBinaryCapability = (item: CapabilityEditorItem, checked: boolean) => {
    const singleScope = getSingleAllowedScope(item)
    if (!singleScope) return

    const defaultScope = defaultCapabilityScopes[item.capability] ?? "NONE"

    if (!checked) {
      setOverrideSelection(item.capability, "NONE")
      return
    }

    if (defaultScope !== "NONE") {
      setOverrideSelection(item.capability, "INHERIT")
      return
    }

    if (item.controlMode === "hide-only") {
      return
    }

    if (item.requiresEmployeeProfile && !enableExternalRequesterProfile) {
      return
    }

    setOverrideSelection(item.capability, singleScope)
  }

  const submit = () => {
    startTransition(async () => {
      if (enableExternalRequesterProfile && !externalRequesterBranchId) {
        toast.error("Select a branch for the External PR Requester Profile.")
        return
      }

      const result = isCreateMode
        ? await createStandaloneSystemUserAction({
            companyId: data.companyId,
            firstName,
            lastName,
            username,
            password,
            companyRole,
            isRequestApprover,
            isMaterialRequestPurchaser,
            isMaterialRequestPoster,
            isPurchaseRequestItemManager,
            enableExternalRequesterProfile,
            externalRequesterBranchId: enableExternalRequesterProfile ? externalRequesterBranchId : undefined,
            overrides: [...capabilityOverrides],
          })
        : await updateStandaloneSystemUserAction({
            companyId: data.companyId,
            userId: data.user.id,
            firstName,
            lastName,
            username,
            password: password.trim().length > 0 ? password : undefined,
            isActive,
            companyRole,
            isRequestApprover,
            isMaterialRequestPurchaser,
            isMaterialRequestPoster,
            isPurchaseRequestItemManager,
            enableExternalRequesterProfile,
            externalRequesterBranchId: enableExternalRequesterProfile ? externalRequesterBranchId : undefined,
            overrides: [...capabilityOverrides],
          })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      if (isCreateMode) {
        if ("userId" in result) {
          router.push(`/${data.companyId}/employees/user-access/agency/${result.userId}`)
          return
        }

        router.push(`/${data.companyId}/employees/user-access`)
        return
      }

      setPassword("")
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-6 py-6">
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Human Resources
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconShieldCheck className="size-6 text-primary" />
                {pageTitle}
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                <IconBuilding className="mr-1 size-3.5" />
                {data.companyName}
              </Badge>
              <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                {headerStatusBadgeLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {pageDescription}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/${data.companyId}/employees/user-access`}>
              <Button variant="outline" className="gap-2">
                <IconArrowLeft className="size-3.5" />
                Back to User Access
              </Button>
            </Link>
            <Button variant="outline" className="gap-2" onClick={() => setPreviewOpen(true)}>
              <IconEye className="size-3.5" />
              Access Preview
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-3">
          <div className="border border-border/60 bg-background">
            <div className="border-b border-border/60 px-3 py-2">
              <p className="text-sm font-medium text-foreground">
                {isAgencyAccount ? "Agency Account" : "Standalone Account"}
              </p>
            </div>
            <div className="space-y-4 p-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{`${lastName}, ${firstName}`}</p>
                  <Badge variant={isActive ? "default" : "destructive"}>
                    {isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{username}</p>
                <p className="text-xs text-muted-foreground">
                  {enableExternalRequesterProfile
                    ? isCreateMode
                      ? `Requester code will be assigned after save for ${selectedExternalRequesterBranchLabel ?? "the selected branch"}.`
                      : `Requester code ${data.user.externalRequesterCode ?? "-"} is active for ${
                          data.user.externalRequesterBranchName ?? "an unassigned branch"
                        }.`
                    : isCreateMode
                      ? "Enable the requester profile if this standalone account should create purchase requests."
                      : "External requester profile is currently disabled."}
                </p>
              </div>

              <div className="grid gap-2">
                <SummaryCard
                  label="Portal"
                  value={grantedCapabilityCount}
                  detail="Route and access controls resolved for this company"
                  icon={<IconShieldCheck className="size-4" />}
                />
                <SummaryCard
                  label="Overrides"
                  value={overrideCount}
                  detail={hasUnsavedChanges ? "Unsaved changes pending" : isCreateMode ? "No changes entered yet" : "All changes saved"}
                  icon={<IconKey className="size-4" />}
                />
                <SummaryCard
                  label="Profile"
                  value={enableExternalRequesterProfile ? 1 : 0}
                  detail={
                    enableExternalRequesterProfile
                      ? selectedExternalRequesterBranchLabel ?? "Branch required"
                      : "Requester profile disabled"
                  }
                  icon={<IconUser className="size-4" />}
                />
              </div>
            </div>
          </div>

          <div className="border border-border/60 bg-background">
            <div className="border-b border-border/60 px-3 py-2">
              <p className="text-sm font-medium text-foreground">Change Status</p>
            </div>
            <div className="p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <IconUser className="size-3.5" />
                <span>{summaryStatusText}</span>
                <Badge variant={hasUnsavedChanges ? "secondary" : "outline"}>
                  {hasUnsavedChanges ? "Unsaved changes" : isCreateMode ? "Draft setup" : "All changes saved"}
                </Badge>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-3">
          <Tabs defaultValue="setup" className="space-y-3">
            <div className="border border-border/60 bg-background px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="h-auto rounded-none border border-border/60 bg-muted/20 p-1">
                  <TabsTrigger
                    value="setup"
                    className="gap-2 rounded-none px-3 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <IconKey className="size-3.5" />
                    User Setup
                  </TabsTrigger>
                  <TabsTrigger
                    value="permissions"
                    className="gap-2 rounded-none px-3 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <IconShieldCheck className="size-3.5" />
                    Portal Permissions
                  </TabsTrigger>
                </TabsList>
                <p className="text-xs text-muted-foreground">
                  {isCreateMode
                    ? "Create the standalone account with the same full control model used in agency user access."
                    : isAgencyAccount
                      ? "Agency requester accounts follow the same control model as employee user access."
                      : "Standalone company accounts use the same full access editor as linked employee users."}
                </p>
              </div>
            </div>

            <TabsContent value="setup" className="mt-0">
              <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="rounded-none border-border/60 py-0 shadow-none">
                  <CardHeader className="border-b border-border/60 pb-3 pt-4">
                    <div className="flex items-center gap-2">
                      <IconKey className="size-4 text-primary" />
                      <div>
                        <CardTitle className="text-sm">Login Credentials & Account Settings</CardTitle>
                        <CardDescription className="text-xs">
                          {isCreateMode
                            ? "Set the login credentials, approver status, and requester profile for the new account."
                            : "Username, password, active status, and approver responsibility for this user."}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pb-5 pt-4">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Username<span className="ml-1 text-destructive">*</span>
                        </Label>
                        <Input
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          disabled={isPending}
                          className="border-border/70"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {isCreateMode ? (
                            <>
                              Temporary Password<span className="ml-1 text-destructive">*</span>
                            </>
                          ) : (
                            "New Password"
                          )}
                        </Label>
                        <Input
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          disabled={isPending}
                          placeholder={isCreateMode ? "Required to create account" : "Leave blank to keep current"}
                          className="border-border/70"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <FlagSwitch
                        label="Active Account"
                        hint={
                          isCreateMode
                            ? "New standalone accounts are created as active by default."
                            : isAgencyAccount
                              ? "When turned off, this agency user cannot log in."
                              : "When turned off, this standalone user cannot log in."
                        }
                        checked={isActive}
                        disabled={isPending || isCreateMode}
                        onCheckedChange={setIsActive}
                      />
                      <FlagSwitch
                        label="Request Approver"
                        hint="When turned on, this user can approve leave, overtime, and material requests submitted by others."
                        checked={isRequestApprover}
                        disabled={isPending}
                        onCheckedChange={setIsRequestApprover}
                      />
                      <FlagSwitch
                        label="External PR Requester Profile"
                        hint="Required before this standalone account can create purchase requests."
                        checked={enableExternalRequesterProfile}
                        disabled={isPending}
                        onCheckedChange={setEnableExternalRequesterProfile}
                      />
                      {enableExternalRequesterProfile ? (
                        <div className="space-y-1.5 border border-border/60 bg-background px-3 py-3">
                          <Label className="text-xs">
                            Requester Branch<span className="ml-1 text-destructive">*</span>
                          </Label>
                          <Select
                            value={externalRequesterBranchId}
                            onValueChange={setExternalRequesterBranchId}
                            disabled={isPending || data.branchOptions.length === 0}
                          >
                            <SelectTrigger className="border-border/70">
                              <SelectValue
                                placeholder={
                                  data.branchOptions.length === 0 ? "No active branches available" : "Select branch"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {data.branchOptions.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  {branch.code ? `${branch.code} - ${branch.name}` : branch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] leading-4 text-muted-foreground">
                            Purchase requests created by this account will use the selected branch context.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-border/60 py-0 shadow-none">
                  <CardHeader className="border-b border-border/60 pb-3 pt-4">
                    <div className="flex items-center gap-2">
                      <IconBuilding className="size-4 text-primary" />
                      <div>
                        <CardTitle className="text-sm">Company Role & Workflow Access</CardTitle>
                        <CardDescription className="max-w-3xl text-xs">
                          Assign the role for this company and enable workflow responsibilities like purchasing,
                          posting, and item management.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          First Name<span className="ml-1 text-destructive">*</span>
                        </Label>
                        <Input
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                          disabled={isPending}
                          className="border-border/70"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Last Name<span className="ml-1 text-destructive">*</span>
                        </Label>
                        <Input
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
                          disabled={isPending}
                          className="border-border/70"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Role<span className="ml-1 text-destructive">*</span>
                      </Label>
                      <Select
                        value={companyRole}
                        onValueChange={(value) => setCompanyRole(value as StandaloneUserAccessFormData["user"]["companyRole"])}
                        disabled={isPending}
                      >
                        <SelectTrigger className="w-[220px] border-border/70">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMPLOYEE">Employee</SelectItem>
                          <SelectItem value="APPROVER">Approver</SelectItem>
                          <SelectItem value="HR_ADMIN">HR Admin</SelectItem>
                          <SelectItem value="PAYROLL_ADMIN">Payroll Admin</SelectItem>
                          <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="flex h-8 items-center justify-between border border-border/60 px-2.5">
                        <span className="text-xs text-foreground">MRS Purchaser</span>
                        <Switch
                          checked={isMaterialRequestPurchaser}
                          onCheckedChange={setIsMaterialRequestPurchaser}
                          disabled={isPending}
                        />
                      </div>
                      <div className="flex h-8 items-center justify-between border border-border/60 px-2.5">
                        <span className="text-xs text-foreground">MRS Poster</span>
                        <Switch
                          checked={isMaterialRequestPoster}
                          onCheckedChange={setIsMaterialRequestPoster}
                          disabled={isPending}
                        />
                      </div>
                      <div className="flex h-8 items-center justify-between border border-border/60 px-2.5">
                        <span className="text-xs text-foreground">Item Manager</span>
                        <Switch
                          checked={isPurchaseRequestItemManager}
                          onCheckedChange={setIsPurchaseRequestItemManager}
                          disabled={isPending}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="mt-0">
              <Card className="rounded-none border-border/60 py-0 shadow-none">
                <CardHeader className="border-b border-border/60 pb-3 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <IconShieldCheck className="size-4 text-primary" />
                      <div>
                        <CardTitle className="text-sm">Company Employee Portal Permissions</CardTitle>
                        <CardDescription className="max-w-3xl text-xs">
                          Edit employee portal route visibility and procurement access overrides for this
                          {isAgencyAccount ? " standalone agency" : " standalone"} account in {data.companyName}.
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={data.purchaseRequestWorkflowEnabled ? "default" : "outline"}>
                      {data.purchaseRequestWorkflowEnabled ? "PR Workflow Enabled" : "PR Workflow Disabled"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2.5 pb-4 pt-3">
                  <div className="border border-border/60 bg-muted/15">
                    <div className="border-b border-border/60 px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        How It Works
                      </p>
                    </div>
                    <div className="grid gap-0 sm:grid-cols-3">
                      <div className="border-b border-border/60 px-3 py-2.5 sm:border-b-0 sm:border-r">
                        <p className="text-[11px] font-medium text-foreground">1. Review the role default</p>
                        <p className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                          The <span className="font-medium text-foreground">Role Default</span> column shows what
                          this account already gets from role and workflow flags.
                        </p>
                      </div>
                      <div className="border-b border-border/60 px-3 py-2.5 sm:border-b-0 sm:border-r">
                        <p className="text-[11px] font-medium text-foreground">2. Hide routes if needed</p>
                        <p className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                          Route controls only affect sidebar visibility. They do not grant actual authority by
                          themselves.
                        </p>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[11px] font-medium text-foreground">3. Override only exceptions</p>
                        <p className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                          Use access control overrides when this user needs more or less procurement authority than
                          the default.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Accordion
                    type="multiple"
                    defaultValue={PROCUREMENT_PERMISSION_GROUPS.map((section) => section.key)}
                    className="space-y-2"
                  >
                    {PROCUREMENT_PERMISSION_GROUPS.map((section) => (
                      <PermissionControlPanel
                        key={section.key}
                        sectionKey={section.key}
                        title={section.title}
                        description={section.description}
                        badgeLabel={section.badgeLabel}
                        items={section.items}
                        selectedOverrideSelections={overrideSelections}
                        defaultCapabilityScopes={defaultCapabilityScopes}
                        effectiveCapabilityScopes={effectiveCapabilityScopes}
                        selectedCompanyName={data.companyName}
                        canUseRequesterOnlyCapabilities={enableExternalRequesterProfile}
                        isPending={isPending}
                        setOverrideSelection={setOverrideSelection}
                        toggleBinaryCapability={toggleBinaryCapability}
                      />
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-border/60 bg-background">
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {footerDescription}
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" disabled={isPending}>
                <Link href={`/${data.companyId}/employees/user-access`}>Cancel</Link>
              </Button>
              <Button onClick={submit} disabled={isPending || !hasUnsavedChanges}>
                {submitButtonLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Effective Access Preview</SheetTitle>
            <SheetDescription>
              Live preview of the selected company&apos;s employee portal route visibility and access after your
              changes.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6">
            <EmployeePortalAccessPreview
              title="Access Summary"
              description={previewDescription}
              companyRole={companyRole}
              isRequestApprover={isRequestApprover}
              isMaterialRequestPurchaser={isMaterialRequestPurchaser}
              isMaterialRequestPoster={isMaterialRequestPoster}
              isPurchaseRequestItemManager={isPurchaseRequestItemManager}
              hasEmployeeProfile={enableExternalRequesterProfile}
              purchaseRequestWorkflowEnabled={data.purchaseRequestWorkflowEnabled}
              capabilityOverrides={capabilityOverrides}
              layout="page"
            />
          </div>
        </SheetContent>
      </Sheet>
    </main>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: number
  detail: string
  icon: React.ReactNode
}) {
  return (
    <div className="border border-border/60 bg-background px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <div className="border border-border/60 bg-muted/40 p-2 text-muted-foreground">{icon}</div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  )
}

function PermissionControlPanel({
  sectionKey,
  title,
  description,
  badgeLabel,
  items,
  selectedOverrideSelections,
  defaultCapabilityScopes,
  effectiveCapabilityScopes,
  selectedCompanyName,
  canUseRequesterOnlyCapabilities,
  isPending,
  setOverrideSelection,
  toggleBinaryCapability,
}: {
  sectionKey: string
  title: string
  description: string
  badgeLabel: string
  items: CapabilityEditorItem[]
  selectedOverrideSelections: Partial<Record<EmployeePortalCapability, OverrideSelection>>
  defaultCapabilityScopes: Partial<Record<EmployeePortalCapability, AccessScope>>
  effectiveCapabilityScopes: Partial<Record<EmployeePortalCapability, AccessScope>>
  selectedCompanyName: string
  canUseRequesterOnlyCapabilities: boolean
  isPending: boolean
  setOverrideSelection: (capability: EmployeePortalCapability, nextScope: OverrideSelection) => void
  toggleBinaryCapability: (item: CapabilityEditorItem, checked: boolean) => void
}) {
  const overrideItems = getSectionOverrideCount(items, selectedOverrideSelections)
  const enabledItems = getSectionEnabledCount(items, effectiveCapabilityScopes)
  const isRouteVisibilitySection = items.every((item) => item.controlMode === "hide-only")
  const sectionHelperText = isRouteVisibilitySection
    ? "Route controls only affect sidebar visibility. They do not grant or expand actual page access."
    : `Keep Inherit to follow the current ${selectedCompanyName} default. Use overrides to grant, widen, or remove procurement access for this company.`

  return (
    <AccordionItem value={sectionKey} className="overflow-hidden border border-border/60 bg-background">
      <AccordionTrigger className="group items-center border-l-2 border-l-transparent bg-muted/35 px-3 py-2.5 hover:no-underline data-[state=open]:border-l-primary data-[state=open]:bg-primary/10">
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 pr-3 text-left">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <Badge variant="outline" className="h-5 border-border/70 bg-background px-1.5 text-[10px] uppercase tracking-wide">
                {badgeLabel}
              </Badge>
            </div>
            <p className="mt-0.5 max-w-3xl text-[11px] leading-4.5 text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 border-border/70 bg-background px-1.5 text-[10px]">
              {enabledItems} enabled
            </Badge>
            <Badge
              variant={overrideItems > 0 ? "secondary" : "outline"}
              className={overrideItems > 0 ? "h-5 px-1.5 text-[10px]" : "h-5 border-border/70 bg-background px-1.5 text-[10px]"}
            >
              {overrideItems} override{overrideItems === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="border-t border-border/60 bg-muted/10 px-2.5 pb-1 pt-2.5">
        <div className="overflow-hidden border border-border/60 bg-background">
          <div className="border-b border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-[11px] leading-4.5 text-muted-foreground">{sectionHelperText}</p>
          </div>
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[34%]">Permission</TableHead>
                  <TableHead className="w-[12%]">Role Default</TableHead>
                  <TableHead className="w-[30%]">Your Override</TableHead>
                  <TableHead className="w-[12%]">Final Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-background">
                {items.map((item) => {
                  const selectedValue = selectedOverrideSelections[item.capability] ?? "INHERIT"
                  const defaultScope = defaultCapabilityScopes[item.capability] ?? "NONE"
                  const effectiveScope = effectiveCapabilityScopes[item.capability] ?? "NONE"
                  const isBinary = isBinaryCapabilityItem(item)
                  const singleScope = getSingleAllowedScope(item)
                  const binaryChecked = effectiveScope !== "NONE"
                  const isHideOnly = item.controlMode === "hide-only"
                  const requiresEmployeeProfile = Boolean(item.requiresEmployeeProfile)
                  const blockedByProfile = requiresEmployeeProfile && !canUseRequesterOnlyCapabilities
                  const canEnableFromHere = !isHideOnly || defaultScope !== "NONE"

                  return (
                    <TableRow key={item.capability} className="align-top">
                      <TableCell className="align-middle py-1.5">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-foreground">{item.label}</p>
                          {blockedByProfile ? (
                            <p className="text-[11px] leading-4 text-muted-foreground">
                              Enable External PR Requester Profile first to grant this capability.
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className={isHideOnly ? "align-middle py-1.5" : "align-top py-2"}>
                        {isHideOnly ? (
                          <VisibilityBadge visible={defaultScope !== "NONE"} />
                        ) : (
                          <ScopeBadge scope={defaultScope} />
                        )}
                      </TableCell>
                      <TableCell className={isHideOnly ? "align-middle py-1.5" : "align-top py-2"}>
                        {isBinary && singleScope ? (
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={binaryChecked}
                                onCheckedChange={(checked) => toggleBinaryCapability(item, checked)}
                                disabled={isPending || (isHideOnly && !canEnableFromHere) || blockedByProfile}
                              />
                              <span className="text-xs text-foreground">
                                {binaryChecked ? (isHideOnly ? "Visible" : "Enabled") : isHideOnly ? "Hidden" : "Disabled"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Select
                              value={selectedValue}
                              onValueChange={(value) => setOverrideSelection(item.capability, value as OverrideSelection)}
                              disabled={isPending}
                            >
                              <SelectTrigger className="h-8 w-[220px] border-border/70">
                                <SelectValue placeholder="Select override" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="INHERIT">{scopeOptionLabel("INHERIT")}</SelectItem>
                                <SelectItem value="NONE">{scopeOptionLabel("NONE")}</SelectItem>
                                {item.allowedScopes.map((scope) => (
                                  <SelectItem
                                    key={scope}
                                    value={scope}
                                    disabled={blockedByProfile && scope !== "NONE"}
                                  >
                                    {scopeOptionLabel(scope)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={isHideOnly ? "align-middle py-1.5" : "align-top py-2"}>
                        {isHideOnly ? (
                          <VisibilityBadge visible={effectiveScope !== "NONE"} />
                        ) : (
                          <ScopeBadge scope={effectiveScope} />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function ScopeBadge({ scope }: { scope: AccessScope }) {
  return (
    <Badge variant={scope === "COMPANY" ? "default" : scope === "APPROVAL_QUEUE" ? "secondary" : "outline"}>
      {ACCESS_SCOPE_LABELS[scope]}
    </Badge>
  )
}

function VisibilityBadge({ visible }: { visible: boolean }) {
  return <Badge variant={visible ? "default" : "outline"}>{visible ? "Visible" : "Hidden"}</Badge>
}

function FlagSwitch({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 border border-border/60 bg-background px-3 py-3">
      <div className="min-w-0 space-y-0.5">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint ? <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}
