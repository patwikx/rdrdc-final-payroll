"use client"

import { useState } from "react"
import {
  IconAlertCircle,
  IconBriefcase,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconEdit,
  IconKey,
  IconLink,
  IconMail,
  IconPackage,
  IconPlus,
  IconShieldCheck,
  IconUser,
  IconUserCheck,
  IconUsers,
  IconUserX,
} from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { WorkspaceProps } from "./workspace-types"
import { getEmployeeInitials } from "./workspace-types"

/**
 * User Access Workspace — Tabbed Views Layout
 *
 * Full-width layout with no sidebar. Three tabs with distinct user intents:
 * 1. Employee Roster — general overview
 * 2. System Accounts — account audit view
 * 3. Unlinked — onboarding to-do list
 */
export function UserAccessWorkspace({
  rows,
  systemUsers,
  onCreate,
  onLink,
  onUnlink,
  onEdit,
  onCreateSystemAccount,
  isPending,
  employeePagination,
  systemUserPagination,
  onEmployeePageChange,
  onSystemUserPageChange,
}: WorkspaceProps) {
  type TabKey = "roster" | "accounts" | "unlinked"
  const [activeTab, setActiveTab] = useState<TabKey>("roster")

  const unlinkedRows = rows.filter((r) => !r.hasLinkedUser)

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "roster", label: "Employee Roster", icon: <IconUsers className="size-3.5" /> },
    { key: "accounts", label: "System Accounts", icon: <IconKey className="size-3.5" /> },
    { key: "unlinked", label: "Unlinked", icon: <IconAlertCircle className="size-3.5" />, count: unlinkedRows.length > 0 ? unlinkedRows.length : undefined },
  ]

  return (
    <section className="border-b border-border/60">
      {/* ── Tab Bar ── */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 sm:px-6">
        <div className="flex items-center gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count != null ? (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-500">
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {activeTab === "accounts" ? (
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            disabled={isPending}
            onClick={onCreateSystemAccount}
          >
            <IconPlus className="size-3.5" />
            Create System Account
          </Button>
        ) : null}
      </div>

      {/* ── Tab: Employee Roster ── */}
      {activeTab === "roster" ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconUser className="size-3.5" /> <span>Employee</span></span></th>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconBriefcase className="size-3.5" /> <span>Department</span></span></th>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconLink className="size-3.5" /> <span>Linked User</span></span></th>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconShieldCheck className="size-3.5" /> <span>Role</span></span></th>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconUserCheck className="size-3.5" /> <span>Approver</span></span></th>
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <p>
              Page {employeePagination.page} of {employeePagination.totalPages} • {employeePagination.totalItems} records
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={isPending || employeePagination.page <= 1}
                onClick={() => onEmployeePageChange(employeePagination.page - 1)}
              >
                <IconChevronLeft className="size-3.5" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={isPending || employeePagination.page >= employeePagination.totalPages}
                onClick={() => onEmployeePageChange(employeePagination.page + 1)}
              >
                Next
                <IconChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {/* ── Tab: System Accounts ── */}
      {activeTab === "accounts" ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconUser className="size-3.5" /> Account</span></th>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconMail className="size-3.5" /> Email</span></th>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconShieldCheck className="size-3.5" /> Role</span></th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconUserCheck className="size-3.5" /> Approver</span></th>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconPackage className="size-3.5" /> MRS</span></th>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconLink className="size-3.5" /> Linked Employee</span></th>
                </tr>
              </thead>
              <tbody>
                {systemUsers.length === 0 ? (
                  <tr className="border-t border-border/60">
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No system accounts found.
                    </td>
                  </tr>
                ) : (
                  systemUsers.map((user) => (
                    <tr key={user.id} className="border-t border-border/60">
                      <td className="px-3 py-2">
                        <div>
                          <div className="font-medium text-foreground">{user.displayName}</div>
                          <div className="text-[11px] text-muted-foreground">{user.username}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{user.email}</td>
                      <td className="px-3 py-2"><Badge variant="secondary">{user.companyRole}</Badge></td>
                      <td className="px-3 py-2">
                        <Badge variant={user.isActive ? "default" : "destructive"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={user.isRequestApprover ? "default" : "outline"}>
                          {user.isRequestApprover ? "Yes" : "No"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Badge variant={user.isMaterialRequestPurchaser ? "default" : "outline"} className="text-[10px]">
                            {user.isMaterialRequestPurchaser ? "Buy ✓" : "Buy ✗"}
                          </Badge>
                          <Badge variant={user.isMaterialRequestPoster ? "default" : "outline"} className="text-[10px]">
                            {user.isMaterialRequestPoster ? "Post ✓" : "Post ✗"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {user.isLinked ? (
                          <div>
                            <div className="text-foreground">{user.linkedEmployeeName}</div>
                            <div className="text-[11px] text-muted-foreground">{user.linkedEmployeeNumber}</div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <IconAlertCircle className="size-3" />
                            Orphan
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <p>
              Page {systemUserPagination.page} of {systemUserPagination.totalPages} • {systemUserPagination.totalItems} records
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={isPending || systemUserPagination.page <= 1}
                onClick={() => onSystemUserPageChange(systemUserPagination.page - 1)}
              >
                <IconChevronLeft className="size-3.5" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={isPending || systemUserPagination.page >= systemUserPagination.totalPages}
                onClick={() => onSystemUserPageChange(systemUserPagination.page + 1)}
              >
                Next
                <IconChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {/* ── Tab: Unlinked ── */}
      {activeTab === "unlinked" ? (
        <>
          {unlinkedRows.length > 0 ? (
            <div className="border-b border-border/60 bg-amber-500/5 px-4 py-2 sm:px-6">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {unlinkedRows.length} employee{unlinkedRows.length !== 1 ? "s" : ""} on this page without a linked system account. Use actions to create or link accounts.
              </p>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconUser className="size-3.5" /> Employee</span></th>
                  <th className="px-3 py-2 text-left"><span className="inline-flex items-center gap-1.5"><IconBriefcase className="size-3.5" /> Department</span></th>
                  <th className="px-3 py-2 text-left">Position</th>
                  <th className="px-3 py-2 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {unlinkedRows.length === 0 ? (
                  <tr className="border-t border-border/60">
                    <td colSpan={4} className="px-3 py-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <IconUserCheck className="size-8 text-emerald-500/60" />
                        <p className="text-sm text-muted-foreground">All employees on this page are linked!</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  unlinkedRows.map((row) => (
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
                      <td className="px-3 py-2 text-muted-foreground">{row.position}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 gap-1.5 px-2.5 text-xs"
                            disabled={isPending}
                            onClick={() => onCreate(row)}
                          >
                            Create & Link
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 px-2.5 text-xs"
                            disabled={isPending}
                            onClick={() => onLink(row)}
                          >
                            <IconLink className="size-3.5" />
                            Link Existing
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <p>
              Page {employeePagination.page} of {employeePagination.totalPages} • {employeePagination.totalItems} records
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={isPending || employeePagination.page <= 1}
                onClick={() => onEmployeePageChange(employeePagination.page - 1)}
              >
                <IconChevronLeft className="size-3.5" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={isPending || employeePagination.page >= employeePagination.totalPages}
                onClick={() => onEmployeePageChange(employeePagination.page + 1)}
              >
                Next
                <IconChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
