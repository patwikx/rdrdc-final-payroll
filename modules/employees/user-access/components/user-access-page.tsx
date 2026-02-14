"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconBriefcase,
  IconBuilding,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconEdit,
  IconLink,
  IconMail,
  IconPackage,
  IconShieldCheck,
  IconUser,
  IconUserCheck,
  IconUserX,
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
  SystemUserAccountRow,
  UserAccessPreviewRow,
} from "@/modules/employees/user-access/utils/get-user-access-preview-data"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

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
  employeePagination,
  systemUserPagination,
}: UserAccessPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [queryInput, setQueryInput] = useState(query)
  const [employeeLinkFilterInput, setEmployeeLinkFilterInput] = useState<UserAccessLinkFilter>(employeeLinkFilter)
  const [systemLinkFilterInput, setSystemLinkFilterInput] = useState<UserAccessLinkFilter>(systemLinkFilter)

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
    setEmployeeLinkFilterInput(employeeLinkFilter)
  }, [employeeLinkFilter])

  useEffect(() => {
    setSystemLinkFilterInput(systemLinkFilter)
  }, [systemLinkFilter])

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
    router.push(next ? `${pathname}?${next}` : pathname)
  }

  const applyFilters = () => {
    updateRoute({
      q: queryInput,
      empLink: employeeLinkFilterInput,
      sysLink: systemLinkFilterInput,
      empPage: 1,
      sysPage: 1,
    })
  }

  const resetFilters = () => {
    setQueryInput("")
    setEmployeeLinkFilterInput("ALL")
    setSystemLinkFilterInput("ALL")
    updateRoute({
      q: "",
      empLink: "ALL",
      sysLink: "ALL",
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
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto]">
          <Input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                applyFilters()
              }
            }}
            placeholder="Search employee, username, email"
          />
          <Select value={employeeLinkFilterInput} onValueChange={(value) => setEmployeeLinkFilterInput(value as UserAccessLinkFilter)}>
            <SelectTrigger><SelectValue placeholder="Employee Link" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Employee: All</SelectItem>
              <SelectItem value="LINKED">Employee: Linked</SelectItem>
              <SelectItem value="UNLINKED">Employee: Unlinked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={systemLinkFilterInput} onValueChange={(value) => setSystemLinkFilterInput(value as UserAccessLinkFilter)}>
            <SelectTrigger><SelectValue placeholder="System Link" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">System: All</SelectItem>
              <SelectItem value="LINKED">System: Linked</SelectItem>
              <SelectItem value="UNLINKED">System: Unlinked</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={resetFilters} disabled={isPending}>
            Reset
          </Button>
          <Button type="button" onClick={applyFilters} disabled={isPending}>
            Apply
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
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <span className="text-sm text-foreground">Request Approver (Leave & OT)</span>
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
                          <div className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
                            <span className="text-[11px] text-foreground">MRS Purchaser</span>
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
                          <div className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
                            <span className="text-[11px] text-foreground">MRS Poster</span>
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
                          <div className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
                            <span className="text-[11px] text-foreground">MRS Purchaser</span>
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
                          <div className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
                            <span className="text-[11px] text-foreground">MRS Poster</span>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Linked User Credentials</DialogTitle>
            <DialogDescription>
              {dialogState.type === "EDIT" ? `${dialogState.row.fullName} (${dialogState.row.employeeNumber})` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Username<span className="ml-1 text-destructive">*</span></Label>
              <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>Email<span className="ml-1 text-destructive">*</span></Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>New Password (optional)</Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} disabled={isPending} placeholder="Leave blank to keep current password" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <span className="text-sm text-foreground">Request Approver (Leave & OT)</span>
              <Switch checked={editApprover} onCheckedChange={setEditApprover} disabled={isPending} />
            </div>
            <div className="space-y-2 rounded-md border border-border/60 px-3 py-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <IconBuilding className="size-4" />
                Multi-Company Access
              </p>
              <div className="space-y-2">
                {editCompanyAccesses.map((access) => {
                  const company = companyOptions.find((option) => option.companyId === access.companyId)
                  return (
                    <div key={access.companyId} className="rounded-md border border-border/60 px-2 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-sm text-foreground">
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
                        >
                          {access.isDefault && access.enabled ? "Default" : "Set Default"}
                        </Button>
                      </div>

                      {access.enabled ? (
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
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
                          <div className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
                            <span className="text-[11px] text-foreground">MRS Purchaser</span>
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
                          <div className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
                            <span className="text-[11px] text-foreground">MRS Poster</span>
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
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <span className="text-sm text-foreground">Active Account</span>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} disabled={isPending} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
            <Button onClick={submitEdit} disabled={isPending}>Save Credentials</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function UserAccessWorkspace({ rows, systemUsers, onCreate, onLink, onUnlink, onEdit, isPending, employeePagination, systemUserPagination, onEmployeePageChange, onSystemUserPageChange }: {
  rows: UserAccessPreviewRow[]
  systemUsers: SystemUserAccountRow[]
  onCreate: (row: UserAccessPreviewRow) => void
  onLink: (row: UserAccessPreviewRow) => void
  onUnlink: (row: UserAccessPreviewRow) => void
  onEdit: (row: UserAccessPreviewRow) => void
  isPending: boolean
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
  onEmployeePageChange: (nextPage: number) => void
  onSystemUserPageChange: (nextPage: number) => void
}) {
  return (
    <section className="grid border-b border-border/60 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="overflow-hidden xl:border-r xl:border-border/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconUser className="size-3.5" /> <span>Employee</span></span></th>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconBriefcase className="size-3.5" /> <span>Department</span></span></th>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconLink className="size-3.5" /> <span>Linked User</span></span></th>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconShieldCheck className="size-3.5" /> <span>Role</span></span></th>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconUserCheck className="size-3.5" /> <span>Request Approver</span></span></th>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconPackage className="size-3.5" /> <span>MRS Purchaser</span></span></th>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconPackage className="size-3.5" /> <span>MRS Poster</span></span></th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t border-border/60">
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No employees found for the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.employeeId} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 rounded-md border border-border/60 after:rounded-md">
                          <AvatarImage src={row.photoUrl ?? undefined} alt={row.fullName} className="!rounded-md object-cover" />
                          <AvatarFallback className="!rounded-md text-[11px]">
                            {getEmployeeInitials(row.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div>{row.fullName}</div>
                          <div className="text-[11px] text-muted-foreground">{row.employeeNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.department}</td>
                    <td className="px-3 py-2">{row.hasLinkedUser ? <div><div>{row.linkedUsername}</div><div className="text-[11px] text-muted-foreground">{row.linkedEmail}</div></div> : <span className="text-muted-foreground">No linked account</span>}</td>
                    <td className="px-3 py-2">{row.linkedCompanyRole ? <Badge variant="secondary">{row.linkedCompanyRole}</Badge> : <Badge variant="outline">-</Badge>}</td>
                    <td className="px-3 py-2">
                      <Badge variant={row.requestApprover ? "default" : "destructive"}>
                        {row.requestApprover ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={row.materialRequestPurchaser ? "default" : "outline"}>
                        {row.materialRequestPurchaser ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={row.materialRequestPoster ? "default" : "outline"}>
                        {row.materialRequestPoster ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" disabled={isPending}>
                            <IconDots className="size-4 rotate-90" />
                            <span className="sr-only">Open actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {!row.hasLinkedUser ? (
                            <DropdownMenuItem onSelect={() => onCreate(row)} disabled={isPending}>
                              Create & Link User
                            </DropdownMenuItem>
                          ) : null}
                          {!row.hasLinkedUser ? (
                            <DropdownMenuItem onSelect={() => onLink(row)} disabled={isPending}>
                              Link Existing User
                            </DropdownMenuItem>
                          ) : null}
                          {row.hasLinkedUser ? (
                            <DropdownMenuItem onSelect={() => onEdit(row)} disabled={isPending}>
                              <IconEdit className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                          ) : null}
                          {row.hasLinkedUser ? (
                            <DropdownMenuItem onSelect={() => onUnlink(row)} disabled={isPending}>
                              <IconUserX className="mr-2 size-4" />
                              Unlink
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Page {employeePagination.page} of {employeePagination.totalPages} ({employeePagination.totalItems} employees)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={isPending || employeePagination.page <= 1}
              onClick={() => onEmployeePageChange(employeePagination.page - 1)}
            >
              <IconChevronLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={isPending || employeePagination.page >= employeePagination.totalPages}
              onClick={() => onEmployeePageChange(employeePagination.page + 1)}
            >
              <IconChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <aside>
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="inline-flex items-center gap-2.5 text-sm text-foreground"><IconUser className="size-4" /> <span>System User Accounts</span></h2>
          <p className="text-xs text-muted-foreground">Linked status per account</p>
        </div>
        <ScrollArea className="h-[680px]">
          <div>
          {systemUsers.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">No user accounts found for this company.</p>
          ) : (
            systemUsers.map((user) => (
              <div key={user.id} className="border-b border-border/60 px-4 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-foreground">{user.displayName}</p>
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><IconUser className="size-3" /> <span>{user.username}</span></p>
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><IconMail className="size-3" /> <span>{user.email}</span></p>
                  </div>
                  <Badge variant={user.isLinked ? "default" : "outline"} className="inline-flex items-center gap-1.5 px-2.5">
                    {user.isLinked ? <IconLink className="size-3" /> : <IconUserX className="size-3" />}
                    {user.isLinked ? "Linked" : "Unlinked"}
                  </Badge>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                  <Badge variant="secondary" className="px-2.5">{user.companyRole}</Badge>
                  <Badge variant={user.isRequestApprover ? "default" : "outline"} className="px-2.5">{user.isRequestApprover ? "Request Approver" : "Standard"}</Badge>
                  <Badge variant={user.isMaterialRequestPurchaser ? "default" : "outline"} className="px-2.5">
                    {user.isMaterialRequestPurchaser ? "MRS Purchaser" : "No MRS Purchaser"}
                  </Badge>
                  <Badge variant={user.isMaterialRequestPoster ? "default" : "outline"} className="px-2.5">
                    {user.isMaterialRequestPoster ? "MRS Poster" : "No MRS Poster"}
                  </Badge>
                  <Badge variant={user.isActive ? "default" : "outline"} className="px-2.5">{user.isActive ? "Active" : "Inactive"}</Badge>
                </div>
                {user.isLinked && user.linkedEmployeeNumber ? (
                  <p className="mt-2.5 text-[11px] text-muted-foreground">Linked to: {user.linkedEmployeeName} ({user.linkedEmployeeNumber})</p>
                ) : null}
              </div>
            ))
          )}
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <span>
            Page {systemUserPagination.page} of {systemUserPagination.totalPages} ({systemUserPagination.totalItems} users)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={isPending || systemUserPagination.page <= 1}
              onClick={() => onSystemUserPageChange(systemUserPagination.page - 1)}
            >
              <IconChevronLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={isPending || systemUserPagination.page >= systemUserPagination.totalPages}
              onClick={() => onSystemUserPageChange(systemUserPagination.page + 1)}
            >
              <IconChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>
    </section>
  )
}

function getEmployeeInitials(fullName: string): string {
  const [lastNamePart = "", firstNamePart = ""] = fullName.split(",")
  const first = firstNamePart.trim().charAt(0)
  const last = lastNamePart.trim().charAt(0)
  return `${first}${last}`.toUpperCase() || "NA"
}
