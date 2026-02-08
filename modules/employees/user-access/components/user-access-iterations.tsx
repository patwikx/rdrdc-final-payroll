"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconBriefcase,
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
  updateEmployeeRequestApproverAction,
} from "@/modules/employees/user-access/actions/manage-employee-user-access-action"
import type {
  AvailableSystemUserOption,
  SystemUserAccountRow,
  UserAccessPreviewRow,
} from "@/modules/employees/user-access/utils/get-user-access-preview-data"
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
  | { type: "ACCESS"; row: UserAccessPreviewRow }

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
  const [linkApprover, setLinkApprover] = useState(false)

  const [editUsername, setEditUsername] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editRole, setEditRole] = useState("EMPLOYEE")
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
    setLinkApprover(false)
    setDialogState({ type: "LINK", row })
  }

  const openEdit = (row: UserAccessPreviewRow) => {
    setEditUsername(row.linkedUsername ?? "")
    setEditEmail(row.linkedEmail ?? "")
    setEditPassword("")
    setEditRole(row.linkedCompanyRole ?? "EMPLOYEE")
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
        isRequestApprover: linkApprover,
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

  const submitApproverToggle = (row: UserAccessPreviewRow, value: boolean) => {
    startTransition(async () => {
      const result = await updateEmployeeRequestApproverAction({
        companyId,
        employeeId: row.employeeId,
        isRequestApprover: value,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
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
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <section className="rounded-xl border border-border/70 bg-card/60 p-4">
        <p className="text-xs text-muted-foreground">HR System</p>
        <h1 className="text-xl text-foreground">System User Creation and Employee Link</h1>
        <p className="text-sm text-muted-foreground">{companyName}</p>
      </section>

      <section className="rounded-xl border border-border/70 bg-background p-3">
        <div className="grid gap-2 md:grid-cols-[1fr]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee" />
        </div>
      </section>

      <IterationOne
        rows={filteredRows}
        systemUsers={systemUsers}
        onCreate={openCreate}
        onLink={openLink}
        onToggleApprover={submitApproverToggle}
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
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <span className="text-sm text-foreground">Request Approver (Leave & OT)</span>
              <Switch checked={linkApprover} onCheckedChange={setLinkApprover} disabled={isPending} />
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

function IterationOne({ rows, systemUsers, onCreate, onLink, onToggleApprover, onUnlink, onEdit, isPending }: {
  rows: UserAccessPreviewRow[]
  systemUsers: SystemUserAccountRow[]
  onCreate: (row: UserAccessPreviewRow) => void
  onLink: (row: UserAccessPreviewRow) => void
  onToggleApprover: (row: UserAccessPreviewRow, value: boolean) => void
  onUnlink: (row: UserAccessPreviewRow) => void
  onEdit: (row: UserAccessPreviewRow) => void
  isPending: boolean
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
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
                  <td className="px-3 py-2"><div>{row.fullName}</div><div className="text-[11px] text-muted-foreground">{row.employeeNumber}</div></td>
                  <td className="px-3 py-2 text-muted-foreground">{row.department}</td>
                  <td className="px-3 py-2">{row.hasLinkedUser ? <div><div>{row.linkedUsername}</div><div className="text-[11px] text-muted-foreground">{row.linkedEmail}</div></div> : <span className="text-muted-foreground">No linked account</span>}</td>
                  <td className="px-3 py-2">{row.linkedCompanyRole ? <Badge variant="secondary">{row.linkedCompanyRole}</Badge> : <Badge variant="outline">-</Badge>}</td>
                  <td className="px-3 py-2"><Switch checked={row.requestApprover} disabled={!row.hasLinkedUser || isPending} onCheckedChange={(value) => onToggleApprover(row, value)} /></td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {!row.hasLinkedUser ? <Button size="sm" variant="outline" onClick={() => onCreate(row)} disabled={isPending}>Create & Link User</Button> : null}
                      {!row.hasLinkedUser ? <Button size="sm" variant="outline" onClick={() => onLink(row)} disabled={isPending}>Link Existing User</Button> : null}
                      {row.hasLinkedUser ? <Button size="sm" variant="outline" onClick={() => onEdit(row)} disabled={isPending}>Edit Credentials</Button> : null}
                      {row.hasLinkedUser ? <Button size="sm" variant="outline" onClick={() => onUnlink(row)} disabled={isPending}>Unlink</Button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="rounded-xl border border-border/70 bg-background">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="inline-flex items-center gap-2.5 text-sm text-foreground"><IconUser className="size-4" /> <span>System User Accounts</span></h2>
          <p className="text-xs text-muted-foreground">Linked status per account</p>
        </div>
        <ScrollArea className="h-[680px]">
          <div className="space-y-2 p-3">
          {systemUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No user accounts found for this company.</p>
          ) : (
            systemUsers.map((user) => (
              <div key={user.id} className="rounded-lg border border-border/60 p-3">
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
