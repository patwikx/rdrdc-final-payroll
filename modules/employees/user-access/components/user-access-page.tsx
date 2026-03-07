"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  IconAlertCircle,
  IconBuilding,
  IconKey,
  IconLink,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

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
} from "@/modules/employee-portal/utils/employee-portal-access-policy"
import {
  deleteStandaloneSystemUserAction,
  createEmployeeSystemUserAction,
  createStandaloneSystemUserAction,
  getAvailableSystemUsersAction,
  linkEmployeeToExistingUserAction,
  unlinkEmployeeUserAction,
  updateEmployeeCompanyAccessAction,
  updateLinkedUserCredentialsAction,
  updateStandaloneSystemUserAction,
} from "@/modules/employees/user-access/actions/manage-employee-user-access-action"
import type {
  AvailableSystemUserOption,
  UserAccessCompanyOption,
  UserAccessLinkFilter,
  UserAccessRoleFilter,
  SystemUserAccountRow,
  UserAccessPreviewRow,
} from "@/modules/employees/user-access/utils/get-user-access-preview-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { UserAccessWorkspace } from "./user-access-workspace"

type UserAccessPageProps = {
  companyId: string
  companyName: string
  rows: UserAccessPreviewRow[]
  systemUsers: SystemUserAccountRow[]
  companyOptions: UserAccessCompanyOption[]
  query: string
  employeeLinkFilter: UserAccessLinkFilter
  systemLinkFilter: UserAccessLinkFilter
  roleFilter: UserAccessRoleFilter
  employeePagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  systemUserPagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  purchaseRequestWorkflowEnabled: boolean
}

type EditableCompanyAccess = {
  companyId: string
  role: "COMPANY_ADMIN" | "HR_ADMIN" | "PAYROLL_ADMIN" | "EMPLOYEE"
  isDefault: boolean
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
  isPurchaseRequestItemManager: boolean
  enabled: boolean
}

const buildDefaultCompanyAccesses = (
  companyOptions: UserAccessCompanyOption[],
  currentCompanyId: string
): EditableCompanyAccess[] => {
  return companyOptions.map((company) => ({
    companyId: company.companyId,
    role: "EMPLOYEE",
    isDefault: company.companyId === currentCompanyId,
    isMaterialRequestPurchaser: false,
    isMaterialRequestPoster: false,
    isPurchaseRequestItemManager: false,
    enabled: company.companyId === currentCompanyId,
  }))
}

