"use client"

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ACCESS_SCOPE_LABELS, EmployeePortalAccessPreview } from "@/modules/employees/user-access/components/employee-portal-access-preview"
import {
  updateEmployeeCompanyAccessAction,
  updateEmployeePortalCapabilityOverridesAction,
  updateLinkedUserCredentialsAction,
} from "@/modules/employees/user-access/actions/manage-employee-user-access-action"
import {
  resolveEmployeePortalCapabilityScopes,
  type EmployeePortalCapability,
  type EmployeePortalCapabilityOverride,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"
import type { AccessScope } from "@/modules/auth/utils/authorization-policy"
import type { UserAccessDetailData } from "@/modules/employees/user-access/utils/get-user-access-detail-data"

type EditableCompanyAccess = {
  companyId: string
  role: "COMPANY_ADMIN" | "HR_ADMIN" | "PAYROLL_ADMIN" | "EMPLOYEE"
  isDefault: boolean
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
  isPurchaseRequestItemManager: boolean
  enabled: boolean
}

type OverrideSelection = AccessScope | "INHERIT"

type CapabilityEditorItem = {
  capability: EmployeePortalCapability
  label: string
  description: string
  allowedScopes: readonly AccessScope[]
  controlMode?: "full" | "hide-only"
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
    description: "Control which employee portal sidebar routes are visible for the selected company. Route toggles can hide available pages, but they do not grant access by themselves.",
    badgeLabel: "Route Control",
    items: EMPLOYEE_PORTAL_ROUTE_ITEMS,
  },
  {
    key: "access",
    title: "Procurement Access Control",
    description: "Control what the user can do inside procurement-related routes, including data scope, workflow actions, and processing authority.",
    badgeLabel: "Action Control",
    items: PROCUREMENT_ACCESS_CONTROL_ITEMS,
  },
]

const buildEditableCompanyAccesses = (
  companyId: string,
  companyOptions: UserAccessDetailData["companyOptions"],
  linkedCompanyAccesses: NonNullable<UserAccessDetailData["employee"]["linkedUser"]>["companyAccesses"]
): EditableCompanyAccess[] => {
  const accessByCompanyId = new Map(linkedCompanyAccesses.map((entry) => [entry.companyId, entry]))

  const mapped = companyOptions.map((company) => {
    const existing = accessByCompanyId.get(company.companyId)
    return {
      companyId: company.companyId,
      role: (existing?.role ?? "EMPLOYEE") as EditableCompanyAccess["role"],
      isDefault: existing?.isDefault ?? false,
      isMaterialRequestPurchaser: existing?.isMaterialRequestPurchaser ?? false,
      isMaterialRequestPoster: existing?.isMaterialRequestPoster ?? false,
      isPurchaseRequestItemManager: existing?.isPurchaseRequestItemManager ?? false,
      enabled: Boolean(existing) || company.companyId === companyId,
    }
  })

  const hasDefaultEnabled = mapped.some((entry) => entry.enabled && entry.isDefault)
  if (!hasDefaultEnabled) {
    const currentCompanyEntry = mapped.find((entry) => entry.companyId === companyId)
    if (currentCompanyEntry) {
      currentCompanyEntry.isDefault = true
      currentCompanyEntry.enabled = true
    }
  }

  return mapped
}

const setAccessEnabledInList = (
  companyId: string,
  list: EditableCompanyAccess[],
  targetCompanyId: string,
  enabled: boolean
): EditableCompanyAccess[] => {
  if (targetCompanyId === companyId) {
    return list.map((entry) =>
      entry.companyId === targetCompanyId ? { ...entry, enabled: true } : entry
    )
  }

  const next = list.map((entry) => (entry.companyId === targetCompanyId ? { ...entry, enabled } : entry))

  if (!enabled) {
    const disabledWasDefault = list.some(
      (entry) => entry.companyId === targetCompanyId && entry.enabled && entry.isDefault
    )
    if (disabledWasDefault) {
      let defaultAssigned = false
      for (const entry of next) {
        if (entry.enabled && !defaultAssigned) {
          entry.isDefault = true
          defaultAssigned = true
        } else {
          entry.isDefault = false
        }
      }
    }
  } else if (!next.some((entry) => entry.enabled && entry.isDefault)) {
    const enabledEntry = next.find((entry) => entry.companyId === targetCompanyId && entry.enabled)
    if (enabledEntry) {
      enabledEntry.isDefault = true
    }
  }

  return [...next]
}

