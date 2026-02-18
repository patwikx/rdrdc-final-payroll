"use client"

import { useState, type ReactNode } from "react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { WorkspaceProps } from "./workspace-types"
import { getEmployeeInitials } from "./workspace-types"

type TabKey = "roster" | "accounts" | "unlinked"

export function UserAccessWorkspace({
  rows,
  systemUsers,
  onCreate,
  onLink,
  onUnlink,
  onEdit,
  onCreateSystemAccount,
  filtersToolbar,
  isPending,
  employeePagination,
  systemUserPagination,
  onEmployeePageChange,
  onSystemUserPageChange,
}: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("roster")
  const unlinkedRows = rows.filter((row) => !row.hasLinkedUser)
  const tabs: { key: TabKey; label: string; icon: ReactNode; count?: number }[] = [
    { key: "roster", label: "Employee Roster", icon: <IconUsers className="size-3.5" /> },
    { key: "accounts", label: "System Accounts", icon: <IconKey className="size-3.5" /> },
    {
      key: "unlinked",
      label: "Unlinked",
      icon: <IconAlertCircle className="size-3.5" />,
      count: unlinkedRows.length > 0 ? unlinkedRows.length : undefined,
    },
  ]

  return (
    <section className="overflow-hidden border border-border/70 bg-background">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2 sm:px-6">
        <div className="inline-flex items-center gap-0 rounded-md border border-border/70 bg-background p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
            className="h-8 gap-1.5 px-2.5 text-xs"
            disabled={isPending}
            onClick={onCreateSystemAccount}
          >
            <IconPlus className="size-3.5" />
            Create System Account
          </Button>
        ) : null}
      </div>

      {filtersToolbar ? (
        <div className="border-b border-border/60 px-4 py-3 sm:px-6">
          {filtersToolbar}
        </div>
      ) : null}

      {activeTab === "roster" ? (
        <>
          <div className="overflow-x-auto">
            <Table className="min-w-[1140px] text-xs">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>
                    <span className="inline-flex items-center gap-1.5"><IconUser className="size-3.5" />Employee</span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1.5"><IconBriefcase className="size-3.5" />Department</span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1.5"><IconLink className="size-3.5" />Linked User</span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1.5"><IconShieldCheck className="size-3.5" />Role</span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1.5"><IconUserCheck className="size-3.5" />Approver</span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1.5"><IconPackage className="size-3.5" />MRS Purchaser</span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1.5"><IconPackage className="size-3.5" />MRS Poster</span>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No employees found for the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-md border border-border/60 after:rounded-md">
                            <AvatarImage
                              src={row.photoUrl ?? undefined}
                              alt={row.fullName}
                              loading="lazy"
                              className="!rounded-md object-cover"
                            />
                            <AvatarFallback className="!rounded-md text-[11px]">
                              {getEmployeeInitials(row.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{row.fullName}</p>
                            <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell>
                        {row.hasLinkedUser ? (
                          <div>
                            <p className="font-medium text-foreground">{row.linkedUsername}</p>
                            <p className="text-[11px] text-muted-foreground">{row.linkedEmail}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No linked account</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.linkedCompanyRole ? <Badge variant="secondary">{row.linkedCompanyRole}</Badge> : <Badge variant="outline">-</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.requestApprover ? "default" : "destructive"}>
                          {row.requestApprover ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.materialRequestPurchaser ? "default" : "outline"}>
                          {row.materialRequestPurchaser ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.materialRequestPoster ? "default" : "outline"}>
                          {row.materialRequestPoster ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <WorkspaceTableFooter
            page={employeePagination.page}
            totalPages={employeePagination.totalPages}
            totalItems={employeePagination.totalItems}
            onPrevious={() => onEmployeePageChange(employeePagination.page - 1)}
            onNext={() => onEmployeePageChange(employeePagination.page + 1)}
            disablePrevious={isPending || employeePagination.page <= 1}
            disableNext={isPending || employeePagination.page >= employeePagination.totalPages}
          />
        </>
      ) : null}

      {activeTab === "accounts" ? (
        <>
          <div className="overflow-x-auto">
            <Table className="min-w-[980px] text-xs">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead><span className="inline-flex items-center gap-1.5"><IconUser className="size-3.5" />Account</span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1.5"><IconMail className="size-3.5" />Email</span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1.5"><IconShieldCheck className="size-3.5" />Role</span></TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="inline-flex items-center gap-1.5"><IconUserCheck className="size-3.5" />Approver</span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1.5"><IconPackage className="size-3.5" />MRS</span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1.5"><IconLink className="size-3.5" />Linked Employee</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No system accounts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  systemUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{user.displayName}</p>
                        <p className="text-[11px] text-muted-foreground">{user.username}</p>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell><Badge variant="secondary">{user.companyRole}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "destructive"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isRequestApprover ? "default" : "outline"}>
                          {user.isRequestApprover ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant={user.isMaterialRequestPurchaser ? "default" : "outline"} className="text-[10px]">
                            {user.isMaterialRequestPurchaser ? "Buy ✓" : "Buy ✗"}
                          </Badge>
                          <Badge variant={user.isMaterialRequestPoster ? "default" : "outline"} className="text-[10px]">
                            {user.isMaterialRequestPoster ? "Post ✓" : "Post ✗"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.isLinked ? (
                          <div>
                            <p className="font-medium text-foreground">{user.linkedEmployeeName}</p>
                            <p className="text-[11px] text-muted-foreground">{user.linkedEmployeeNumber}</p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <IconAlertCircle className="size-3" />
                            Orphan
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <WorkspaceTableFooter
            page={systemUserPagination.page}
            totalPages={systemUserPagination.totalPages}
            totalItems={systemUserPagination.totalItems}
            onPrevious={() => onSystemUserPageChange(systemUserPagination.page - 1)}
            onNext={() => onSystemUserPageChange(systemUserPagination.page + 1)}
            disablePrevious={isPending || systemUserPagination.page <= 1}
            disableNext={isPending || systemUserPagination.page >= systemUserPagination.totalPages}
          />
        </>
      ) : null}

      {activeTab === "unlinked" ? (
        <>
          {unlinkedRows.length > 0 ? (
            <div className="border-b border-border/60 bg-amber-500/5 px-4 py-2 sm:px-6">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {unlinkedRows.length} employee{unlinkedRows.length !== 1 ? "s" : ""} on this page without a linked
                system account. Use actions to create or link accounts.
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table className="min-w-[880px] text-xs">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead><span className="inline-flex items-center gap-1.5"><IconUser className="size-3.5" />Employee</span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1.5"><IconBriefcase className="size-3.5" />Department</span></TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="text-right">Quick Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlinkedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-3 py-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <IconUserCheck className="size-8 text-emerald-500/60" />
                        <p className="text-sm text-muted-foreground">All employees on this page are linked.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  unlinkedRows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-md border border-border/60 after:rounded-md">
                            <AvatarImage
                              src={row.photoUrl ?? undefined}
                              alt={row.fullName}
                              loading="lazy"
                              className="!rounded-md object-cover"
                            />
                            <AvatarFallback className="!rounded-md text-[11px]">
                              {getEmployeeInitials(row.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{row.fullName}</p>
                            <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell>{row.position}</TableCell>
                      <TableCell className="text-right">
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <WorkspaceTableFooter
            page={employeePagination.page}
            totalPages={employeePagination.totalPages}
            totalItems={employeePagination.totalItems}
            onPrevious={() => onEmployeePageChange(employeePagination.page - 1)}
            onNext={() => onEmployeePageChange(employeePagination.page + 1)}
            disablePrevious={isPending || employeePagination.page <= 1}
            disableNext={isPending || employeePagination.page >= employeePagination.totalPages}
          />
        </>
      ) : null}
    </section>
  )
}

function WorkspaceTableFooter({
  page,
  totalPages,
  totalItems,
  onPrevious,
  onNext,
  disablePrevious,
  disableNext,
}: {
  page: number
  totalPages: number
  totalItems: number
  onPrevious: () => void
  onNext: () => void
  disablePrevious: boolean
  disableNext: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
      <p>
        Page {page} of {totalPages} · {totalItems} records
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={disablePrevious} onClick={onPrevious}>
          <IconChevronLeft className="size-3.5" />
          Prev
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={disableNext} onClick={onNext}>
          Next
          <IconChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
