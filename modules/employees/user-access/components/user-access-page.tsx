"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconBuilding,
} from "@tabler/icons-react"
import { toast } from "sonner"

import {
  createEmployeeSystemUserAction,
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
  availableUsers: AvailableSystemUserOption[]
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
  | { type: "EDIT"; row: UserAccessPreviewRow }

const resolveUnifiedLinkFilter = (
  employeeFilter: UserAccessLinkFilter,
  systemFilter: UserAccessLinkFilter
): UserAccessLinkFilter => (employeeFilter !== "ALL" ? employeeFilter : systemFilter)

export function UserAccessPage({
  companyId,
  companyName,
  rows,
  availableUsers,
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
  const searchParams = useSearchParams()
  const [queryInput, setQueryInput] = useState(query)
  const [linkFilterInput, setLinkFilterInput] = useState<UserAccessLinkFilter>(
    resolveUnifiedLinkFilter(employeeLinkFilter, systemLinkFilter)
  )
  const [roleFilterInput, setRoleFilterInput] = useState<UserAccessRoleFilter>(roleFilter)

  const [dialogState, setDialogState] = useState<ActionDialogState>({ type: "NONE" })
  const [isPending, startTransition] = useTransition()

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

  useEffect(() => {
    setQueryInput(query)
  }, [query])

  useEffect(() => {
    setLinkFilterInput(resolveUnifiedLinkFilter(employeeLinkFilter, systemLinkFilter))
  }, [employeeLinkFilter, systemLinkFilter])

  useEffect(() => {
    setRoleFilterInput(roleFilter)
  }, [roleFilter])

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

  const updateRoute = (updates: {
    q?: string
    empLink?: UserAccessLinkFilter
    sysLink?: UserAccessLinkFilter
    role?: UserAccessRoleFilter
    empPage?: number
    sysPage?: number
  }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (typeof updates.q !== "undefined") {
      const value = updates.q.trim()
      if (value) {
        params.set("q", value)
      } else {
        params.delete("q")
      }
    }

    if (typeof updates.empLink !== "undefined") {
      if (updates.empLink === "ALL") {
        params.delete("empLink")
      } else {
        params.set("empLink", updates.empLink)
      }
    }

    if (typeof updates.sysLink !== "undefined") {
      if (updates.sysLink === "ALL") {
        params.delete("sysLink")
      } else {
        params.set("sysLink", updates.sysLink)
      }
    }

    if (typeof updates.role !== "undefined") {
      if (updates.role === "ALL") {
        params.delete("role")
      } else {
        params.set("role", updates.role)
      }
    }

    if (typeof updates.empPage !== "undefined") {
      if (updates.empPage > 1) {
        params.set("empPage", String(updates.empPage))
      } else {
        params.delete("empPage")
      }
    }

    if (typeof updates.sysPage !== "undefined") {
      if (updates.sysPage > 1) {
        params.set("sysPage", String(updates.sysPage))
      } else {
        params.delete("sysPage")
      }
    }

    const next = params.toString()
    if (next === searchParams.toString()) {
      return
    }

    router.push(next ? `${pathname}?${next}` : pathname)
  }

  const syncFiltersToRoute = () => {
    updateRoute({
      q: queryInput,
      empLink: linkFilterInput,
      sysLink: linkFilterInput,
      role: roleFilterInput,
      empPage: 1,
      sysPage: 1,
    })
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      syncFiltersToRoute()
    }, 250)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput, linkFilterInput, roleFilterInput])

  const resetFilters = () => {
    setQueryInput("")
    setLinkFilterInput("ALL")
    setRoleFilterInput("ALL")
    updateRoute({
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

    startTransition(async () => {
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

    startTransition(async () => {
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

    startTransition(async () => {
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

  const submitUnlink = (row: UserAccessPreviewRow) => {
    startTransition(async () => {
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
      <section className="flex flex-col gap-2 border-b border-border/60 px-4 pb-6 pt-6 sm:px-6">
        <p className="text-xs text-muted-foreground">HR System</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">System User Creation and Employee Link</h1>
        <p className="text-sm text-muted-foreground">{companyName}</p>
      </section>

      <section className="border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="min-w-0 md:w-[360px] md:flex-none">
            <Input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search employee, username, email"
            />
          </div>
          <Select value={linkFilterInput} onValueChange={(value) => setLinkFilterInput(value as UserAccessLinkFilter)}>
            <SelectTrigger className="w-full md:w-[220px]"><SelectValue placeholder="Link Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="LINKED">Linked</SelectItem>
              <SelectItem value="UNLINKED">Unlinked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilterInput} onValueChange={(value) => setRoleFilterInput(value as UserAccessRoleFilter)}>
            <SelectTrigger className="w-full md:w-[220px]"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
              <SelectItem value="HR_ADMIN">HR_ADMIN</SelectItem>
              <SelectItem value="PAYROLL_ADMIN">PAYROLL_ADMIN</SelectItem>
              <SelectItem value="COMPANY_ADMIN">COMPANY_ADMIN</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={resetFilters} disabled={isPending}>
            Reset
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Employees: {employeePagination.totalItems} total | System users: {systemUserPagination.totalItems} total
        </p>
      </section>

      <UserAccessWorkspace
        rows={rows}
        systemUsers={systemUsers}
        onCreate={openCreate}
        onLink={openLink}
        onUnlink={submitUnlink}
        onEdit={openEdit}
        isPending={isPending}
        employeePagination={employeePagination}
        systemUserPagination={systemUserPagination}
        onEmployeePageChange={(nextPage) => updateRoute({ empPage: nextPage })}
        onSystemUserPageChange={(nextPage) => updateRoute({ sysPage: nextPage })}
      />

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
              <Select value={linkUserId} onValueChange={setLinkUserId}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.displayName} ({user.username})</SelectItem>
                  ))}
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
              <Button onClick={submitLink} disabled={isPending || !linkUserId}>Link Existing User</Button>
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