const setAccessDefaultInList = (list: EditableCompanyAccess[], targetCompanyId: string): EditableCompanyAccess[] => {
  return list.map((entry) => ({
    ...entry,
    isDefault: entry.enabled && entry.companyId === targetCompanyId,
  }))
}

const patchAccessInList = (
  list: EditableCompanyAccess[],
  targetCompanyId: string,
  patch: Partial<
    Pick<
      EditableCompanyAccess,
      "role" | "isMaterialRequestPurchaser" | "isMaterialRequestPoster" | "isPurchaseRequestItemManager"
    >
  >
): EditableCompanyAccess[] => {
  return list.map((entry) => (entry.companyId === targetCompanyId ? { ...entry, ...patch } : entry))
}

const normalizeEnabledCompanyAccesses = (list: EditableCompanyAccess[]) => {
  const enabled = list.filter((entry) => entry.enabled)
  if (enabled.length === 0) {
    return []
  }

  const hasDefault = enabled.some((entry) => entry.isDefault)

  return enabled.map((entry, index) => ({
    companyId: entry.companyId,
    role: entry.role,
    isDefault: hasDefault ? entry.isDefault : index === 0,
    isMaterialRequestPurchaser: entry.isMaterialRequestPurchaser,
    isMaterialRequestPoster: entry.isMaterialRequestPoster,
    isPurchaseRequestItemManager: entry.isPurchaseRequestItemManager,
  }))
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

const buildOverrideSelectionsByCompany = (
  entries: NonNullable<UserAccessDetailData["employee"]["linkedUser"]>["portalCapabilityOverrides"]
): Record<string, Partial<Record<EmployeePortalCapability, OverrideSelection>>> => {
  const next: Record<string, Partial<Record<EmployeePortalCapability, OverrideSelection>>> = {}

  for (const entry of entries) {
    next[entry.companyId] ??= {}
    next[entry.companyId]![entry.capability] = entry.accessScope
  }

  return next
}

export function EmployeeUserAccessDetailPage({
  data,
}: {
  data: UserAccessDetailData
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const linkedUser = data.employee.linkedUser
  const [previewOpen, setPreviewOpen] = useState(false)
  const initialCompanyAccesses = useMemo(
    () =>
      linkedUser
        ? buildEditableCompanyAccesses(data.companyId, data.companyOptions, linkedUser.companyAccesses)
        : [],
    [data.companyId, data.companyOptions, linkedUser]
  )
  const initialOverrideSelectionsByCompany = useMemo<
    Record<string, Partial<Record<EmployeePortalCapability, OverrideSelection>>>
  >(() => buildOverrideSelectionsByCompany(linkedUser?.portalCapabilityOverrides ?? []), [linkedUser])

  const [username, setUsername] = useState(linkedUser?.username ?? "")
  const [password, setPassword] = useState("")
  const [isActive, setIsActive] = useState(linkedUser?.isActive ?? true)
  const [isRequestApprover, setIsRequestApprover] = useState(linkedUser?.isRequestApprover ?? false)
  const [companyAccesses, setCompanyAccesses] = useState<EditableCompanyAccess[]>(() => initialCompanyAccesses)
  const [overrideSelectionsByCompany, setOverrideSelectionsByCompany] = useState<
    Record<string, Partial<Record<EmployeePortalCapability, OverrideSelection>>>
  >(() => initialOverrideSelectionsByCompany)
  const [selectedPermissionsCompanyId, setSelectedPermissionsCompanyId] = useState(() => {
    const defaultAccess =
      linkedUser?.companyAccesses.find((entry) => entry.companyId === data.companyId) ??
      linkedUser?.companyAccesses.find((entry) => entry.isDefault) ??
      linkedUser?.companyAccesses[0]

    return defaultAccess?.companyId ?? data.companyId
  })

  const previewAccess = useMemo(
    (): EditableCompanyAccess =>
      companyAccesses.find((entry) => entry.companyId === data.companyId && entry.enabled) ??
      companyAccesses.find((entry) => entry.enabled) ??
      {
        companyId: data.companyId,
        role: "EMPLOYEE" as EditableCompanyAccess["role"],
        isDefault: true,
        isMaterialRequestPurchaser: false,
        isMaterialRequestPoster: false,
        isPurchaseRequestItemManager: false,
        enabled: true,
      },
    [companyAccesses, data.companyId]
  )

  const selectedPermissionsAccess = useMemo(
    () =>
      companyAccesses.find((entry) => entry.companyId === selectedPermissionsCompanyId) ??
      companyAccesses.find((entry) => entry.enabled) ??
      previewAccess,
    [companyAccesses, previewAccess, selectedPermissionsCompanyId]
  )
  const selectedPermissionsCompanyOption = useMemo(
    () => data.companyOptions.find((entry) => entry.companyId === selectedPermissionsCompanyId) ?? null,
    [data.companyOptions, selectedPermissionsCompanyId]
  )
  const permissionsCompanyChoices = useMemo(
    () =>
      companyAccesses
        .filter((entry) => entry.enabled)
        .map((entry) => ({
          companyId: entry.companyId,
          companyName:
            data.companyOptions.find((option) => option.companyId === entry.companyId)?.companyName ??
            entry.companyId,
        })),
    [companyAccesses, data.companyOptions]
  )

  useEffect(() => {
    if (permissionsCompanyChoices.length === 0) {
      return
    }

    if (!permissionsCompanyChoices.some((entry) => entry.companyId === selectedPermissionsCompanyId)) {
      setSelectedPermissionsCompanyId(permissionsCompanyChoices[0]!.companyId)
    }
  }, [permissionsCompanyChoices, selectedPermissionsCompanyId])
  const selectedOverrideSelections = useMemo(
    () => overrideSelectionsByCompany[selectedPermissionsCompanyId] ?? {},
    [overrideSelectionsByCompany, selectedPermissionsCompanyId]
  )

  const capabilityOverrides = useMemo<readonly EmployeePortalCapabilityOverride[]>(
    () =>
      Object.entries(selectedOverrideSelections).flatMap(([capability, accessScope]) =>
        accessScope && accessScope !== "INHERIT"
          ? [
              {
                capability: capability as EmployeePortalCapability,
                accessScope,
              },
            ]
          : []
      ),
    [selectedOverrideSelections]
  )

  const defaultCapabilityScopes = useMemo(
    () =>
      resolveEmployeePortalCapabilityScopes({
        companyRole: selectedPermissionsAccess.role,
        purchaseRequestWorkflowEnabled: Boolean(selectedPermissionsCompanyOption?.enablePurchaseRequestWorkflow),
        isRequestApprover,
        isMaterialRequestPurchaser: selectedPermissionsAccess.isMaterialRequestPurchaser,
        isMaterialRequestPoster: selectedPermissionsAccess.isMaterialRequestPoster,
        isPurchaseRequestItemManager: selectedPermissionsAccess.isPurchaseRequestItemManager,
        hasEmployeeProfile: true,
      }),
    [
      isRequestApprover,
      selectedPermissionsAccess.isMaterialRequestPoster,
      selectedPermissionsAccess.isMaterialRequestPurchaser,
      selectedPermissionsAccess.isPurchaseRequestItemManager,
      selectedPermissionsAccess.role,
      selectedPermissionsCompanyOption?.enablePurchaseRequestWorkflow,
    ]
  )

  const effectiveCapabilityScopes = useMemo(
    () =>
      resolveEmployeePortalCapabilityScopes(
        {
          companyRole: selectedPermissionsAccess.role,
          purchaseRequestWorkflowEnabled: Boolean(selectedPermissionsCompanyOption?.enablePurchaseRequestWorkflow),
          isRequestApprover,
          isMaterialRequestPurchaser: selectedPermissionsAccess.isMaterialRequestPurchaser,
          isMaterialRequestPoster: selectedPermissionsAccess.isMaterialRequestPoster,
          isPurchaseRequestItemManager: selectedPermissionsAccess.isPurchaseRequestItemManager,
          hasEmployeeProfile: true,
        },
        capabilityOverrides
      ),
    [
      capabilityOverrides,
      isRequestApprover,
      selectedPermissionsAccess.isMaterialRequestPoster,
      selectedPermissionsAccess.isMaterialRequestPurchaser,
      selectedPermissionsAccess.isPurchaseRequestItemManager,
      selectedPermissionsAccess.role,
      selectedPermissionsCompanyOption?.enablePurchaseRequestWorkflow,
    ]
  )
  const overrideCount = Object.values(overrideSelectionsByCompany).reduce(
    (count, entries) =>
      count +
      Object.values(entries).filter((accessScope) => accessScope && accessScope !== "INHERIT").length,
    0
  )
  const enabledCompanyCount = companyAccesses.filter((entry) => entry.enabled).length
  const grantedCapabilityCount = PROCUREMENT_PERMISSION_GROUPS.flatMap((section) => section.items).filter(
    (item) => (effectiveCapabilityScopes[item.capability] ?? "NONE") !== "NONE"
  ).length
  const hasUnsavedCredentialChanges =
    username !== (linkedUser?.username ?? "") ||
    isActive !== (linkedUser?.isActive ?? true) ||
    isRequestApprover !== (linkedUser?.isRequestApprover ?? false) ||
    password.trim().length > 0
  const hasUnsavedCompanyAccessChanges =
    JSON.stringify(companyAccesses) !== JSON.stringify(initialCompanyAccesses)
  const hasUnsavedOverrideChanges =
    JSON.stringify(overrideSelectionsByCompany) !== JSON.stringify(initialOverrideSelectionsByCompany)
  const hasUnsavedChanges =
    hasUnsavedCredentialChanges || hasUnsavedCompanyAccessChanges || hasUnsavedOverrideChanges

  const setCompanyAccessEnabled = (targetCompanyId: string, enabled: boolean) => {
    setCompanyAccesses((previous) =>
      setAccessEnabledInList(data.companyId, previous, targetCompanyId, enabled)
    )
  }

  const setCompanyAccessDefault = (targetCompanyId: string) => {
    setCompanyAccesses((previous) => setAccessDefaultInList(previous, targetCompanyId))
  }

  const updateCompanyAccessField = (
    targetCompanyId: string,
    patch: Partial<
      Pick<
        EditableCompanyAccess,
        "role" | "isMaterialRequestPurchaser" | "isMaterialRequestPoster" | "isPurchaseRequestItemManager"
      >
    >
  ) => {
    setCompanyAccesses((previous) => patchAccessInList(previous, targetCompanyId, patch))
  }

  const setOverrideSelection = (
    capability: EmployeePortalCapability,
    nextScope: OverrideSelection
  ) => {
    setOverrideSelectionsByCompany((previous) => {
      const currentSelections = previous[selectedPermissionsCompanyId] ?? {}

      if (nextScope === "INHERIT") {
        const { [capability]: _removed, ...restSelections } = currentSelections
        if (Object.keys(restSelections).length === 0) {
          const { [selectedPermissionsCompanyId]: _removedCompany, ...restCompanies } = previous
          return restCompanies
        }

        return {
          ...previous,
          [selectedPermissionsCompanyId]: restSelections,
        }
      }

      return {
        ...previous,
        [selectedPermissionsCompanyId]: {
          ...currentSelections,
          [capability]: nextScope,
        },
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

    setOverrideSelection(item.capability, singleScope)
  }

  const submit = () => {
    if (!linkedUser) {
      return
    }

    startTransition(async () => {
      const normalizedCompanyAccesses = normalizeEnabledCompanyAccesses(companyAccesses)
      if (normalizedCompanyAccesses.length === 0) {
        toast.error("Assign at least one company access.")
        return
      }

      const credentialsResult = await updateLinkedUserCredentialsAction({
        companyId: data.companyId,
        employeeId: data.employee.id,
        username,
        password: password.trim().length > 0 ? password : undefined,
        isActive,
        isRequestApprover,
        companyRole: previewAccess.role,
        isMaterialRequestPurchaser: previewAccess.isMaterialRequestPurchaser,
        isMaterialRequestPoster: previewAccess.isMaterialRequestPoster,
        isPurchaseRequestItemManager: previewAccess.isPurchaseRequestItemManager,
      })

      if (!credentialsResult.ok) {
        toast.error(credentialsResult.error)
        return
      }

      const companyAccessResult = await updateEmployeeCompanyAccessAction({
        companyId: data.companyId,
        employeeId: data.employee.id,
        accesses: normalizedCompanyAccesses,
      })

      if (!companyAccessResult.ok) {
        toast.error(companyAccessResult.error)
        return
      }

      const overrideCompanyIds = new Set<string>([
        ...Object.keys(initialOverrideSelectionsByCompany),
        ...normalizedCompanyAccesses.map((entry) => entry.companyId),
      ])

      for (const targetCompanyId of overrideCompanyIds) {
        const targetOverrides = normalizedCompanyAccesses.some((entry) => entry.companyId === targetCompanyId)
          ? Object.entries(overrideSelectionsByCompany[targetCompanyId] ?? {}).flatMap(([capability, accessScope]) =>
              accessScope && accessScope !== "INHERIT"
                ? [
                    {
                      capability: capability as EmployeePortalCapability,
                      accessScope,
                    },
                  ]
                : []
            )
          : []

        const overrideResult = await updateEmployeePortalCapabilityOverridesAction({
          companyId: targetCompanyId,
          employeeId: data.employee.id,
          userId: linkedUser.id,
          overrides: targetOverrides,
        })

        if (!overrideResult.ok) {
          toast.error(overrideResult.error)
          return
        }
      }

      toast.success(
        `${credentialsResult.message} ${companyAccessResult.message} Portal permissions updated.`
      )
      setPassword("")
      router.refresh()
    })
  }

  if (!linkedUser) {
    return (
      <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href={`/${data.companyId}/employees/user-access`}>
                <IconArrowLeft className="mr-2 size-4" />
                Back to User Access
              </Link>
            </Button>
            <Badge variant="outline">{data.companyName}</Badge>
          </div>

          <section className="border border-border/60 bg-background px-6 py-6">
            <p className="text-sm font-medium text-foreground">No linked user account</p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {data.employee.fullName} does not have a linked system account yet. Use the main user-access
              workspace to create or link an account first.
            </p>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-6 py-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Human Resources</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconShieldCheck className="size-6 text-primary" />
                Employee User Access
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                <IconBuilding className="mr-1 size-3.5" />
                {data.companyName}
              </Badge>
              <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                {data.employee.employeeNumber}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Update login setup, company assignments, and employee-portal permissions for this linked employee account.
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
              <p className="text-sm font-medium text-foreground">Employee Profile</p>
            </div>
            <div className="space-y-4 p-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-14 w-14 shrink-0 rounded-none border border-border/60 after:rounded-none">
                  <AvatarImage
                    src={data.employee.photoUrl ?? undefined}
                    alt={data.employee.fullName}
                    className="!rounded-none object-cover"
                  />
                  <AvatarFallback className="!rounded-none bg-primary/5 text-sm font-semibold text-primary">
                    {`${data.employee.firstName[0] ?? ""}${data.employee.lastName[0] ?? ""}`}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{data.employee.fullName}</p>
                    <Badge variant={isActive ? "default" : "destructive"}>
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p>{username}</p>
                    {data.employee.department ? <p>{data.employee.department}</p> : null}
                    {data.employee.position ? <p>{data.employee.position}</p> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <SummaryCard
                  label="Companies"
                  value={enabledCompanyCount}
                  detail="Active assignments"
                  icon={<IconBuilding className="size-4" />}
                />
                <SummaryCard
                  label="Portal"
                  value={grantedCapabilityCount}
                  detail="Selected company route and access controls"
                  icon={<IconShieldCheck className="size-4" />}
                />
                <SummaryCard
                  label="Overrides"
                  value={overrideCount}
                  detail={hasUnsavedChanges ? "Unsaved changes pending" : "All changes saved"}
                  icon={<IconKey className="size-4" />}
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
                <span>Changes apply to the active company and the linked system account.</span>
                <Badge variant={hasUnsavedChanges ? "secondary" : "outline"}>
                  {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
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
                  Match this layout with the rest of the admin workspaces.
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
                        Username, password, active status, and approver responsibility for this user.
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
                        placeholder="e.g. john.doe"
                        className="border-border/70"
                      />
                      <p className="text-[11px] text-muted-foreground">The login ID this employee uses to sign in.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">New Password</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={isPending}
                        placeholder="Leave blank to keep current"
                        className="border-border/70"
                      />
                      <p className="text-[11px] text-muted-foreground">Only fill this in if you want to change their password.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <FlagSwitch
                      label="Active Account"
                      hint="When turned off, this employee cannot log in."
                      checked={isActive}
                      disabled={isPending}
                      onCheckedChange={setIsActive}
                    />
                    <FlagSwitch
                      label="Request Approver"
                      hint="When turned on, this employee can approve leave, overtime, and material requests submitted by others."
                      checked={isRequestApprover}
                      disabled={isPending}
                      onCheckedChange={setIsRequestApprover}
                    />
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
                        Choose which companies this employee can access, assign their role in each company, and enable workflow responsibilities like purchasing and posting.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                  <CardContent className="space-y-4 p-0">
                    <div className="overflow-x-auto">
                      <Table className="text-xs">
                        <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead>Enabled</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead title="Can this user buy items on behalf of the company when processing material requests?">
                          MRS Purchaser
                        </TableHead>
                        <TableHead title="Can this user finalize and post completed material requests into the system?">
                          MRS Poster
                        </TableHead>
                        <TableHead title="Can this user manage items in the procurement catalog?">
                          Item Manager
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyAccesses.map((access) => {
                        const company = data.companyOptions.find((option) => option.companyId === access.companyId)
                        const isCurrentCompany = access.companyId === data.companyId

                        return (
                          <TableRow key={access.companyId}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={access.enabled}
                                  onCheckedChange={(checked) =>
                                    setCompanyAccessEnabled(access.companyId, checked === true)
                                  }
                                  disabled={isPending || isCurrentCompany}
                                />
                                {isCurrentCompany ? <Badge variant="secondary">Required</Badge> : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{company?.companyName ?? access.companyId}</p>
                                <p className="text-[11px] text-muted-foreground">{company?.companyCode ?? ""}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={access.role}
                                onValueChange={(value) =>
                                  updateCompanyAccessField(access.companyId, {
                                    role: value as EditableCompanyAccess["role"],
                                  })
                                }
                                disabled={isPending || !access.enabled}
                              >
                                <SelectTrigger className="w-[180px] border-border/70">
                                  <SelectValue placeholder="Role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                                  <SelectItem value="HR_ADMIN">HR Admin</SelectItem>
                                  <SelectItem value="PAYROLL_ADMIN">Payroll Admin</SelectItem>
                                  <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant={access.isDefault && access.enabled ? "default" : "outline"}
                                size="sm"
                                disabled={isPending || !access.enabled}
                                onClick={() => setCompanyAccessDefault(access.companyId)}
                                className="h-7 px-2 text-[11px]"
                              >
                                {access.isDefault && access.enabled ? "Default" : "Set Default"}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={access.isMaterialRequestPurchaser}
                                onCheckedChange={(checked) =>
                                  updateCompanyAccessField(access.companyId, {
                                    isMaterialRequestPurchaser: checked,
                                  })
                                }
                                disabled={isPending || !access.enabled}
                              />
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={access.isMaterialRequestPoster}
                                onCheckedChange={(checked) =>
                                  updateCompanyAccessField(access.companyId, {
                                    isMaterialRequestPoster: checked,
                                  })
                                }
                                disabled={isPending || !access.enabled}
                              />
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={access.isPurchaseRequestItemManager}
                                onCheckedChange={(checked) =>
                                  updateCompanyAccessField(access.companyId, {
                                    isPurchaseRequestItemManager: checked,
                                  })
                                }
                                disabled={isPending || !access.enabled}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="px-5 pb-5">
                      <div className="border border-border/60 bg-muted/15 px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                          <strong>Tip:</strong> The <em>Default</em> company is the one this employee sees first when they log in.
                          <em> MRS Purchaser</em> lets them buy items when processing material requests.
                          <em> MRS Poster</em> lets them finalize completed requests.
                          <em> Item Manager</em> lets them maintain the item catalog.
                        </p>
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
                        Edit employee portal route visibility and per-company procurement access overrides. Leave/overtime approver behavior stays separate and is not managed here.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={selectedPermissionsCompanyId}
                      onValueChange={setSelectedPermissionsCompanyId}
                    >
                      <SelectTrigger className="h-8 w-[240px] border-border/70">
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent>
                        {permissionsCompanyChoices.map((company) => (
                          <SelectItem key={company.companyId} value={company.companyId}>
                            {company.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant={selectedPermissionsCompanyOption?.enablePurchaseRequestWorkflow ? "default" : "outline"}>
                      {selectedPermissionsCompanyOption?.enablePurchaseRequestWorkflow
                        ? "PR Workflow Enabled"
                        : "PR Workflow Disabled"}
                    </Badge>
                  </div>
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
                        <p className="text-[11px] font-medium text-foreground">1. Pick a company</p>
                        <p className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                          You are editing portal permissions for{" "}
                          <span className="font-medium text-foreground">
                            {selectedPermissionsCompanyOption?.companyName ?? "the selected company"}
                          </span>{" "}
                          only.
                        </p>
                      </div>
                      <div className="border-b border-border/60 px-3 py-2.5 sm:border-b-0 sm:border-r">
                        <p className="text-[11px] font-medium text-foreground">2. Review the default</p>
                        <p className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                          The <span className="font-medium text-foreground">Role Default</span> column shows what the
                          current role and workflow flags already grant.
                        </p>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[11px] font-medium text-foreground">3. Override only exceptions</p>
                        <p className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                          Use route controls to hide sidebar items, and use access control to widen or restrict
                          actual page authority for this company.
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
                        selectedOverrideSelections={selectedOverrideSelections}
                        defaultCapabilityScopes={defaultCapabilityScopes}
                        effectiveCapabilityScopes={effectiveCapabilityScopes}
                        selectedCompanyName={selectedPermissionsCompanyOption?.companyName ?? "this company"}
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
              Save updates after reviewing credentials, company access, and per-company procurement permission overrides.
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" disabled={isPending}>
                <Link href={`/${data.companyId}/employees/user-access`}>Cancel</Link>
              </Button>
              <Button onClick={submit} disabled={isPending || !hasUnsavedChanges}>
                Save Access Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Access Preview Sheet */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Effective Access Preview</SheetTitle>
            <SheetDescription>
              Live preview of the selected company&apos;s employee portal route visibility and access after your changes.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6">
            <EmployeePortalAccessPreview
              title="Access Summary"
              description={`Resolved route visibility and capabilities for ${selectedPermissionsCompanyOption?.companyName ?? "the selected company"} based on role, company flags, and overrides.`}
              companyRole={selectedPermissionsAccess.role}
              isRequestApprover={isRequestApprover}
              isMaterialRequestPurchaser={selectedPermissionsAccess.isMaterialRequestPurchaser}
              isMaterialRequestPoster={selectedPermissionsAccess.isMaterialRequestPoster}
              isPurchaseRequestItemManager={selectedPermissionsAccess.isPurchaseRequestItemManager}
              hasEmployeeProfile
              purchaseRequestWorkflowEnabled={Boolean(selectedPermissionsCompanyOption?.enablePurchaseRequestWorkflow)}
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
  icon: ReactNode
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
              <Badge
                variant="outline"
                className="h-5 border-border/70 bg-background px-1.5 text-[10px] uppercase tracking-wide data-[state=open]:border-primary/40 data-[state=open]:bg-primary/10"
              >
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
                const canEnableFromHere = !isHideOnly || defaultScope !== "NONE"

                return (
                  <TableRow key={item.capability} className="align-top">
                    <TableCell className="align-middle py-1.5">
                      <p className="text-xs font-medium text-foreground">{item.label}</p>
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
                                disabled={isPending || (isHideOnly && !canEnableFromHere)}
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
                            onValueChange={(value) =>
                              setOverrideSelection(item.capability, value as OverrideSelection)
                            }
                            disabled={isPending}
                          >
                            <SelectTrigger className="h-8 w-[190px] border-border/70">
                              <SelectValue placeholder="Select override" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="INHERIT">{scopeOptionLabel("INHERIT")}</SelectItem>
                                <SelectItem value="NONE">{scopeOptionLabel("NONE")}</SelectItem>
                                {item.allowedScopes.map((scope) => (
                                  <SelectItem key={scope} value={scope}>
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
