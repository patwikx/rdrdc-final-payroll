"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconBriefcase,
  IconDots,
  IconEdit,
  IconLink,
  IconMail,
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
  updateLinkedUserCredentialsAction,
} from "@/modules/employees/user-access/actions/manage-employee-user-access-action"
import type {
  AvailableSystemUserOption,
  SystemUserAccountRow,
  UserAccessPreviewRow,
} from "@/modules/employees/user-access/utils/get-user-access-preview-data"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

type UserAccessIterationsProps = {
  companyId: string
  companyName: string
  rows: UserAccessPreviewRow[]
  availableUsers: AvailableSystemUserOption[]
  systemUsers: SystemUserAccountRow[]
}

type ActionDialogState =
  | { type: "NONE" }
  | { type: "CREATE"; row: UserAccessPreviewRow }
  | { type: "LINK"; row: UserAccessPreviewRow }
  | { type: "EDIT"; row: UserAccessPreviewRow }

export function UserAccessIterations({ companyId, companyName, rows, availableUsers, systemUsers }: UserAccessIterationsProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")

  const [dialogState, setDialogState] = useState<ActionDialogState>({ type: "NONE" })
  const [isPending, startTransition] = useTransition()

  const [createUsername, setCreateUsername] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createRole, setCreateRole] = useState("EMPLOYEE")
  const [createApprover, setCreateApprover] = useState(false)

  const [linkUserId, setLinkUserId] = useState("")
  const [linkRole, setLinkRole] = useState("EMPLOYEE")

  const [editUsername, setEditUsername] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editRole, setEditRole] = useState("EMPLOYEE")
  const [editApprover, setEditApprover] = useState(false)
  const [editIsActive, setEditIsActive] = useState(true)

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => `${row.employeeNumber} ${row.fullName} ${row.department} ${row.position}`.toLowerCase().includes(q))
  }, [query, rows])

  const openCreate = (row: UserAccessPreviewRow) => {
    const nameBase = `${row.fullName.split(",")[1]?.trim() ?? "user"}.${row.fullName.split(",")[0]?.trim() ?? ""}`
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._-]/g, "")
    setCreateUsername(nameBase || `user.${row.employeeNumber.toLowerCase()}`)
    setCreateEmail("")
    setCreatePassword("")
    setCreateRole("EMPLOYEE")
    setCreateApprover(false)
    setDialogState({ type: "CREATE", row })
  }

  const openLink = (row: UserAccessPreviewRow) => {
    setLinkUserId("")
    setLinkRole("EMPLOYEE")
    setDialogState({ type: "LINK", row })
  }

  const openEdit = (row: UserAccessPreviewRow) => {
    setEditUsername(row.linkedUsername ?? "")
    setEditEmail(row.linkedEmail ?? "")
    setEditPassword("")
    setEditRole(row.linkedCompanyRole ?? "EMPLOYEE")
    setEditApprover(row.requestApprover)
    setEditIsActive(row.linkedUserActive)
    setDialogState({ type: "EDIT", row })
  }

  const closeDialog = () => {
    if (isPending) return
    setDialogState({ type: "NONE" })
  }

  const submitCreate = () => {
    if (dialogState.type !== "CREATE") return

    startTransition(async () => {
      const result = await createEmployeeSystemUserAction({
        companyId,
        employeeId: dialogState.row.employeeId,
        username: createUsername,
        email: createEmail,
        password: createPassword,
        companyRole: createRole as "COMPANY_ADMIN" | "HR_ADMIN" | "PAYROLL_ADMIN" | "EMPLOYEE",
        isRequestApprover: createApprover,
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

  const submitLink = () => {
    if (dialogState.type !== "LINK") return
    if (!linkUserId) {
      toast.error("Select a user to link.")
      return
    }

    startTransition(async () => {
      const result = await linkEmployeeToExistingUserAction({
        companyId,
        employeeId: dialogState.row.employeeId,
        userId: linkUserId,
        companyRole: linkRole as "COMPANY_ADMIN" | "HR_ADMIN" | "PAYROLL_ADMIN" | "EMPLOYEE",
        isRequestApprover: false,
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

  const submitEdit = () => {
    if (dialogState.type !== "EDIT") return

    startTransition(async () => {
      const result = await updateLinkedUserCredentialsAction({
        companyId,
        employeeId: dialogState.row.employeeId,
        username: editUsername,
        email: editEmail,
        password: editPassword.trim().length > 0 ? editPassword : undefined,
        isActive: editIsActive,
        companyRole: editRole as "COMPANY_ADMIN" | "HR_ADMIN" | "PAYROLL_ADMIN" | "EMPLOYEE",
        isRequestApprover: editApprover,
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
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee" className="max-w-md" />
      </section>

      <IterationOne
        rows={filteredRows}
        systemUsers={systemUsers}
        onCreate={openCreate}
        onLink={openLink}
        onUnlink={submitUnlink}
        onEdit={openEdit}
        isPending={isPending}
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
            <div className="space-y-2">
              <Label>Company Role</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                  <SelectItem value="HR_ADMIN">HR_ADMIN</SelectItem>
                  <SelectItem value="PAYROLL_ADMIN">PAYROLL_ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <span className="text-sm text-foreground">Request Approver (Leave & OT)</span>
              <Switch checked={createApprover} onCheckedChange={setCreateApprover} disabled={isPending} />
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
            <div className="space-y-2">
              <Label>Company Role</Label>
              <Select value={linkRole} onValueChange={setLinkRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                  <SelectItem value="HR_ADMIN">HR_ADMIN</SelectItem>
                  <SelectItem value="PAYROLL_ADMIN">PAYROLL_ADMIN</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <Label>Company Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                  <SelectItem value="HR_ADMIN">HR_ADMIN</SelectItem>
                  <SelectItem value="PAYROLL_ADMIN">PAYROLL_ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <span className="text-sm text-foreground">Request Approver (Leave & OT)</span>
              <Switch checked={editApprover} onCheckedChange={setEditApprover} disabled={isPending} />
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

function IterationOne({ rows, systemUsers, onCreate, onLink, onUnlink, onEdit, isPending }: {
  rows: UserAccessPreviewRow[]
  systemUsers: SystemUserAccountRow[]
  onCreate: (row: UserAccessPreviewRow) => void
  onLink: (row: UserAccessPreviewRow) => void
  onUnlink: (row: UserAccessPreviewRow) => void
  onEdit: (row: UserAccessPreviewRow) => void
  isPending: boolean
}) {
  return (
    <section className="grid border-b border-border/60 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="overflow-hidden xl:border-r xl:border-border/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconUser className="size-3.5" /> <span>Employee</span></span></th>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconBriefcase className="size-3.5" /> <span>Department</span></span></th>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconLink className="size-3.5" /> <span>Linked User</span></span></th>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconShieldCheck className="size-3.5" /> <span>Role</span></span></th>
                <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconUserCheck className="size-3.5" /> <span>Request Approver</span></span></th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
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
              ))}
            </tbody>
          </table>
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
