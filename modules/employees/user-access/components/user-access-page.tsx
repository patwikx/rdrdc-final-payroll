"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  IconBuilding,
  IconLink,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import {
  createEmployeeSystemUserAction,
  createStandaloneSystemUserAction,
  getAvailableSystemUsersAction,
  linkEmployeeToExistingUserAction,
  unlinkEmployeeUserAction,
  updateEmployeeCompanyAccessAction,
  updateLinkedUserCredentialsAction,
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
}

type EditableCompanyAccess = {
  companyId: string
  role: "COMPANY_ADMIN" | "HR_ADMIN" | "PAYROLL_ADMIN" | "EMPLOYEE"
  isDefault: boolean
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
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
  patch: Partial<Pick<EditableCompanyAccess, "role" | "isMaterialRequestPurchaser" | "isMaterialRequestPoster">>
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
  }))
}

type ActionDialogState =
  | { type: "NONE" }
  | { type: "CREATE"; row: UserAccessPreviewRow }
  | { type: "LINK"; row: UserAccessPreviewRow }
  | { type: "CREATE_SYSTEM" }
  | { type: "EDIT"; row: UserAccessPreviewRow }

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

type UserAccessDataResponse = {
  rows: UserAccessPreviewRow[]
  systemUsers: SystemUserAccountRow[]
  query: string
  employeeLinkFilter: UserAccessLinkFilter
  systemLinkFilter: UserAccessLinkFilter
  roleFilter: UserAccessRoleFilter
  employeePagination: UserAccessPageProps["employeePagination"]
  systemUserPagination: UserAccessPageProps["systemUserPagination"]
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

  const [createUsername, setCreateUsername] = useState("")
  const [createEmail, setCreateEmail] = useState("")
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
  const [editEmail, setEditEmail] = useState("")
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
    return () => {
      dataRequestControllerRef.current?.abort()
    }
  }, [])

  const buildEditableCompanyAccesses = (row: UserAccessPreviewRow): EditableCompanyAccess[] => {
    const accessByCompanyId = new Map(row.linkedCompanyAccesses.map((entry) => [entry.companyId, entry]))

    const mapped = companyOptions.map((company) => {
      const existing = accessByCompanyId.get(company.companyId)
      return {
        companyId: company.companyId,
        role: (existing?.role ?? (company.companyId === companyId ? (row.linkedCompanyRole ?? "EMPLOYEE") : "EMPLOYEE")) as EditableCompanyAccess["role"],
        isDefault: existing?.isDefault ?? false,
        isMaterialRequestPurchaser: existing?.isMaterialRequestPurchaser ?? false,
        isMaterialRequestPoster: existing?.isMaterialRequestPoster ?? false,
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
      sysLink: typeof updates.sysLink !== "undefined" ? updates.sysLink : linkFilterInput,
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

    if (state.sysLink !== "ALL") {
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

  const updateWorkspaceData = useCallback(async (updates: {
    q?: string
    empLink?: UserAccessLinkFilter
    sysLink?: UserAccessLinkFilter
    role?: UserAccessRoleFilter
    empPage?: number
    sysPage?: number
  }) => {
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
    const controller = new AbortController()
    dataRequestControllerRef.current = controller
    setIsDataPending(true)

    const nextUrl = buildRouteHref(nextState)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl)
    }

    try {
      const params = new URLSearchParams()
      const queryValue = nextState.q.trim()
      if (queryValue) params.set("q", queryValue)
      if (nextState.empLink !== "ALL") params.set("empLink", nextState.empLink)
      if (nextState.sysLink !== "ALL") params.set("sysLink", nextState.sysLink)
      if (nextState.role !== "ALL") params.set("role", nextState.role)
      if (nextState.empPage > 1) params.set("empPage", String(nextState.empPage))
      if (nextState.sysPage > 1) params.set("sysPage", String(nextState.sysPage))

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
      setRowsState(payload.rows)
      setSystemUsersState(payload.systemUsers)
      setEmployeePaginationState(payload.employeePagination)
      setSystemUserPaginationState(payload.systemUserPagination)
      lastRequestedStateRef.current = {
        q: payload.query,
        empLink: payload.employeeLinkFilter,
        sysLink: payload.systemLinkFilter,
        role: payload.roleFilter,
        empPage: payload.employeePagination.page,
        sysPage: payload.systemUserPagination.page,
      }

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
  }, [buildQueryState, buildRouteHref, companyId])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void updateWorkspaceData({
        q: queryInput,
        empLink: linkFilterInput,
        sysLink: linkFilterInput,
        role: roleFilterInput,
        empPage: 1,
        sysPage: 1,
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
      sysLink: "ALL",
      role: "ALL",
      empPage: 1,
      sysPage: 1,
    })
  }

  const openCreate = (row: UserAccessPreviewRow) => {
    const nameBase = `${row.fullName.split(",")[1]?.trim() ?? "user"}.${row.fullName.split(",")[0]?.trim() ?? ""}`
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._-]/g, "")
    setCreateUsername(nameBase || `user.${row.employeeNumber.toLowerCase()}`)
    setCreateEmail("")
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
    setDialogState({ type: "CREATE_SYSTEM" })
  }

  const openEdit = (row: UserAccessPreviewRow) => {
    setEditUsername(row.linkedUsername ?? "")
    setEditEmail(row.linkedEmail ?? "")
    setEditPassword("")
    setEditApprover(row.requestApprover)
    setEditIsActive(row.linkedUserActive)
    setEditCompanyAccesses(buildEditableCompanyAccesses(row))
    setDialogState({ type: "EDIT", row })
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
    patch: Partial<Pick<EditableCompanyAccess, "role" | "isMaterialRequestPurchaser" | "isMaterialRequestPoster">>
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
    patch: Partial<Pick<EditableCompanyAccess, "role" | "isMaterialRequestPurchaser" | "isMaterialRequestPoster">>
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
    patch: Partial<Pick<EditableCompanyAccess, "role" | "isMaterialRequestPurchaser" | "isMaterialRequestPoster">>
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
        email: createEmail,
        password: createPassword,
        companyRole: currentAccess.role,
        isRequestApprover: createApprover,
        isMaterialRequestPurchaser: currentAccess.isMaterialRequestPurchaser,
        isMaterialRequestPoster: currentAccess.isMaterialRequestPoster,
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
        email: editEmail,
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

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -right-20 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-8 top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-col gap-2 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">HR System</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              <IconShieldCheck className="size-6 text-primary sm:size-7" />
              System User Creation and Employee Link
            </h1>
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              <IconBuilding className="mr-1 size-3.5" />
              {companyName}
            </Badge>
            <Badge variant="secondary" className="h-6 px-2 text-[11px]">
              <IconUsers className="mr-1 size-3.5" />
              {employeePaginationState.totalItems} Employees
            </Badge>
            <Badge variant="secondary" className="h-6 px-2 text-[11px]">
              <IconShieldCheck className="mr-1 size-3.5" />
              {systemUserPaginationState.totalItems} System Users
            </Badge>
          </div>
        </div>
      </section>

      <section className="px-4 py-4 sm:px-6 lg:px-8">
        <UserAccessWorkspace
          rows={rowsState}
          systemUsers={systemUsersState}
          onCreate={openCreate}
          onLink={openLink}
          onUnlink={submitUnlink}
          onEdit={openEdit}
          onCreateSystemAccount={openCreateSystemAccount}
          filtersToolbar={
            <>
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                <div className="relative min-w-0 xl:w-[360px] xl:flex-none">
                  <IconSearch className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    placeholder="Search employee, username, email"
                    className="h-9 pl-9"
                  />
                </div>
                <Select
                  value={linkFilterInput}
                  onValueChange={(value) => setLinkFilterInput(value as UserAccessLinkFilter)}
                >
                  <SelectTrigger className="h-9 w-full xl:w-[220px]">
                    <IconLink className="mr-1.5 size-4 text-muted-foreground" />
                    <SelectValue placeholder="Link Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="LINKED">Linked</SelectItem>
                    <SelectItem value="UNLINKED">Unlinked</SelectItem>
                  </SelectContent>
                </Select>
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
                <Button type="button" variant="outline" className="h-9" onClick={resetFilters} disabled={isPending}>
                  <IconRefresh className="mr-1.5 size-4" />
                  Reset
                </Button>
              </div>
            </>
          }
          isPending={isPending}
          employeePagination={employeePaginationState}
          systemUserPagination={systemUserPaginationState}
          onEmployeePageChange={(nextPage) => void updateWorkspaceData({ empPage: nextPage })}
          onSystemUserPageChange={(nextPage) => void updateWorkspaceData({ sysPage: nextPage })}
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
              <Label>Email<span className="ml-1 text-destructive">*</span></Label>
              <Input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password<span className="ml-1 text-destructive">*</span></Label>
              <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} disabled={isPending} />
            </div>
            <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
              <span className="text-xs text-foreground">Request Approver (Leave & OT)</span>
              <Switch checked={createApprover} onCheckedChange={setCreateApprover} disabled={isPending} />
            </div>
            <div className="space-y-2 rounded-md border border-border/60 px-3 py-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <IconBuilding className="size-4" />
                Multi-Company Access
              </p>
              <div className="space-y-2">
                {createCompanyAccesses.map((access) => {
                  const company = companyOptions.find((option) => option.companyId === access.companyId)
                  return (
                    <div key={access.companyId} className="rounded-md border border-border/60 px-2 py-2">
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
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
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
                          <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
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
                          <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
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
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
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
            <div className="space-y-2 rounded-md border border-border/60 px-3 py-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <IconBuilding className="size-4" />
                Multi-Company Access
              </p>
              <div className="space-y-2">
                {linkCompanyAccesses.map((access) => {
                  const company = companyOptions.find((option) => option.companyId === access.companyId)
                  return (
                    <div key={access.companyId} className="rounded-md border border-border/60 px-2 py-2">
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
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
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
                          <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
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
                          <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
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
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
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
            <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
              <span className="text-xs text-foreground">Request Approver (Leave & OT)</span>
              <Switch checked={systemApprover} onCheckedChange={setSystemApprover} disabled={isPending} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
                <span className="text-xs text-foreground">MRS Purchaser</span>
                <Switch
                  checked={systemIsMaterialRequestPurchaser}
                  onCheckedChange={setSystemIsMaterialRequestPurchaser}
                  disabled={isPending}
                />
              </div>
              <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
                <span className="text-xs text-foreground">MRS Poster</span>
                <Switch
                  checked={systemIsMaterialRequestPoster}
                  onCheckedChange={setSystemIsMaterialRequestPoster}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
            <Button onClick={submitCreateSystemAccount} disabled={isPending}>Create System Account</Button>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Username<span className="ml-1 text-destructive">*</span></Label>
                  <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} disabled={isPending} placeholder="e.g. john.doe" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email<span className="ml-1 text-destructive">*</span></Label>
                  <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} disabled={isPending} placeholder="e.g. john@company.com" />
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
                <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
                  <span className="text-xs text-foreground">Active Account</span>
                  <Switch checked={editIsActive} onCheckedChange={setEditIsActive} disabled={isPending} />
                </div>
                <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
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
                      className="rounded-md border border-border/60 px-3 py-2.5"
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
                        <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
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
                          <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
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
                          <div className="flex h-7 items-center justify-between rounded-md border border-border/60 px-2.5">
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
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          <DialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-3">
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
            <Button onClick={submitEdit} disabled={isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
