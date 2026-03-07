"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  IconAlertCircle,
  IconBuilding,
  IconBriefcase,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconEdit,
  IconKey,
  IconLink,
  IconPackage,
  IconPlus,
  IconShieldCheck,
  IconUser,
  IconUserX,
} from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { WorkspaceProps } from "./workspace-types"
import { getEmployeeInitials } from "./workspace-types"

type TabKey = "setup" | "managed" | "agency"

const workflowBadgeVariant = (active: boolean): "default" | "outline" => (active ? "default" : "outline")

export function UserAccessWorkspace({
  rows,
  systemUsers,
  onCreate,
  onLink,
  onEditSystemAccount,
  onUnlinkSystemAccount,
  onDeleteSystemAccount,
  onCreateSystemAccount,
  filtersToolbar,
  isPending,
  employeePagination,
  systemUserPagination,
  onEmployeePageChange,
  onSystemUserPageChange,
  onTabChange,
}: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("setup")

  useEffect(() => {
    onTabChange?.(activeTab)
  }, [activeTab, onTabChange])

  const unlinkedRows = useMemo(() => rows.filter((row) => !row.hasLinkedUser), [rows])
  const linkedSystemUsers = useMemo(() => systemUsers.filter((user) => user.isLinked), [systemUsers])
  const agencySystemUsers = useMemo(
    () => systemUsers.filter((user) => !user.isLinked && user.hasExternalRequesterProfile),
    [systemUsers]
  )

  const tabs: { key: TabKey; label: string; description: string; icon: ReactNode; count?: number }[] = [
    {
      key: "setup",
      label: "Needs Setup",
      description: "Employees that still need a linked account before they can sign in.",
      icon: <IconAlertCircle className="size-3.5" />,
      count: unlinkedRows.length || undefined,
    },
    {
      key: "managed",
      label: "Managed Accounts",
      description: "Linked employee accounts with company roles and workflow responsibilities.",
      icon: <IconKey className="size-3.5" />,
      count: linkedSystemUsers.length || undefined,
    },
    {
      key: "agency",
      label: "Agency Employees",
      description: "Third-party requester accounts with external requester profiles for procurement.",
      icon: <IconBuilding className="size-3.5" />,
      count: agencySystemUsers.length || undefined,
    },
  ]

  const activeTabMeta = tabs.find((tab) => tab.key === activeTab)

  return (
    <section className="overflow-hidden border border-border/70 bg-background">
      <div className="border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Account Setup and Access Management</h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Workspace help"
                    >
                      <IconAlertCircle className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs leading-5">
                    Review employees that still need access, then switch to managed accounts to maintain linked login records.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab === tab.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.count ? (
                    <span className="inline-flex min-w-5 items-center justify-center border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onCreateSystemAccount} disabled={isPending}>
              <IconPlus className="mr-2 size-4" />
              New Standalone Account
            </Button>
          </div>
        </div>

        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-foreground">{activeTabMeta?.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{activeTabMeta?.description}</p>
        </div>
      </div>

      {activeTab === "setup" ? (
        <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          {filtersToolbar ? (
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">{filtersToolbar}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground xl:justify-end">
                <Badge variant="outline">{unlinkedRows.length} pending setup</Badge>
                <Badge variant="outline">{linkedSystemUsers.length} linked accounts</Badge>
                <Badge variant="outline">{agencySystemUsers.length} agency accounts</Badge>
                <Badge variant="outline">{linkedSystemUsers.filter((user) => user.isActive).length} active</Badge>
              </div>
            </div>
          ) : null}

          {unlinkedRows.length === 0 ? (
            <EmptyStateCard
              title="No employees need access setup on this page"
              description="Adjust the current filters or move to another employee page if you need to continue setup work."
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {unlinkedRows.map((row) => (
                  <article key={row.employeeId} className="border border-border/60 bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      {renderEmployeeIdentity(row.fullName, row.employeeNumber, row.photoUrl)}
                      <Badge variant="outline">
                        No linked account
                      </Badge>
                    </div>

                    <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                      <CompactDataPoint label="Department" value={row.department} icon={<IconBriefcase className="size-3.5" />} />
                      <CompactDataPoint label="Position" value={row.position} icon={<IconShieldCheck className="size-3.5" />} />
                    </dl>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button type="button" className="sm:flex-1" disabled={isPending} onClick={() => onCreate(row)}>
                        <IconPlus className="mr-2 size-4" />
                        Create Account
                      </Button>
                      <Button type="button" variant="outline" className="sm:flex-1" disabled={isPending} onClick={() => onLink(row)}>
                        <IconLink className="mr-2 size-4" />
                        Link Existing
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-hidden border border-border/60 md:block">
                <div className="overflow-x-auto">
                  <Table className="min-w-[920px] text-xs">
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>
                          <span className="inline-flex items-center gap-1.5">
                            <IconUser className="size-3.5" />
                            Employee
                          </span>
                        </TableHead>
                        <TableHead>
                          <span className="inline-flex items-center gap-1.5">
                            <IconBriefcase className="size-3.5" />
                            Department
                          </span>
                        </TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Access Status</TableHead>
                        <TableHead className="text-right">Setup Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unlinkedRows.map((row) => (
                        <TableRow key={row.employeeId}>
                          <TableCell>{renderEmployeeIdentity(row.fullName, row.employeeNumber, row.photoUrl)}</TableCell>
                          <TableCell>{row.department}</TableCell>
                          <TableCell>{row.position}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              No linked account
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" disabled={isPending}>
                                  Set Up Access
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onSelect={() => onCreate(row)} disabled={isPending}>
                                  <IconPlus className="mr-2 size-4" />
                                  Create New Account
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onLink(row)} disabled={isPending}>
                                  <IconLink className="mr-2 size-4" />
                                  Link Existing Account
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          <CompactFooter
            label="Employee page"
            page={employeePagination.page}
            totalPages={employeePagination.totalPages}
            onPrevious={() => onEmployeePageChange(employeePagination.page - 1)}
            onNext={() => onEmployeePageChange(employeePagination.page + 1)}
            disablePrevious={isPending || employeePagination.page <= 1}
            disableNext={isPending || employeePagination.page >= employeePagination.totalPages}
          />
        </div>
      ) : null}

      {activeTab === "managed" ? (
        <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          {filtersToolbar ? (
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">{filtersToolbar}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground xl:justify-end">
                <Badge variant="outline">{unlinkedRows.length} pending setup</Badge>
                <Badge variant="outline">{linkedSystemUsers.length} linked accounts</Badge>
                <Badge variant="outline">{agencySystemUsers.length} agency accounts</Badge>
                <Badge variant="outline">{linkedSystemUsers.filter((user) => user.isActive).length} active</Badge>
              </div>
            </div>
          ) : null}

          {linkedSystemUsers.length === 0 ? (
            <EmptyStateCard
              title="No linked employee accounts found"
              description="Try broadening the current filters. Standalone HR or payroll accounts can still be created from the header action."
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {linkedSystemUsers.map((user) => (
                  <article key={user.id} className="border border-border/60 bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{user.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.username}</p>
                      </div>
                      <Badge variant={user.isActive ? "default" : "destructive"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <dl className="mt-4 grid gap-3 text-xs">
                      <CompactDataPoint label="Role" value={user.companyRole} icon={<IconShieldCheck className="size-3.5" />} />
                      <CompactDataPoint
                        label="Linked Employee"
                        value={
                          user.linkedEmployeeName
                            ? `${user.linkedEmployeeName} (${user.linkedEmployeeNumber ?? "No number"})`
                            : "No linked employee"
                        }
                        icon={<IconLink className="size-3.5" />}
                      />
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <Badge variant={workflowBadgeVariant(user.isRequestApprover)} className="text-[10px]">
                        Approver
                      </Badge>
                      <Badge variant={workflowBadgeVariant(user.isMaterialRequestPurchaser)} className="text-[10px]">
                        Purchaser
                      </Badge>
                      <Badge variant={workflowBadgeVariant(user.isMaterialRequestPoster)} className="text-[10px]">
                        Poster
                      </Badge>
                      <Badge variant={workflowBadgeVariant(user.isPurchaseRequestItemManager)} className="text-[10px]">
                        Item Manager
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="outline" className="sm:flex-1" disabled={isPending} onClick={() => onEditSystemAccount(user)}>
                        <IconEdit className="mr-2 size-4" />
                        Manage Account
                      </Button>
                      <Button type="button" variant="ghost" className="sm:flex-1" disabled={isPending} onClick={() => onUnlinkSystemAccount(user)}>
                        <IconUserX className="mr-2 size-4" />
                        Unlink Employee
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-hidden border border-border/60 md:block">
                <div className="overflow-x-auto">
                  <Table className="min-w-[1120px] text-xs">
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>
                          <span className="inline-flex items-center gap-1.5">
                            <IconUser className="size-3.5" />
                            Account
                          </span>
                        </TableHead>
                        <TableHead>
                          <span className="inline-flex items-center gap-1.5">
                            <IconShieldCheck className="size-3.5" />
                            Role
                          </span>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>
                          <span className="inline-flex items-center gap-1.5">
                            <IconPackage className="size-3.5" />
                            Workflow Flags
                          </span>
                        </TableHead>
                        <TableHead>
                          <span className="inline-flex items-center gap-1.5">
                            <IconLink className="size-3.5" />
                            Linked Employee
                          </span>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedSystemUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{user.displayName}</p>
                              <p className="text-[11px] text-muted-foreground">{user.username}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{user.companyRole}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? "default" : "destructive"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant={workflowBadgeVariant(user.isRequestApprover)} className="text-[10px]">
                                Approver
                              </Badge>
                              <Badge variant={workflowBadgeVariant(user.isMaterialRequestPurchaser)} className="text-[10px]">
                                Purchaser
                              </Badge>
                              <Badge variant={workflowBadgeVariant(user.isMaterialRequestPoster)} className="text-[10px]">
                                Poster
                              </Badge>
                              <Badge variant={workflowBadgeVariant(user.isPurchaseRequestItemManager)} className="text-[10px]">
                                Item Manager
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{user.linkedEmployeeName}</p>
                              <p className="text-[11px] text-muted-foreground">{user.linkedEmployeeNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" disabled={isPending}>
                                  <IconDots className="size-4 rotate-90" />
                                  <span className="sr-only">Open account actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onSelect={() => onEditSystemAccount(user)} disabled={isPending}>
                                  <IconEdit className="mr-2 size-4" />
                                  Manage Account
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onUnlinkSystemAccount(user)} disabled={isPending}>
                                  <IconUserX className="mr-2 size-4" />
                                  Unlink from Employee
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          <WorkspaceTableFooter
            page={systemUserPagination.page}
            totalPages={systemUserPagination.totalPages}
            totalItems={systemUserPagination.totalItems}
            onPrevious={() => onSystemUserPageChange(systemUserPagination.page - 1)}
            onNext={() => onSystemUserPageChange(systemUserPagination.page + 1)}
            disablePrevious={isPending || systemUserPagination.page <= 1}
            disableNext={isPending || systemUserPagination.page >= systemUserPagination.totalPages}
          />
        </div>
      ) : null}

      {activeTab === "agency" ? (
        <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          {filtersToolbar ? (
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">{filtersToolbar}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground xl:justify-end">
                <Badge variant="outline">{agencySystemUsers.length} agency accounts</Badge>
                <Badge variant="outline">{agencySystemUsers.filter((user) => user.isActive).length} active</Badge>
                <Badge variant="outline">{agencySystemUsers.filter((user) => !user.isActive).length} inactive</Badge>
              </div>
            </div>
          ) : null}

          {agencySystemUsers.length === 0 ? (
            <EmptyStateCard
              title="No agency requester accounts found"
              description="Create a standalone account, enable External PR Requester Profile, then it will appear here for management."
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {agencySystemUsers.map((user) => (
                  <article key={user.id} className="border border-border/60 bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{user.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.username}</p>
                      </div>
                      <Badge variant={user.isActive ? "default" : "destructive"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                      <CompactDataPoint label="Requester Code" value={user.externalRequesterCode ?? "-"} icon={<IconBuilding className="size-3.5" />} />
                      <CompactDataPoint label="Role" value={user.companyRole} icon={<IconShieldCheck className="size-3.5" />} />
                    </dl>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="outline" className="sm:flex-1" disabled={isPending} onClick={() => onEditSystemAccount(user)}>
                        <IconEdit className="mr-2 size-4" />
                        Manage Account
                      </Button>
                      <Button type="button" variant="ghost" className="sm:flex-1" disabled={isPending} onClick={() => onDeleteSystemAccount(user)}>
                        <IconUserX className="mr-2 size-4" />
                        Delete Account
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-hidden border border-border/60 md:block">
                <div className="overflow-x-auto">
                  <Table className="min-w-[1040px] text-xs">
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>
                          <span className="inline-flex items-center gap-1.5">
                            <IconUser className="size-3.5" />
                            Account
                          </span>
                        </TableHead>
                        <TableHead>
                          <span className="inline-flex items-center gap-1.5">
                            <IconBuilding className="size-3.5" />
                            Requester Code
                          </span>
                        </TableHead>
                        <TableHead>
                          <span className="inline-flex items-center gap-1.5">
                            <IconShieldCheck className="size-3.5" />
                            Role
                          </span>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agencySystemUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{user.displayName}</p>
                              <p className="text-[11px] text-muted-foreground">{user.username}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.externalRequesterCode ?? "-"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{user.companyRole}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? "default" : "destructive"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" disabled={isPending}>
                                  <IconDots className="size-4 rotate-90" />
                                  <span className="sr-only">Open agency account actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onSelect={() => onEditSystemAccount(user)} disabled={isPending}>
                                  <IconEdit className="mr-2 size-4" />
                                  Manage Account
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onDeleteSystemAccount(user)} disabled={isPending}>
                                  <IconUserX className="mr-2 size-4" />
                                  Delete Account
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          <WorkspaceTableFooter
            page={systemUserPagination.page}
            totalPages={systemUserPagination.totalPages}
            totalItems={systemUserPagination.totalItems}
            onPrevious={() => onSystemUserPageChange(systemUserPagination.page - 1)}
            onNext={() => onSystemUserPageChange(systemUserPagination.page + 1)}
            disablePrevious={isPending || systemUserPagination.page <= 1}
            disableNext={isPending || systemUserPagination.page >= systemUserPagination.totalPages}
          />
        </div>
      ) : null}
    </section>
  )
}

function renderEmployeeIdentity(fullName: string, employeeNumber: string, photoUrl: string | null) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10 border border-border/60 after:rounded-none">
        <AvatarImage
          src={photoUrl ?? undefined}
          alt={fullName}
          loading="lazy"
          className="!rounded-none object-cover"
        />
        <AvatarFallback className="!rounded-none bg-primary/5 text-[11px] font-semibold text-primary">
          {getEmployeeInitials(fullName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{fullName}</p>
        <p className="truncate text-[11px] text-muted-foreground">{employeeNumber}</p>
      </div>
    </div>
  )
}

function CompactDataPoint({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="border border-border/60 bg-muted/15 px-3 py-2.5">
      <dt className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value || "-"}</dd>
    </div>
  )
}

function EmptyStateCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}

function CompactFooter({
  label,
  page,
  totalPages,
  onPrevious,
  onNext,
  disablePrevious,
  disableNext,
}: {
  label: string
  page: number
  totalPages: number
  onPrevious: () => void
  onNext: () => void
  disablePrevious: boolean
  disableNext: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
      <p>
        {label} {page} of {totalPages}
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
    <div className="flex flex-wrap items-center justify-between gap-2 border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
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