const setAccessEnabledInList = (
  list: EditableCompanyAccess[],
  targetCompanyId: string,
  enabled: boolean
): EditableCompanyAccess[] => {
  const next = list.map((entry) => (entry.companyId === targetCompanyId ? { ...entry, enabled } : entry))

  if (!enabled) {
    const disabledWasDefault = list.some((entry) => entry.companyId === targetCompanyId && entry.enabled && entry.isDefault)
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

const DASHBOARD_MODULE_PREVIEWS: Array<{ key: ModuleKey; label: string }> = [
  { key: "employees", label: "Employees" },
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave" },
  { key: "overtime", label: "Overtime" },
  { key: "payroll", label: "Payroll" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
]

const PORTAL_CAPABILITY_PREVIEWS: Array<{ key: EmployeePortalCapability; label: string }> = [
  { key: "payslips.view", label: "Payslips" },
  { key: "leave_requests.manage", label: "Leave Requests" },
  { key: "overtime_requests.manage", label: "Overtime Requests" },
  { key: "leave_approvals.view", label: "Leave Approvals" },
  { key: "material_requests.processing.manage", label: "Material Processing" },
  { key: "material_requests.posting.manage", label: "Material Posting" },
  { key: "procurement_item_catalog.manage", label: "Item Catalog" },
  { key: "purchase_orders.manage", label: "Purchase Orders" },
]

const ACCESS_SCOPE_LABELS: Record<AccessScope, string> = {
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

type ActionDialogState =
  | { type: "NONE" }
  | { type: "CREATE"; row: UserAccessPreviewRow }
  | { type: "LINK"; row: UserAccessPreviewRow }
  | { type: "CREATE_SYSTEM" }
  | { type: "EDIT"; row: { employeeId: string; employeeNumber: string; fullName: string } }
  | { type: "EDIT_SYSTEM"; user: SystemUserAccountRow }

const resolveUnifiedLinkFilter = (
  employeeFilter: UserAccessLinkFilter,
  systemFilter: UserAccessLinkFilter
): UserAccessLinkFilter => (employeeFilter !== "ALL" ? employeeFilter : systemFilter)

type UserAccessQueryState = {
  q: string
  empLink: UserAccessLinkFilter
  sysLink: UserAccessLinkFilter
  role: UserAccessRoleFilter
  empPage: number
  sysPage: number
}

type UserAccessFetchScope = "ALL" | "EMPLOYEES" | "SYSTEM_USERS"

type UserAccessDataResponse = {
  scope: UserAccessFetchScope
  rows?: UserAccessPreviewRow[]
  systemUsers?: SystemUserAccountRow[]
  query: string
  employeeLinkFilter: UserAccessLinkFilter
  systemLinkFilter: UserAccessLinkFilter
  roleFilter: UserAccessRoleFilter
  employeePagination?: UserAccessPageProps["employeePagination"]
  systemUserPagination?: UserAccessPageProps["systemUserPagination"]
}

export function UserAccessPage({
  companyId,
  companyName,
  rows,
  systemUsers,
  companyOptions,
  query,
  employeeLinkFilter,
  systemLinkFilter,
  roleFilter,
  employeePagination,
  systemUserPagination,
  purchaseRequestWorkflowEnabled,
}: UserAccessPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [queryInput, setQueryInput] = useState(query)
  const [linkFilterInput, setLinkFilterInput] = useState<UserAccessLinkFilter>(
    resolveUnifiedLinkFilter(employeeLinkFilter, systemLinkFilter)
  )
  const [roleFilterInput, setRoleFilterInput] = useState<UserAccessRoleFilter>(roleFilter)
  const [rowsState, setRowsState] = useState<UserAccessPreviewRow[]>(rows)
  const [systemUsersState, setSystemUsersState] = useState<SystemUserAccountRow[]>(systemUsers)
  const [employeePaginationState, setEmployeePaginationState] = useState(employeePagination)
  const [systemUserPaginationState, setSystemUserPaginationState] = useState(systemUserPagination)
  const [isDataPending, setIsDataPending] = useState(false)
  const dataRequestControllerRef = useRef<AbortController | null>(null)
  const dataCacheRef = useRef<Map<string, UserAccessDataResponse>>(new Map())
  const inFlightPrefetchKeysRef = useRef<Set<string>>(new Set())
  const lastRequestedStateRef = useRef<UserAccessQueryState>({
    q: query,
    empLink: employeeLinkFilter,
    sysLink: systemLinkFilter,
    role: roleFilter,
    empPage: employeePagination.page,
    sysPage: systemUserPagination.page,
  })

  const [dialogState, setDialogState] = useState<ActionDialogState>({ type: "NONE" })
  const [isMutationPending, startMutationTransition] = useTransition()
  const [isAvailableUsersPending, startAvailableUsersTransition] = useTransition()
  const isPending = isMutationPending || isDataPending
  const [availableUsers, setAvailableUsers] = useState<AvailableSystemUserOption[]>([])

  const buildDataCacheKey = useCallback((scope: UserAccessFetchScope, state: UserAccessQueryState): string => {
    const base = [
      `q=${state.q.trim().toLowerCase()}`,
      `empLink=${state.empLink}`,
      `sysLink=${state.sysLink}`,
      `role=${state.role}`,
    ]
    if (scope === "ALL") {
      return [...base, `empPage=${state.empPage}`, `sysPage=${state.sysPage}`].join("&")
    }
    if (scope === "EMPLOYEES") {
      return [...base, `scope=EMPLOYEES`, `empPage=${state.empPage}`].join("&")
    }
    return [...base, `scope=SYSTEM_USERS`, `sysPage=${state.sysPage}`].join("&")
  }, [])

  const [createUsername, setCreateUsername] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createApprover, setCreateApprover] = useState(false)
  const [createCompanyAccesses, setCreateCompanyAccesses] = useState<EditableCompanyAccess[]>(() =>
    buildDefaultCompanyAccesses(companyOptions, companyId)
  )

  const [linkUserId, setLinkUserId] = useState("")
  const [linkCompanyAccesses, setLinkCompanyAccesses] = useState<EditableCompanyAccess[]>(() =>
    buildDefaultCompanyAccesses(companyOptions, companyId)
  )

  const [editUsername, setEditUsername] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editApprover, setEditApprover] = useState(false)
  const [editIsActive, setEditIsActive] = useState(true)
  const [editCompanyAccesses, setEditCompanyAccesses] = useState<EditableCompanyAccess[]>([])

  const [systemFirstName, setSystemFirstName] = useState("")
  const [systemLastName, setSystemLastName] = useState("")
  const [systemUsername, setSystemUsername] = useState("")
  const [systemEmail, setSystemEmail] = useState("")
  const [systemPassword, setSystemPassword] = useState("")
  const [systemRole, setSystemRole] = useState<EditableCompanyAccess["role"]>("EMPLOYEE")
  const [systemApprover, setSystemApprover] = useState(false)
  const [systemIsMaterialRequestPurchaser, setSystemIsMaterialRequestPurchaser] = useState(false)
  const [systemIsMaterialRequestPoster, setSystemIsMaterialRequestPoster] = useState(false)
  const [systemIsPurchaseRequestItemManager, setSystemIsPurchaseRequestItemManager] = useState(false)
  const [systemEditFirstName, setSystemEditFirstName] = useState("")
  const [systemEditLastName, setSystemEditLastName] = useState("")
  const [systemEditUsername, setSystemEditUsername] = useState("")
  const [systemEditEmail, setSystemEditEmail] = useState("")
  const [systemEditPassword, setSystemEditPassword] = useState("")
  const [systemEditRole, setSystemEditRole] = useState<EditableCompanyAccess["role"]>("EMPLOYEE")
  const [systemEditApprover, setSystemEditApprover] = useState(false)
  const [systemEditIsActive, setSystemEditIsActive] = useState(true)
  const [systemEditIsMaterialRequestPurchaser, setSystemEditIsMaterialRequestPurchaser] = useState(false)
  const [systemEditIsMaterialRequestPoster, setSystemEditIsMaterialRequestPoster] = useState(false)
  const [systemEditIsPurchaseRequestItemManager, setSystemEditIsPurchaseRequestItemManager] = useState(false)
  const [systemDeleteTarget, setSystemDeleteTarget] = useState<SystemUserAccountRow | null>(null)

  useEffect(() => {
    setQueryInput(query)
  }, [query])

  useEffect(() => {
    setLinkFilterInput(resolveUnifiedLinkFilter(employeeLinkFilter, systemLinkFilter))
  }, [employeeLinkFilter, systemLinkFilter])

  useEffect(() => {
    setRoleFilterInput(roleFilter)
  }, [roleFilter])

  useEffect(() => {
    setRowsState(rows)
  }, [rows])

  useEffect(() => {
    setSystemUsersState(systemUsers)
  }, [systemUsers])

  useEffect(() => {
    setEmployeePaginationState(employeePagination)
  }, [employeePagination])

  useEffect(() => {
    setSystemUserPaginationState(systemUserPagination)
  }, [systemUserPagination])

  useEffect(() => {
    lastRequestedStateRef.current = {
      q: query,
      empLink: employeeLinkFilter,
      sysLink: systemLinkFilter,
      role: roleFilter,
      empPage: employeePagination.page,
      sysPage: systemUserPagination.page,
    }
  }, [employeeLinkFilter, employeePagination.page, query, roleFilter, systemLinkFilter, systemUserPagination.page])

  useEffect(() => {
    const initialPayload: UserAccessDataResponse = {
      scope: "ALL",
      query,
      employeeLinkFilter,
      systemLinkFilter,
      roleFilter,
      rows,
      systemUsers,
      employeePagination,
      systemUserPagination,
    }
    dataCacheRef.current.set(
      buildDataCacheKey("ALL", {
        q: query,
        empLink: employeeLinkFilter,
        sysLink: systemLinkFilter,
        role: roleFilter,
        empPage: employeePagination.page,
        sysPage: systemUserPagination.page,
      }),
      initialPayload
    )
  }, [
    buildDataCacheKey,
    employeeLinkFilter,
    employeePagination,
    query,
    roleFilter,
    rows,
    systemLinkFilter,
    systemUserPagination,
    systemUsers,
  ])

  useEffect(() => {
    return () => {
      dataRequestControllerRef.current?.abort()
    }
  }, [])

  const buildEditableCompanyAccesses = (
    linkedCompanyAccesses: UserAccessPreviewRow["linkedCompanyAccesses"],
    linkedCompanyRole: string | null
  ): EditableCompanyAccess[] => {
    const accessByCompanyId = new Map(linkedCompanyAccesses.map((entry) => [entry.companyId, entry]))

    const mapped = companyOptions.map((company) => {
      const existing = accessByCompanyId.get(company.companyId)
      return {
        companyId: company.companyId,
        role: (existing?.role ?? (company.companyId === companyId ? (linkedCompanyRole ?? "EMPLOYEE") : "EMPLOYEE")) as EditableCompanyAccess["role"],
        isDefault: existing?.isDefault ?? false,
        isMaterialRequestPurchaser: existing?.isMaterialRequestPurchaser ?? false,
        isMaterialRequestPoster: existing?.isMaterialRequestPoster ?? false,
        isPurchaseRequestItemManager: existing?.isPurchaseRequestItemManager ?? false,
        enabled: Boolean(existing) || company.companyId === companyId,
      }
    })

    const hasDefaultEnabled = mapped.some((entry) => entry.enabled && entry.isDefault)
    if (!hasDefaultEnabled) {
      const currentCompanyEntry = mapped.find((entry) => entry.companyId === companyId && entry.enabled)
      if (currentCompanyEntry) {
        currentCompanyEntry.isDefault = true
      } else {
        const firstEnabled = mapped.find((entry) => entry.enabled)
        if (firstEnabled) {
          firstEnabled.isDefault = true
        }
      }
    }

    return mapped
  }

  const buildQueryState = useCallback((updates: {
    q?: string
    empLink?: UserAccessLinkFilter
    sysLink?: UserAccessLinkFilter
    role?: UserAccessRoleFilter
    empPage?: number
    sysPage?: number
  }) => {
    return {
      q: typeof updates.q !== "undefined" ? updates.q : queryInput,
      empLink: typeof updates.empLink !== "undefined" ? updates.empLink : linkFilterInput,
      sysLink: typeof updates.sysLink !== "undefined" ? updates.sysLink : "LINKED",
      role: typeof updates.role !== "undefined" ? updates.role : roleFilterInput,
      empPage:
        typeof updates.empPage !== "undefined" ? updates.empPage : employeePaginationState.page,
      sysPage:
        typeof updates.sysPage !== "undefined" ? updates.sysPage : systemUserPaginationState.page,
    } satisfies UserAccessQueryState
  }, [
    employeePaginationState.page,
    linkFilterInput,
    queryInput,
    roleFilterInput,
    systemUserPaginationState.page,
  ])

  const buildRouteHref = useCallback((state: UserAccessQueryState) => {
    const params = new URLSearchParams()

    const queryValue = state.q.trim()
    if (queryValue) {
      params.set("q", queryValue)
    }

    if (state.empLink !== "ALL") {
      params.set("empLink", state.empLink)
    }

    if (state.sysLink !== "LINKED") {
      params.set("sysLink", state.sysLink)
    }

    if (state.role !== "ALL") {
      params.set("role", state.role)
    }

    if (state.empPage > 1) {
      params.set("empPage", String(state.empPage))
    }

    if (state.sysPage > 1) {
      params.set("sysPage", String(state.sysPage))
    }

    const next = params.toString()
    return next ? `${pathname}?${next}` : pathname
  }, [pathname])

  const buildDataRequestParams = useCallback((state: UserAccessQueryState, scope: UserAccessFetchScope) => {
    const params = new URLSearchParams()
    const queryValue = state.q.trim()
    if (queryValue) params.set("q", queryValue)
    if (state.empLink !== "ALL") params.set("empLink", state.empLink)
    if (state.sysLink !== "LINKED") params.set("sysLink", state.sysLink)
    if (state.role !== "ALL") params.set("role", state.role)
    if (state.empPage > 1) params.set("empPage", String(state.empPage))
    if (state.sysPage > 1) params.set("sysPage", String(state.sysPage))
    if (scope !== "ALL") params.set("scope", scope)
    return params
  }, [])

  const applyDataPayload = useCallback((payload: UserAccessDataResponse, fallbackState: UserAccessQueryState) => {
    if (payload.rows && payload.employeePagination) {
      setRowsState(payload.rows)
      setEmployeePaginationState(payload.employeePagination)
    }
    if (payload.systemUsers && payload.systemUserPagination) {
      setSystemUsersState(payload.systemUsers)
      setSystemUserPaginationState(payload.systemUserPagination)
    }

    lastRequestedStateRef.current = {
      q: payload.query,
      empLink: payload.employeeLinkFilter,
      sysLink: payload.systemLinkFilter,
      role: payload.roleFilter,
      empPage: payload.employeePagination?.page ?? fallbackState.empPage,
      sysPage: payload.systemUserPagination?.page ?? fallbackState.sysPage,
    }
  }, [])

  const prefetchScopedData = useCallback(
    (state: UserAccessQueryState, scope: UserAccessFetchScope) => {
      const cacheKey = buildDataCacheKey(scope, state)
      if (dataCacheRef.current.has(cacheKey) || inFlightPrefetchKeysRef.current.has(cacheKey)) {
        return
      }

      inFlightPrefetchKeysRef.current.add(cacheKey)
      const params = buildDataRequestParams(state, scope)

      void fetch(`/${companyId}/employees/user-access/data?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) return
          const payload = (await response.json()) as UserAccessDataResponse
          dataCacheRef.current.set(cacheKey, payload)
        })
        .catch(() => {
          // Swallow prefetch errors; active request handles user-visible failures.
        })
        .finally(() => {
          inFlightPrefetchKeysRef.current.delete(cacheKey)
        })
    },
    [buildDataCacheKey, buildDataRequestParams, companyId]
  )

  const prefetchNeighborPages = useCallback(
    (state: UserAccessQueryState, payload: UserAccessDataResponse, scope: UserAccessFetchScope) => {
      if (scope === "EMPLOYEES" && payload.employeePagination) {
        if (payload.employeePagination.page < payload.employeePagination.totalPages) {
          prefetchScopedData({ ...state, empPage: payload.employeePagination.page + 1 }, "EMPLOYEES")
        }
        if (payload.employeePagination.page > 1) {
          prefetchScopedData({ ...state, empPage: payload.employeePagination.page - 1 }, "EMPLOYEES")
        }
      }
      if (scope === "SYSTEM_USERS" && payload.systemUserPagination) {
        if (payload.systemUserPagination.page < payload.systemUserPagination.totalPages) {
          prefetchScopedData({ ...state, sysPage: payload.systemUserPagination.page + 1 }, "SYSTEM_USERS")
        }
        if (payload.systemUserPagination.page > 1) {
          prefetchScopedData({ ...state, sysPage: payload.systemUserPagination.page - 1 }, "SYSTEM_USERS")
        }
      }
    },
    [prefetchScopedData]
  )

  const updateWorkspaceData = useCallback(async (updates: {
    q?: string
    empLink?: UserAccessLinkFilter
    sysLink?: UserAccessLinkFilter
    role?: UserAccessRoleFilter
    empPage?: number
    sysPage?: number
    scope?: UserAccessFetchScope
  }) => {
    const scope = updates.scope ?? "ALL"
    const nextState = buildQueryState(updates)
    const previousState = lastRequestedStateRef.current
    const isSameState =
      previousState.q === nextState.q &&
      previousState.empLink === nextState.empLink &&
      previousState.sysLink === nextState.sysLink &&
      previousState.role === nextState.role &&
      previousState.empPage === nextState.empPage &&
      previousState.sysPage === nextState.sysPage

    if (isSameState) return

    dataRequestControllerRef.current?.abort()
    const cacheKey = buildDataCacheKey(scope, nextState)
    const cachedPayload = dataCacheRef.current.get(cacheKey)
    if (cachedPayload) {
      applyDataPayload(cachedPayload, nextState)
      prefetchNeighborPages(nextState, cachedPayload, scope)
      const normalizedCachedUrl = buildRouteHref(lastRequestedStateRef.current)
      const locationCachedUrl = `${window.location.pathname}${window.location.search}`
      if (normalizedCachedUrl !== locationCachedUrl) {
        window.history.replaceState(null, "", normalizedCachedUrl)
      }
      return
    }

    const controller = new AbortController()
    dataRequestControllerRef.current = controller
    setIsDataPending(true)

    const nextUrl = buildRouteHref(nextState)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl)
    }

    try {
      const params = buildDataRequestParams(nextState, scope)

      const response = await fetch(
        `/${companyId}/employees/user-access/data?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        }
      )

      if (!response.ok) {
        throw new Error("Unable to load user access data.")
      }

      const payload = (await response.json()) as UserAccessDataResponse
      dataCacheRef.current.set(cacheKey, payload)
      applyDataPayload(payload, nextState)
      prefetchNeighborPages(nextState, payload, scope)

      const normalizedUrl = buildRouteHref(lastRequestedStateRef.current)
      const locationUrl = `${window.location.pathname}${window.location.search}`
      if (normalizedUrl !== locationUrl) {
        window.history.replaceState(null, "", normalizedUrl)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      toast.error("Unable to update user access list right now.")
    } finally {
      if (dataRequestControllerRef.current === controller) {
        dataRequestControllerRef.current = null
      }
      setIsDataPending(false)
    }
  }, [
    applyDataPayload,
    buildDataCacheKey,
    buildDataRequestParams,
    buildQueryState,
    buildRouteHref,
    companyId,
    prefetchNeighborPages,
  ])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void updateWorkspaceData({
        q: queryInput,
        empLink: linkFilterInput,
        sysLink: "LINKED",
        role: roleFilterInput,
        empPage: 1,
        sysPage: 1,
        scope: "ALL",
      })
    }, 250)

    return () => clearTimeout(timeoutId)
    // Only re-run when filter inputs change; pagination changes should not reset to page 1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkFilterInput, queryInput, roleFilterInput])

  const resetFilters = () => {
    setQueryInput("")
    setLinkFilterInput("ALL")
    setRoleFilterInput("ALL")
    void updateWorkspaceData({
      q: "",
      empLink: "ALL",
      sysLink: "LINKED",
      role: "ALL",
      empPage: 1,
      sysPage: 1,
      scope: "ALL",
    })
  }

  const openCreate = (row: UserAccessPreviewRow) => {
    const nameBase = `${row.fullName.split(",")[1]?.trim() ?? "user"}.${row.fullName.split(",")[0]?.trim() ?? ""}`
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._-]/g, "")
    setCreateUsername(nameBase || `user.${row.employeeNumber.toLowerCase()}`)
    setCreatePassword("")
    setCreateApprover(false)
    setCreateCompanyAccesses(buildDefaultCompanyAccesses(companyOptions, companyId))
    setDialogState({ type: "CREATE", row })
  }

  const openLink = (row: UserAccessPreviewRow) => {
    setLinkUserId("")
    setLinkCompanyAccesses(buildDefaultCompanyAccesses(companyOptions, companyId))
    setDialogState({ type: "LINK", row })
    startAvailableUsersTransition(async () => {
      const result = await getAvailableSystemUsersAction({ companyId })
      if (!result.ok) {
        toast.error(result.error)
        setAvailableUsers([])
        return
      }
      setAvailableUsers(result.data)
    })
  }

  const openCreateSystemAccount = () => {
    setSystemFirstName("")
    setSystemLastName("")
    setSystemUsername("")
    setSystemEmail("")
    setSystemPassword("")
    setSystemRole("EMPLOYEE")
    setSystemApprover(false)
    setSystemIsMaterialRequestPurchaser(false)
    setSystemIsMaterialRequestPoster(false)
    setSystemIsPurchaseRequestItemManager(false)
    setDialogState({ type: "CREATE_SYSTEM" })
  }

  const openEdit = (row: UserAccessPreviewRow) => {
    router.push(`/${companyId}/employees/user-access/${row.employeeId}`)
  }

  const openEditSystemAccount = (user: SystemUserAccountRow) => {
    if (user.isLinked) {
      if (!user.linkedEmployeeId || !user.linkedEmployeeNumber || !user.linkedEmployeeName) {
        toast.error("Linked employee record could not be resolved. Refresh and try again.")
        return
      }

      router.push(`/${companyId}/employees/user-access/${user.linkedEmployeeId}`)
      return
    }

    const [lastName = "", firstName = ""] = user.displayName.split(",").map((value) => value.trim())
    setSystemEditFirstName(firstName)
    setSystemEditLastName(lastName)
    setSystemEditUsername(user.username)
    setSystemEditEmail(user.email)
    setSystemEditPassword("")
    setSystemEditRole(user.companyRole as EditableCompanyAccess["role"])
    setSystemEditApprover(user.isRequestApprover)
    setSystemEditIsActive(user.isActive)
    setSystemEditIsMaterialRequestPurchaser(user.isMaterialRequestPurchaser)
    setSystemEditIsMaterialRequestPoster(user.isMaterialRequestPoster)
    setSystemEditIsPurchaseRequestItemManager(user.isPurchaseRequestItemManager)
    setDialogState({ type: "EDIT_SYSTEM", user })
  }

  const closeDialog = () => {
    if (isPending) return
    setDialogState({ type: "NONE" })
  }

  const setCreateAccessEnabled = (targetCompanyId: string, enabled: boolean) => {
    setCreateCompanyAccesses((previous) => setAccessEnabledInList(previous, targetCompanyId, enabled))
  }

  const setCreateAccessDefault = (targetCompanyId: string) => {
    setCreateCompanyAccesses((previous) => setAccessDefaultInList(previous, targetCompanyId))
  }

  const updateCreateAccessField = (
    targetCompanyId: string,
    patch: Partial<
      Pick<
        EditableCompanyAccess,
        "role" | "isMaterialRequestPurchaser" | "isMaterialRequestPoster" | "isPurchaseRequestItemManager"
      >
    >
  ) => {
    setCreateCompanyAccesses((previous) => patchAccessInList(previous, targetCompanyId, patch))
  }

  const setLinkAccessEnabled = (targetCompanyId: string, enabled: boolean) => {
    setLinkCompanyAccesses((previous) => setAccessEnabledInList(previous, targetCompanyId, enabled))
  }

  const setLinkAccessDefault = (targetCompanyId: string) => {
    setLinkCompanyAccesses((previous) => setAccessDefaultInList(previous, targetCompanyId))
  }

  const updateLinkAccessField = (
    targetCompanyId: string,
    patch: Partial<
      Pick<
        EditableCompanyAccess,
        "role" | "isMaterialRequestPurchaser" | "isMaterialRequestPoster" | "isPurchaseRequestItemManager"
      >
    >
  ) => {
    setLinkCompanyAccesses((previous) => patchAccessInList(previous, targetCompanyId, patch))
  }

  const setCompanyAccessEnabled = (targetCompanyId: string, enabled: boolean) => {
    setEditCompanyAccesses((previous) => setAccessEnabledInList(previous, targetCompanyId, enabled))
  }

  const setCompanyAccessDefault = (targetCompanyId: string) => {
    setEditCompanyAccesses((previous) => setAccessDefaultInList(previous, targetCompanyId))
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
    setEditCompanyAccesses((previous) => patchAccessInList(previous, targetCompanyId, patch))
  }

  const submitCreate = () => {
    if (dialogState.type !== "CREATE") return

    startMutationTransition(async () => {
      const normalizedCompanyAccesses = normalizeEnabledCompanyAccesses(createCompanyAccesses)
      if (normalizedCompanyAccesses.length === 0) {
        toast.error("Assign at least one company access.")
        return
      }
      const currentAccess =
        normalizedCompanyAccesses.find((entry) => entry.companyId === companyId) ??
        normalizedCompanyAccesses[0]

      const result = await createEmployeeSystemUserAction({
        companyId,
        employeeId: dialogState.row.employeeId,
        username: createUsername,
        password: createPassword,
        companyRole: currentAccess.role,
        isRequestApprover: createApprover,
        isMaterialRequestPurchaser: currentAccess.isMaterialRequestPurchaser,
        isMaterialRequestPoster: currentAccess.isMaterialRequestPoster,
        isPurchaseRequestItemManager: currentAccess.isPurchaseRequestItemManager,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const accessResult = await updateEmployeeCompanyAccessAction({
        companyId,
        employeeId: dialogState.row.employeeId,
        accesses: normalizedCompanyAccesses,
      })

      if (!accessResult.ok) {
        toast.error(accessResult.error)
        return
      }

      toast.success(`${result.message} ${accessResult.message}`)
      setDialogState({ type: "NONE" })
      router.refresh()
    })
  }

  const submitLink = () => {
    if (dialogState.type !== "LINK") return
    if (!linkUserId) {
      toast.error("Select a user to link.")
      return
    }

    startMutationTransition(async () => {
      const normalizedCompanyAccesses = normalizeEnabledCompanyAccesses(linkCompanyAccesses)
      if (normalizedCompanyAccesses.length === 0) {
        toast.error("Assign at least one company access.")
        return
      }
      const currentAccess =
        normalizedCompanyAccesses.find((entry) => entry.companyId === companyId) ??
        normalizedCompanyAccesses[0]

      const result = await linkEmployeeToExistingUserAction({
        companyId,
        employeeId: dialogState.row.employeeId,
        userId: linkUserId,
        companyRole: currentAccess.role,
        isRequestApprover: false,
        isMaterialRequestPurchaser: currentAccess.isMaterialRequestPurchaser,
        isMaterialRequestPoster: currentAccess.isMaterialRequestPoster,
        isPurchaseRequestItemManager: currentAccess.isPurchaseRequestItemManager,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const accessResult = await updateEmployeeCompanyAccessAction({
        companyId,
        employeeId: dialogState.row.employeeId,
        accesses: normalizedCompanyAccesses,
      })

      if (!accessResult.ok) {
        toast.error(accessResult.error)
        return
      }

      toast.success(`${result.message} ${accessResult.message}`)
      setDialogState({ type: "NONE" })
      router.refresh()
    })
  }

  const submitEdit = () => {
    if (dialogState.type !== "EDIT") return

    startMutationTransition(async () => {
      const normalizedCompanyAccesses = normalizeEnabledCompanyAccesses(editCompanyAccesses)
      if (normalizedCompanyAccesses.length === 0) {
        toast.error("Assign at least one company access.")
        return
      }

      const result = await updateLinkedUserCredentialsAction({
        companyId,
        employeeId: dialogState.row.employeeId,
        username: editUsername,
        password: editPassword.trim().length > 0 ? editPassword : undefined,
        isActive: editIsActive,
        isRequestApprover: editApprover,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const accessResult = await updateEmployeeCompanyAccessAction({
        companyId,
        employeeId: dialogState.row.employeeId,
        accesses: normalizedCompanyAccesses,
      })

      if (!accessResult.ok) {
        toast.error(accessResult.error)
        return
      }

      toast.success(`${result.message} ${accessResult.message}`)
      setDialogState({ type: "NONE" })
      router.refresh()
    })
  }

  const submitCreateSystemAccount = () => {
    if (dialogState.type !== "CREATE_SYSTEM") return

    startMutationTransition(async () => {
      const result = await createStandaloneSystemUserAction({
        companyId,
        firstName: systemFirstName,
        lastName: systemLastName,
        username: systemUsername,
        email: systemEmail,
        password: systemPassword,
        companyRole: systemRole,
        isRequestApprover: systemApprover,
        isMaterialRequestPurchaser: systemIsMaterialRequestPurchaser,
        isMaterialRequestPoster: systemIsMaterialRequestPoster,
        isPurchaseRequestItemManager: systemIsPurchaseRequestItemManager,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setDialogState({ type: "NONE" })
      router.refresh()
    })
  }

  const submitEditSystemAccount = () => {
    if (dialogState.type !== "EDIT_SYSTEM") return

    startMutationTransition(async () => {
      const result = await updateStandaloneSystemUserAction({
        companyId,
        userId: dialogState.user.id,
        firstName: systemEditFirstName,
        lastName: systemEditLastName,
        username: systemEditUsername,
        email: systemEditEmail,
        password: systemEditPassword.trim().length > 0 ? systemEditPassword : undefined,
        isActive: systemEditIsActive,
        companyRole: systemEditRole,
        isRequestApprover: systemEditApprover,
        isMaterialRequestPurchaser: systemEditIsMaterialRequestPurchaser,
        isMaterialRequestPoster: systemEditIsMaterialRequestPoster,
        isPurchaseRequestItemManager: systemEditIsPurchaseRequestItemManager,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setDialogState({ type: "NONE" })
      router.refresh()
    })
  }

  const submitUnlink = (row: UserAccessPreviewRow) => {
    startMutationTransition(async () => {
      const result = await unlinkEmployeeUserAction({
        companyId,
        employeeId: row.employeeId,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  const submitUnlinkSystemAccount = (user: SystemUserAccountRow) => {
    if (!user.linkedEmployeeId) {
      toast.error("This account is not linked to an employee.")
      return
    }

    startMutationTransition(async () => {
      const result = await unlinkEmployeeUserAction({
        companyId,
        employeeId: user.linkedEmployeeId!,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  const submitDeleteSystemAccount = () => {
    if (!systemDeleteTarget) return

    startMutationTransition(async () => {
      const result = await deleteStandaloneSystemUserAction({
        companyId,
        userId: systemDeleteTarget.id,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setSystemDeleteTarget(null)
      router.refresh()
    })
  }

  const getPreviewAccessFromAssignments = useCallback(
    (accesses: EditableCompanyAccess[]): EditableCompanyAccess => {
      return (
        accesses.find((entry) => entry.companyId === companyId && entry.enabled) ??
        accesses.find((entry) => entry.enabled) ??
        buildDefaultCompanyAccesses(companyOptions, companyId)[0]
      )
    },
    [companyId, companyOptions]
  )

  const managedAccessSummary = useMemo(
    () => ({
      approvers: systemUsersState.filter((user) => user.isRequestApprover).length,
      purchasers: systemUsersState.filter((user) => user.isMaterialRequestPurchaser).length,
      posters: systemUsersState.filter((user) => user.isMaterialRequestPoster).length,
      itemManagers: systemUsersState.filter((user) => user.isPurchaseRequestItemManager).length,
    }),
    [systemUsersState]
  )

  const createPreviewAccess = getPreviewAccessFromAssignments(createCompanyAccesses)
  const linkPreviewAccess = getPreviewAccessFromAssignments(linkCompanyAccesses)
  const editPreviewAccess = getPreviewAccessFromAssignments(editCompanyAccesses)

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <section className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-6 py-4">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Human Resources</p>
                  <h1 className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    <IconShieldCheck className="size-5 text-primary sm:size-6" />
                    Employee User Access
                  </h1>
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    Set up employee logins, monitor linked access coverage, and keep workflow responsibilities aligned with the rest of your admin workspace.
                  </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:max-w-[460px] xl:justify-end">
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  <IconBuilding className="mr-1 size-3.5" />
                  {companyName}
                </Badge>
                <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                  <IconAlertCircle className="mr-1 size-3.5" />
                  {rowsState.filter((row) => !row.hasLinkedUser).length} Needs Setup
                </Badge>
                <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                  <IconLink className="mr-1 size-3.5" />
                  {rowsState.filter((row) => row.hasLinkedUser).length} Linked on Page
                </Badge>
                <span className="text-xs text-muted-foreground">{managedAccessSummary.approvers} approvers</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{managedAccessSummary.purchasers} purchasers</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{managedAccessSummary.posters} posters</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{managedAccessSummary.itemManagers} item managers</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-4">
        <UserAccessWorkspace
          rows={rowsState}
          systemUsers={systemUsersState}
          onCreate={openCreate}
          onLink={openLink}
          onUnlink={submitUnlink}
          onEdit={openEdit}
          onEditSystemAccount={openEditSystemAccount}
          onDeleteSystemAccount={setSystemDeleteTarget}
          onUnlinkSystemAccount={submitUnlinkSystemAccount}
          onCreateSystemAccount={openCreateSystemAccount}
          filtersToolbar={
            <>
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                <div className="relative min-w-0 xl:w-[360px] xl:flex-none">
                  <IconSearch className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    placeholder="Search employee or username"
                    className="pl-9"
                  />
                </div>
                <Select
                  value={roleFilterInput}
                  onValueChange={(value) => setRoleFilterInput(value as UserAccessRoleFilter)}
                >
                  <SelectTrigger className="h-9 w-full xl:w-[220px]">
                    <IconShieldCheck className="mr-1.5 size-4 text-muted-foreground" />
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Roles</SelectItem>
                    <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                    <SelectItem value="HR_ADMIN">HR_ADMIN</SelectItem>
                    <SelectItem value="PAYROLL_ADMIN">PAYROLL_ADMIN</SelectItem>
                    <SelectItem value="COMPANY_ADMIN">COMPANY_ADMIN</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={resetFilters} disabled={isPending}>
                  <IconRefresh className="mr-1.5 size-4" />
                  Reset
                </Button>
              </div>
            </>
          }
          isPending={isPending}
          employeePagination={employeePaginationState}
          systemUserPagination={systemUserPaginationState}
          onEmployeePageChange={(nextPage) => void updateWorkspaceData({ empPage: nextPage, scope: "EMPLOYEES" })}
          onSystemUserPageChange={(nextPage) =>
            void updateWorkspaceData({ sysPage: nextPage, scope: "SYSTEM_USERS" })
          }
        />
      </section>

      <Dialog open={dialogState.type === "CREATE"} onOpenChange={(open) => (!open ? closeDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create and Link User</DialogTitle>
            <DialogDescription>
              {dialogState.type === "CREATE" ? `${dialogState.row.fullName} (${dialogState.row.employeeNumber})` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Username<span className="ml-1 text-destructive">*</span></Label>
              <Input value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password<span className="ml-1 text-destructive">*</span></Label>
              <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} disabled={isPending} />
            </div>
            <p className="border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Login uses the assigned username. The internal account email is resolved automatically from the employee record when available.
            </p>
            <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
              <span className="text-xs text-foreground">Request Approver (Leave & OT)</span>
              <Switch checked={createApprover} onCheckedChange={setCreateApprover} disabled={isPending} />
            </div>
            <div className="space-y-2 border border-border/60 px-3 py-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <IconBuilding className="size-4" />
                Multi-Company Access
              </p>
              <div className="space-y-2">
                {createCompanyAccesses.map((access) => {
                  const company = companyOptions.find((option) => option.companyId === access.companyId)
                  return (
                    <div key={access.companyId} className="border border-border/60 px-2 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-sm text-foreground">
                          <Checkbox
                            checked={access.enabled}
                            onCheckedChange={(checked) => setCreateAccessEnabled(access.companyId, checked === true)}
                            disabled={isPending}
                          />
                          <span>{company?.companyName ?? access.companyId}</span>
                        </label>
                        <Button
                          type="button"
                          variant={access.isDefault && access.enabled ? "default" : "outline"}
                          size="sm"
                          disabled={isPending || !access.enabled}
                          onClick={() => setCreateAccessDefault(access.companyId)}
                        >
                          {access.isDefault && access.enabled ? "Default" : "Set Default"}
                        </Button>
                      </div>

                      {access.enabled ? (
                        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <Select
                            value={access.role}
                            onValueChange={(value) =>
                              updateCreateAccessField(access.companyId, {
                                role: value as EditableCompanyAccess["role"],
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                              <SelectItem value="HR_ADMIN">HR_ADMIN</SelectItem>
                              <SelectItem value="PAYROLL_ADMIN">PAYROLL_ADMIN</SelectItem>
                              <SelectItem value="COMPANY_ADMIN">COMPANY_ADMIN</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                            <span className="text-xs text-foreground">MRS Purchaser</span>
                            <Switch
                              checked={access.isMaterialRequestPurchaser}
                              onCheckedChange={(checked) =>
                                updateCreateAccessField(access.companyId, {
                                  isMaterialRequestPurchaser: checked,
                                })
                              }
                              disabled={isPending}
                            />
                          </div>
                          <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                            <span className="text-xs text-foreground">MRS Poster</span>
                            <Switch
                              checked={access.isMaterialRequestPoster}
                              onCheckedChange={(checked) =>
                                updateCreateAccessField(access.companyId, {
                                  isMaterialRequestPoster: checked,
                                })
                              }
                              disabled={isPending}
                            />
                          </div>
                          <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                            <span className="text-xs text-foreground">Item Manager</span>
                            <Switch
                              checked={access.isPurchaseRequestItemManager}
                              onCheckedChange={(checked) =>
                                updateCreateAccessField(access.companyId, {
                                  isPurchaseRequestItemManager: checked,
                                })
                              }
                              disabled={isPending}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
            <EffectiveAccessPreview
              title="Current Company Access Preview"
              description="Preview what this employee will be able to open in the active company based on role and flags."
              companyRole={createPreviewAccess.role}
              isRequestApprover={createApprover}
              isMaterialRequestPurchaser={createPreviewAccess.isMaterialRequestPurchaser}
              isMaterialRequestPoster={createPreviewAccess.isMaterialRequestPoster}
              isPurchaseRequestItemManager={createPreviewAccess.isPurchaseRequestItemManager}
              hasEmployeeProfile
              purchaseRequestWorkflowEnabled={purchaseRequestWorkflowEnabled}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
              <Button onClick={submitCreate} disabled={isPending}>Create and Link User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState.type === "LINK"} onOpenChange={(open) => (!open ? closeDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Existing User</DialogTitle>
            <DialogDescription>
              {dialogState.type === "LINK" ? `${dialogState.row.fullName} (${dialogState.row.employeeNumber})` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>User Account<span className="ml-1 text-destructive">*</span></Label>
              <Select value={linkUserId} onValueChange={setLinkUserId} disabled={isPending || isAvailableUsersPending}>
                <SelectTrigger><SelectValue placeholder={isAvailableUsersPending ? "Loading users..." : "Select user"} /></SelectTrigger>
                <SelectContent>
                  {isAvailableUsersPending ? (
                    <SelectItem value="__loading__" disabled>Loading users...</SelectItem>
                  ) : availableUsers.length === 0 ? (
                    <SelectItem value="__empty__" disabled>No available users</SelectItem>
                  ) : (
                    availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.displayName} ({user.username})</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 border border-border/60 px-3 py-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <IconBuilding className="size-4" />
                Multi-Company Access
              </p>
              <div className="space-y-2">
                {linkCompanyAccesses.map((access) => {
                  const company = companyOptions.find((option) => option.companyId === access.companyId)
                  return (
                    <div key={access.companyId} className="border border-border/60 px-2 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-sm text-foreground">
                          <Checkbox
                            checked={access.enabled}
                            onCheckedChange={(checked) => setLinkAccessEnabled(access.companyId, checked === true)}
                            disabled={isPending}
                          />
                          <span>{company?.companyName ?? access.companyId}</span>
                        </label>
                        <Button
                          type="button"
                          variant={access.isDefault && access.enabled ? "default" : "outline"}
                          size="sm"
                          disabled={isPending || !access.enabled}
                          onClick={() => setLinkAccessDefault(access.companyId)}
                        >
                          {access.isDefault && access.enabled ? "Default" : "Set Default"}
                        </Button>
                      </div>

                      {access.enabled ? (
                        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <Select
                            value={access.role}
                            onValueChange={(value) =>
                              updateLinkAccessField(access.companyId, {
                                role: value as EditableCompanyAccess["role"],
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                              <SelectItem value="HR_ADMIN">HR_ADMIN</SelectItem>
                              <SelectItem value="PAYROLL_ADMIN">PAYROLL_ADMIN</SelectItem>
                              <SelectItem value="COMPANY_ADMIN">COMPANY_ADMIN</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                            <span className="text-xs text-foreground">MRS Purchaser</span>
                            <Switch
                              checked={access.isMaterialRequestPurchaser}
                              onCheckedChange={(checked) =>
                                updateLinkAccessField(access.companyId, {
                                  isMaterialRequestPurchaser: checked,
                                })
                              }
                              disabled={isPending}
                            />
                          </div>
                          <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                            <span className="text-xs text-foreground">MRS Poster</span>
                            <Switch
                              checked={access.isMaterialRequestPoster}
                              onCheckedChange={(checked) =>
                                updateLinkAccessField(access.companyId, {
                                  isMaterialRequestPoster: checked,
                                })
                              }
                              disabled={isPending}
                            />
                          </div>
                          <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                            <span className="text-xs text-foreground">Item Manager</span>
                            <Switch
                              checked={access.isPurchaseRequestItemManager}
                              onCheckedChange={(checked) =>
                                updateLinkAccessField(access.companyId, {
                                  isPurchaseRequestItemManager: checked,
                                })
                              }
                              disabled={isPending}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
            <EffectiveAccessPreview
              title="Current Company Access Preview"
              description="Preview how this linked account will behave inside the active company."
              companyRole={linkPreviewAccess.role}
              isRequestApprover={false}
              isMaterialRequestPurchaser={linkPreviewAccess.isMaterialRequestPurchaser}
              isMaterialRequestPoster={linkPreviewAccess.isMaterialRequestPoster}
              isPurchaseRequestItemManager={linkPreviewAccess.isPurchaseRequestItemManager}
              hasEmployeeProfile
              purchaseRequestWorkflowEnabled={purchaseRequestWorkflowEnabled}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
              <Button onClick={submitLink} disabled={isPending || isAvailableUsersPending || !linkUserId}>Link Existing User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState.type === "CREATE_SYSTEM"} onOpenChange={(open) => (!open ? closeDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create System Account</DialogTitle>
            <DialogDescription>Create an unlinked account for HR/Payroll staff use in {companyName}.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name<span className="ml-1 text-destructive">*</span></Label>
                <Input value={systemFirstName} onChange={(event) => setSystemFirstName(event.target.value)} disabled={isPending} />
              </div>
              <div className="space-y-2">
                <Label>Last Name<span className="ml-1 text-destructive">*</span></Label>
                <Input value={systemLastName} onChange={(event) => setSystemLastName(event.target.value)} disabled={isPending} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Username<span className="ml-1 text-destructive">*</span></Label>
              <Input value={systemUsername} onChange={(event) => setSystemUsername(event.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>Email<span className="ml-1 text-destructive">*</span></Label>
              <Input value={systemEmail} onChange={(event) => setSystemEmail(event.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password<span className="ml-1 text-destructive">*</span></Label>
              <Input type="password" value={systemPassword} onChange={(event) => setSystemPassword(event.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>Company Role<span className="ml-1 text-destructive">*</span></Label>
              <Select value={systemRole} onValueChange={(value) => setSystemRole(value as EditableCompanyAccess["role"])}>
                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                  <SelectItem value="HR_ADMIN">HR_ADMIN</SelectItem>
                  <SelectItem value="PAYROLL_ADMIN">PAYROLL_ADMIN</SelectItem>
                  <SelectItem value="COMPANY_ADMIN">COMPANY_ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
              <span className="text-xs text-foreground">Request Approver (Leave & OT)</span>
              <Switch checked={systemApprover} onCheckedChange={setSystemApprover} disabled={isPending} />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                <span className="text-xs text-foreground">MRS Purchaser</span>
                <Switch
                  checked={systemIsMaterialRequestPurchaser}
                  onCheckedChange={setSystemIsMaterialRequestPurchaser}
                  disabled={isPending}
                />
              </div>
              <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                <span className="text-xs text-foreground">MRS Poster</span>
                <Switch
                  checked={systemIsMaterialRequestPoster}
                  onCheckedChange={setSystemIsMaterialRequestPoster}
                  disabled={isPending}
                />
              </div>
              <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                <span className="text-xs text-foreground">Item Manager</span>
                <Switch
                  checked={systemIsPurchaseRequestItemManager}
                  onCheckedChange={setSystemIsPurchaseRequestItemManager}
                  disabled={isPending}
                />
              </div>
            </div>
            <EffectiveAccessPreview
              title="System Account Access Preview"
              description="Standalone accounts do not get self-service employee routes unless they are linked to an employee record."
              companyRole={systemRole}
              isRequestApprover={systemApprover}
              isMaterialRequestPurchaser={systemIsMaterialRequestPurchaser}
              isMaterialRequestPoster={systemIsMaterialRequestPoster}
              isPurchaseRequestItemManager={systemIsPurchaseRequestItemManager}
              hasEmployeeProfile={false}
              purchaseRequestWorkflowEnabled={purchaseRequestWorkflowEnabled}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
            <Button onClick={submitCreateSystemAccount} disabled={isPending}>Create System Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState.type === "EDIT_SYSTEM"} onOpenChange={(open) => (!open ? closeDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit System Account</DialogTitle>
            <DialogDescription>
              {dialogState.type === "EDIT_SYSTEM" ? `${dialogState.user.displayName} (${dialogState.user.username})` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name<span className="ml-1 text-destructive">*</span></Label>
                <Input value={systemEditFirstName} onChange={(event) => setSystemEditFirstName(event.target.value)} disabled={isPending} />
              </div>
              <div className="space-y-2">
                <Label>Last Name<span className="ml-1 text-destructive">*</span></Label>
                <Input value={systemEditLastName} onChange={(event) => setSystemEditLastName(event.target.value)} disabled={isPending} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Username<span className="ml-1 text-destructive">*</span></Label>
              <Input value={systemEditUsername} onChange={(event) => setSystemEditUsername(event.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>Email<span className="ml-1 text-destructive">*</span></Label>
              <Input value={systemEditEmail} onChange={(event) => setSystemEditEmail(event.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={systemEditPassword}
                onChange={(event) => setSystemEditPassword(event.target.value)}
                disabled={isPending}
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label>Company Role<span className="ml-1 text-destructive">*</span></Label>
              <Select value={systemEditRole} onValueChange={(value) => setSystemEditRole(value as EditableCompanyAccess["role"])}>
                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                  <SelectItem value="HR_ADMIN">HR_ADMIN</SelectItem>
                  <SelectItem value="PAYROLL_ADMIN">PAYROLL_ADMIN</SelectItem>
                  <SelectItem value="COMPANY_ADMIN">COMPANY_ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                <span className="text-xs text-foreground">Active Account</span>
                <Switch checked={systemEditIsActive} onCheckedChange={setSystemEditIsActive} disabled={isPending} />
              </div>
              <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                <span className="text-xs text-foreground">Request Approver (Leave & OT)</span>
                <Switch checked={systemEditApprover} onCheckedChange={setSystemEditApprover} disabled={isPending} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                <span className="text-xs text-foreground">MRS Purchaser</span>
                <Switch
                  checked={systemEditIsMaterialRequestPurchaser}
                  onCheckedChange={setSystemEditIsMaterialRequestPurchaser}
                  disabled={isPending}
                />
              </div>
              <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                <span className="text-xs text-foreground">MRS Poster</span>
                <Switch
                  checked={systemEditIsMaterialRequestPoster}
                  onCheckedChange={setSystemEditIsMaterialRequestPoster}
                  disabled={isPending}
                />
              </div>
              <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                <span className="text-xs text-foreground">Item Manager</span>
                <Switch
                  checked={systemEditIsPurchaseRequestItemManager}
                  onCheckedChange={setSystemEditIsPurchaseRequestItemManager}
                  disabled={isPending}
                />
              </div>
            </div>
            <EffectiveAccessPreview
              title="System Account Access Preview"
              description="Use this preview to confirm what this standalone user can view or manage in the active company."
              companyRole={systemEditRole}
              isRequestApprover={systemEditApprover}
              isMaterialRequestPurchaser={systemEditIsMaterialRequestPurchaser}
              isMaterialRequestPoster={systemEditIsMaterialRequestPoster}
              isPurchaseRequestItemManager={systemEditIsPurchaseRequestItemManager}
              hasEmployeeProfile={false}
              purchaseRequestWorkflowEnabled={purchaseRequestWorkflowEnabled}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
            <Button onClick={submitEditSystemAccount} disabled={isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState.type === "EDIT"} onOpenChange={(open) => (!open ? closeDialog() : null)}>
        <DialogContent className="max-h-[90vh] overflow-hidden border border-border/60 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border/60 bg-muted/20 px-6 py-4">
            <DialogTitle className="text-base">Edit User Credentials</DialogTitle>
            <DialogDescription>
              {dialogState.type === "EDIT" ? `${dialogState.row.fullName} — ${dialogState.row.employeeNumber}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(90vh-156px)] space-y-5 overflow-y-auto px-6 py-5">
            {/* ── Credentials ── */}
            <section className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Account Credentials</p>
                <p className="text-xs text-muted-foreground">Login details for this user account.</p>
              </div>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Username<span className="ml-1 text-destructive">*</span></Label>
                  <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} disabled={isPending} placeholder="e.g. john.doe" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">New Password</Label>
                  <Input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    disabled={isPending}
                    placeholder="Leave blank to keep current"
                  />
                </div>
              </div>
            </section>

            {/* ── Account Status ── */}
            <section className="space-y-3 border-t border-border/60 pt-4">
              <div>
                <p className="text-sm font-medium text-foreground">Account Status</p>
                <p className="text-xs text-muted-foreground">Toggle account state and permissions.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                  <span className="text-xs text-foreground">Active Account</span>
                  <Switch checked={editIsActive} onCheckedChange={setEditIsActive} disabled={isPending} />
                </div>
                <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                  <span className="text-xs text-foreground">Request Approver (Leave &amp; OT)</span>
                  <Switch checked={editApprover} onCheckedChange={setEditApprover} disabled={isPending} />
                </div>
              </div>
            </section>

            {/* ── Multi-Company Access ── */}
            <section className="space-y-3 border-t border-border/60 pt-4">
              <div>
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <IconBuilding className="size-4" />
                  Multi-Company Access
                </p>
                <p className="text-xs text-muted-foreground">
                  Enable companies, assign roles, and set one default company.
                </p>
              </div>
              <div className="space-y-3">
                {editCompanyAccesses.map((access) => {
                  const company = companyOptions.find((option) => option.companyId === access.companyId)
                  return (
                    <div
                      key={access.companyId}
                      className="border border-border/60 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                          <Checkbox
                            checked={access.enabled}
                            onCheckedChange={(checked) => setCompanyAccessEnabled(access.companyId, checked === true)}
                            disabled={isPending}
                          />
                          <span>{company?.companyName ?? access.companyId}</span>
                        </label>
                        <Button
                          type="button"
                          variant={access.isDefault && access.enabled ? "default" : "outline"}
                          size="sm"
                          disabled={isPending || !access.enabled}
                          onClick={() => setCompanyAccessDefault(access.companyId)}
                          className="h-6 px-2 text-[11px]"
                        >
                          {access.isDefault && access.enabled ? "Default" : "Set Default"}
                        </Button>
                      </div>

                      {access.enabled ? (
                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <Select
                            value={access.role}
                            onValueChange={(value) =>
                              updateCompanyAccessField(access.companyId, {
                                role: value as EditableCompanyAccess["role"],
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                              <SelectItem value="HR_ADMIN">HR_ADMIN</SelectItem>
                              <SelectItem value="PAYROLL_ADMIN">PAYROLL_ADMIN</SelectItem>
                              <SelectItem value="COMPANY_ADMIN">COMPANY_ADMIN</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                            <span className="text-xs text-foreground">MRS Purchaser</span>
                            <Switch
                              checked={access.isMaterialRequestPurchaser}
                              onCheckedChange={(checked) =>
                                updateCompanyAccessField(access.companyId, {
                                  isMaterialRequestPurchaser: checked,
                                })
                              }
                              disabled={isPending}
                            />
                          </div>
                          <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                            <span className="text-xs text-foreground">MRS Poster</span>
                            <Switch
                              checked={access.isMaterialRequestPoster}
                              onCheckedChange={(checked) =>
                                updateCompanyAccessField(access.companyId, {
                                  isMaterialRequestPoster: checked,
                                })
                              }
                              disabled={isPending}
                            />
                          </div>
                          <div className="flex h-7 items-center justify-between border border-border/60 px-2.5">
                            <span className="text-xs text-foreground">Item Manager</span>
                            <Switch
                              checked={access.isPurchaseRequestItemManager}
                              onCheckedChange={(checked) =>
                                updateCompanyAccessField(access.companyId, {
                                  isPurchaseRequestItemManager: checked,
                                })
                              }
                              disabled={isPending}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>

            <EffectiveAccessPreview
              title="Current Company Access Preview"
              description="This preview updates live while you edit role and company flags."
              companyRole={editPreviewAccess.role}
              isRequestApprover={editApprover}
              isMaterialRequestPurchaser={editPreviewAccess.isMaterialRequestPurchaser}
              isMaterialRequestPoster={editPreviewAccess.isMaterialRequestPoster}
              isPurchaseRequestItemManager={editPreviewAccess.isPurchaseRequestItemManager}
              hasEmployeeProfile
              purchaseRequestWorkflowEnabled={purchaseRequestWorkflowEnabled}
            />
          </div>

          <DialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-3">
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
            <Button onClick={submitEdit} disabled={isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(systemDeleteTarget)} onOpenChange={(open: boolean) => (!open ? setSystemDeleteTarget(null) : null)}>
        <AlertDialogContent className="border-border/60 shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Delete System Account</AlertDialogTitle>
            <AlertDialogDescription>
              {systemDeleteTarget
                ? `Delete ${systemDeleteTarget.username}? This is only allowed for orphan single-company accounts with no business history.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep account</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
              onClick={submitDeleteSystemAccount}
            >
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

function EffectiveAccessPreview({
  title,
  description,
  companyRole,
  isRequestApprover,
  isMaterialRequestPurchaser,
  isMaterialRequestPoster,
  isPurchaseRequestItemManager,
  hasEmployeeProfile,
  purchaseRequestWorkflowEnabled,
}: {
  title: string
  description: string
  companyRole: EditableCompanyAccess["role"]
  isRequestApprover: boolean
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
  isPurchaseRequestItemManager: boolean
  hasEmployeeProfile: boolean
  purchaseRequestWorkflowEnabled: boolean
}) {
  const accessSnapshot: EmployeePortalAccessSnapshot = {
    companyRole: companyRole as CompanyRole,
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
  const capabilityScopes = resolveEmployeePortalCapabilityScopes(accessSnapshot)

  return (
    <section className="space-y-3 border border-border/60 bg-muted/10 px-4 py-4">
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

      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
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

          <div className="border border-border/60 bg-background px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Dashboard Modules</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DASHBOARD_MODULE_PREVIEWS.map((modulePreview) => (
                <ScopePill
                  key={modulePreview.key}
                  label={modulePreview.label}
                  scope={getModuleAccessScope(companyRole as CompanyRole, modulePreview.key)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="border border-border/60 bg-background px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Employee Portal Footprint</p>
          <div className="mt-2 grid gap-2">
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
        </div>
      </div>
    </section>
  )
}

function ScopePill({
  label,
  scope,
}: {
  label: string
  scope: AccessScope
}) {
  return (
    <div className="inline-flex items-center gap-2 border border-border/60 px-2.5 py-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <Badge variant={scopeBadgeVariant(scope)}>{ACCESS_SCOPE_LABELS[scope]}</Badge>
    </div>
  )
}
