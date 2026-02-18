"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  IconCheck,
  IconAlertTriangle,
  IconBuilding,
  IconChevronDown,
  IconChevronUp,
  IconChevronsUp,
  IconEye,
  IconFileExport,
  IconFilter,
  IconMail,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconShield,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  deleteEmployeeAction,
  restoreEmployeeAction,
} from "@/modules/employees/masterlist/actions/delete-employee-action"
import type { EmployeeMasterlistRow } from "@/modules/employees/masterlist/utils/get-employee-masterlist-data"

type EmployeeMasterlistPageProps = {
  companyId: string
  companyName: string
  employees: EmployeeMasterlistRow[]
  canDeleteEmployees: boolean
}

type SortColumn = "name" | "employeeNumber" | "department" | "status"
type SortDirection = "asc" | "desc"

const PAGE_SIZE = 10
const MASTERLIST_GRID_COLUMNS =
  "grid-cols-[minmax(260px,_2.2fr)_minmax(180px,_1.4fr)_minmax(150px,_1.1fr)_120px_minmax(180px,_1fr)]"

export function EmployeeMasterlistPage({
  companyId,
  companyName,
  employees,
  canDeleteEmployees,
}: EmployeeMasterlistPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [searchTerm, setSearchTerm] = useState("")
  const [activeDept, setActiveDept] = useState<string | null>(null)
  const [activeBranch, setActiveBranch] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState<"active" | "all" | "inactive">("active")
  const [sortColumn, setSortColumn] = useState<SortColumn>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const initialPage = useMemo(() => {
    const rawPage = searchParams.get("page")
    if (!rawPage) return 1
    const parsed = Number(rawPage)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
  }, [searchParams])
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    employeeNumber: string
    fullName: string
    isActive: boolean
  } | null>(null)

  const departments = useMemo(
    () =>
      Array.from(new Set(employees.map((employee) => employee.department).filter((value) => value !== "-"))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [employees]
  )

  const branches = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.branch).filter((value) => value !== "-"))).sort((a, b) => a.localeCompare(b)),
    [employees]
  )

  const statuses = useMemo(
    () =>
      Array.from(new Set(employees.map((employee) => employee.employmentStatus).filter((value) => value !== "-"))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [employees]
  )

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const visible = employees.filter((employee) => {
      if (showFilter === "active" && !employee.isActive) return false
      if (showFilter === "inactive" && employee.isActive) return false
      if (activeDept && employee.department !== activeDept) return false
      if (activeBranch && employee.branch !== activeBranch) return false
      if (activeStatus && employee.employmentStatus !== activeStatus) return false

      if (!normalizedSearch) return true

      const haystack = `${employee.employeeNumber} ${employee.fullName} ${employee.email} ${employee.mobile} ${employee.position} ${employee.department} ${employee.branch}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })

    return [...visible].sort((a, b) => sortRows(a, b, sortColumn, sortDirection))
  }, [activeBranch, activeDept, activeStatus, employees, searchTerm, showFilter, sortColumn, sortDirection])

  const totalCount = filteredEmployees.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedEmployees = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return filteredEmployees.slice(start, start + PAGE_SIZE)
  }, [filteredEmployees, safeCurrentPage])

  const toggleSort = (column: SortColumn) => {
    setCurrentPage(1)
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortColumn(column)
    setSortDirection("asc")
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    const target = deleteTarget

    startDeleteTransition(async () => {
      const result = await deleteEmployeeAction({
        companyId,
        employeeId: target.id,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message, {
        action: {
          label: "Undo",
          onClick: () => {
            startDeleteTransition(async () => {
              const restoreResult = await restoreEmployeeAction({
                companyId,
                employeeId: target.id,
                restoreActive: target.isActive,
              })

              if (!restoreResult.ok) {
                toast.error(restoreResult.error)
                return
              }

              toast.success(restoreResult.message)
              router.refresh()
            })
          },
        },
      })
      setDeleteTarget(null)
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -right-24 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-8 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />

        <section className="relative w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Human Resources</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  <IconUsers className="size-6 text-primary sm:size-7" />
                  Employee Directory
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  <IconBuilding className="mr-1 size-3.5" />
                  {companyName}
                </Badge>
                <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                  <IconUsers className="mr-1 size-3.5" />
                  {totalCount} Visible
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Browse, filter, and manage employee records across the company.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-8 border-border/70">
                <a href={`/${companyId}/employees/bulk-template`}>
                  <IconFileExport className="mr-1.5 size-3.5" />
                  CSV Template
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 border-border/70">
                <Link href={`/${companyId}/employees/bulk-update`}>Bulk Update</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-border/70"
                onClick={() => toast.info("Advanced search UI mirrors reference; API wiring can be added next.")}
              >
                <IconFilter className="mr-1.5 size-3.5" />
                Advanced Search
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-border/70"
                onClick={() => toast.info("Bulk email action is not yet wired for this module path.")}
              >
                <IconMail className="mr-1.5 size-3.5" />
                Email Filtered
              </Button>
              <Button asChild size="sm" className="h-8">
                <Link href={`/${companyId}/employees/onboarding`}>
                  <IconPlus className="mr-1.5 size-3.5" />
                  New Employee
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>

      <section className="grid w-full gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4">
          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">Find Employee</CardTitle>
              <CardDescription className="text-xs">Search by employee id, name, email, or department.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="relative">
                <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setCurrentPage(1)
                  }}
                  className="h-9 border-border/70 pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <VisibilityButton value="active" activeValue={showFilter} onSelect={setShowFilter} label="Active" />
                <VisibilityButton value="all" activeValue={showFilter} onSelect={setShowFilter} label="All" />
                <VisibilityButton value="inactive" activeValue={showFilter} onSelect={setShowFilter} label="Inactive" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="inline-flex items-center gap-2 text-sm">
                <IconBuilding className="size-4 text-primary" />
                Departments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pb-4">
              <FilterListButton
                label="All Departments"
                active={!activeDept}
                onClick={() => {
                  setActiveDept(null)
                  setCurrentPage(1)
                }}
              />
              <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                {departments.map((department) => (
                  <FilterListButton
                    key={department}
                    label={department}
                    active={activeDept === department}
                    onClick={() => {
                      setActiveDept(department)
                      setCurrentPage(1)
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="inline-flex items-center gap-2 text-sm">
                <IconMapPin className="size-4 text-primary" />
                Locations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pb-4">
              <FilterListButton
                label="All Locations"
                active={!activeBranch}
                onClick={() => {
                  setActiveBranch(null)
                  setCurrentPage(1)
                }}
              />
              <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                {branches.map((branch) => (
                  <FilterListButton
                    key={branch}
                    label={branch}
                    active={activeBranch === branch}
                    onClick={() => {
                      setActiveBranch(branch)
                      setCurrentPage(1)
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="inline-flex items-center gap-2 text-sm">
                <IconShield className="size-4 text-primary" />
                Employment Status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 pb-4">
              <Button
                type="button"
                size="sm"
                variant={!activeStatus ? "default" : "outline"}
                onClick={() => {
                  setActiveStatus(null)
                  setCurrentPage(1)
                }}
                className="h-7"
              >
                All
              </Button>
              {statuses.map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={activeStatus === status ? "default" : "outline"}
                  onClick={() => {
                    setActiveStatus(status)
                    setCurrentPage(1)
                  }}
                  className="h-7"
                >
                  {status}
                </Button>
              ))}
            </CardContent>
          </Card>
        </aside>

        <Card className="border-border/70 py-0">
          <CardHeader className="border-b border-border/60 pb-2.5 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <CardTitle className="text-sm">Employee Masterlist</CardTitle>
                <CardDescription className="text-xs">
                  Page {safeCurrentPage} of {totalPages} • {totalCount} matching records
                </CardDescription>
              </div>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                {showFilter === "active" ? "Active only" : showFilter === "inactive" ? "Inactive only" : "All statuses"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="sticky top-0 z-10 border-b border-border/60 bg-muted/20">
              <div className={cn("grid h-10 items-center gap-5 px-6 text-xs font-medium uppercase tracking-wide text-muted-foreground", MASTERLIST_GRID_COLUMNS)}>
                <SortHeader
                  label="Employee Name"
                  active={sortColumn === "name"}
                  direction={sortDirection}
                  onClick={() => toggleSort("name")}
                  className=""
                />
                <div>Position</div>
                <SortHeader
                  label="Department"
                  active={sortColumn === "department"}
                  direction={sortDirection}
                  onClick={() => toggleSort("department")}
                  className=""
                />
                <SortHeader
                  label="Status"
                  active={sortColumn === "status"}
                  direction={sortDirection}
                  onClick={() => toggleSort("status")}
                  className=""
                />
                <div className="text-right">Actions</div>
              </div>
            </div>

            <div className="flex-1 divide-y divide-border/60 bg-background">
              {paginatedEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-28 text-center">
                  <div className="rounded-md border border-border/60 bg-muted/20 p-4">
                    <IconSearch className="size-8 text-muted-foreground/70" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">No records found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria.</p>
                  </div>
                </div>
              ) : (
                paginatedEmployees.map((employee) => (
                  <div key={employee.id} className={cn("group grid items-center gap-5 px-6 py-3.5 transition-colors hover:bg-muted/10", MASTERLIST_GRID_COLUMNS)}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0 border border-border/60">
                        <AvatarImage src={employee.photoUrl ?? undefined} alt={employee.firstName} className="object-cover" />
                        <AvatarFallback className="bg-primary/5 text-[13px] font-semibold text-primary">
                          {employee.firstName[0]}
                          {employee.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {employee.lastName}, {employee.firstName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{employee.employeeNumber}</p>
                      </div>
                    </div>

                    <div>
                      <p className="truncate text-sm text-foreground/90">{employee.position}</p>
                      <p className="truncate text-xs text-muted-foreground">{employee.branch}</p>
                    </div>

                    <div>
                      <p className="truncate text-xs text-muted-foreground">{employee.department}</p>
                    </div>

                    <div>
                      <Badge variant={employee.isActive ? "default" : "secondary"}>
                        {employee.isActive ? <IconCheck className="mr-1 size-3.5" /> : <IconX className="mr-1 size-3.5" />}
                        {employee.isActive ? employee.employmentStatus : "INACTIVE"}
                      </Badge>
                    </div>

                    <div className="flex justify-end">
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button asChild variant="outline" size="sm" className="h-7 gap-1 border-border/70">
                              <Link
                                href={{
                                  pathname: `/${companyId}/employees/${employee.id}`,
                                  query: { page: String(safeCurrentPage) },
                                }}
                              >
                                <IconEye className="size-3.5" />
                                View Profile
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6}>
                            View Profile
                          </TooltipContent>
                        </Tooltip>
                        {canDeleteEmployees ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  setDeleteTarget({
                                    id: employee.id,
                                    employeeNumber: employee.employeeNumber,
                                    fullName: employee.fullName,
                                    isActive: employee.isActive,
                                  })
                                }
                                aria-label={`Delete ${employee.fullName}`}
                              >
                                <IconTrash className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={6}>
                              Delete Employee
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {totalCount > 0 ? (
              <>
                <Separator />
                <div className="flex h-11 items-center justify-between px-6">
                  <div className="text-xs text-muted-foreground">
                    Page {safeCurrentPage} of {totalPages} • {totalCount} Employees
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 border-border/70"
                      disabled={safeCurrentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 border-border/70"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="inline-flex items-center gap-2">
              <IconAlertTriangle className="size-4 text-destructive" />
              Delete Employee Record
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-medium text-foreground">{deleteTarget?.fullName}</span> (
              {deleteTarget?.employeeNumber}) from the active employee masterlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                handleConfirmDelete()
              }}
            >
              {isDeletePending ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
  className,
}: {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
  className: string
}) {
  return (
    <button onClick={onClick} className={cn(className, "flex items-center gap-2 text-left transition-colors hover:text-primary")}>
      <span>{label}</span>
      {active ? direction === "asc" ? <IconChevronUp className="size-3" /> : <IconChevronDown className="size-3" /> : <IconChevronsUp className="size-3 opacity-60" />}
    </button>
  )
}

function VisibilityButton({
  value,
  activeValue,
  onSelect,
  label,
}: {
  value: "active" | "all" | "inactive"
  activeValue: "active" | "all" | "inactive"
  onSelect: (value: "active" | "all" | "inactive") => void
  label: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      className="h-7"
      variant={activeValue === value ? "default" : "outline"}
      onClick={() => onSelect(value)}
    >
      {label}
    </Button>
  )
}

function FilterListButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full truncate border px-2.5 py-1.5 text-left text-xs transition-colors",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}

function sortRows(a: EmployeeMasterlistRow, b: EmployeeMasterlistRow, column: SortColumn, direction: SortDirection): number {
  const factor = direction === "asc" ? 1 : -1

  if (column === "employeeNumber") {
    return a.employeeNumber.localeCompare(b.employeeNumber) * factor
  }

  if (column === "department") {
    return a.department.localeCompare(b.department) * factor
  }

  if (column === "status") {
    const aStatus = a.isActive ? a.employmentStatus : "INACTIVE"
    const bStatus = b.isActive ? b.employmentStatus : "INACTIVE"
    return aStatus.localeCompare(bStatus) * factor
  }

  return a.fullName.localeCompare(b.fullName) * factor
}
