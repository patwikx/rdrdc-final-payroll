"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
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
import { Input } from "@/components/ui/input"
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
  const [isPending, startTransition] = useTransition()
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

    startTransition(async () => {
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
            startTransition(async () => {
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
    <div className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <div className="flex flex-col justify-between gap-6 border-b border-border/60 px-8 pb-8 pt-8 md:flex-row md:items-end">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Human Resources</p>
          <div className="flex items-center gap-4">
            <h1 className="inline-flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground"><IconUsers className="h-7 w-7" /> Employee Directory</h1>
            <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">{companyName}</div>
            <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">{totalCount} Visible</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="border-border/60 hover:bg-muted/50"
            onClick={() => toast.info("Export action will be wired in a follow-up pass.")}
          >
            <IconFileExport className="h-3.5 w-3.5" /> Export
          </Button>
          <Button
            variant="outline"
            className="border-border/60 hover:bg-muted/50"
            onClick={() => toast.info("Advanced search UI mirrors reference; API wiring can be added next.")}
          >
            <IconFilter className="h-3.5 w-3.5" /> Advanced Search
          </Button>
          <Button
            variant="outline"
            className="border-border/60 hover:bg-muted/50"
            onClick={() => toast.info("Bulk email action is not yet wired for this module path.")}
          >
            <IconMail className="h-3.5 w-3.5" /> Email Filtered
          </Button>
          <Link href={`/${companyId}/employees/onboarding`}>
            <Button className="px-6">
              <IconPlus className="h-3.5 w-3.5" /> New Employee
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-180px)] flex-col lg:flex-row">
        <aside className="w-full shrink-0 space-y-8 border-r border-border/60 bg-background/50 p-6 backdrop-blur-sm lg:w-72">
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">Find Employee</h3>
            <div className="group relative">
              <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Search by name or ID"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setCurrentPage(1)
                }}
                className="border-border/60 bg-muted/20 pl-9"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IconBuilding className="h-3 w-3" /> Departments
            </h3>
            <div className="ml-1.5 flex flex-col gap-px border-l border-border/60 pl-3">
              <button
                type="button"
                onClick={() => {
                  setActiveDept(null)
                  setCurrentPage(1)
                }}
                className={cn(
                  "py-1.5 text-left text-xs transition-all hover:text-primary",
                  !activeDept ? "-ml-[14px] border-l-2 border-primary pl-2 text-primary" : "text-muted-foreground"
                )}
              >
                All Departments
              </button>
              {departments.map((department) => (
                <button
                  key={department}
                  type="button"
                  onClick={() => {
                    setActiveDept(department)
                    setCurrentPage(1)
                  }}
                  className={cn(
                    "truncate py-1.5 text-left text-xs transition-all hover:text-primary",
                    activeDept === department ? "-ml-[14px] border-l-2 border-primary pl-2 text-primary" : "text-muted-foreground"
                  )}
                >
                  {department}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IconMapPin className="h-3 w-3" /> Locations
            </h3>
            <div className="ml-1.5 flex flex-col gap-px border-l border-border/60 pl-3">
              <button
                type="button"
                onClick={() => {
                  setActiveBranch(null)
                  setCurrentPage(1)
                }}
                className={cn(
                  "py-1.5 text-left text-xs transition-all hover:text-primary",
                  !activeBranch ? "-ml-[14px] border-l-2 border-primary pl-2 text-primary" : "text-muted-foreground"
                )}
              >
                All Locations
              </button>
              {branches.map((branch) => (
                <button
                  key={branch}
                  type="button"
                  onClick={() => {
                    setActiveBranch(branch)
                    setCurrentPage(1)
                  }}
                  className={cn(
                    "truncate py-1.5 text-left text-xs transition-all hover:text-primary",
                    activeBranch === branch ? "-ml-[14px] border-l-2 border-primary pl-2 text-primary" : "text-muted-foreground"
                  )}
                >
                  {branch}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IconShield className="h-3 w-3" /> Status
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={!activeStatus ? "default" : "outline"}
                onClick={() => {
                  setActiveStatus(null)
                  setCurrentPage(1)
                }}
              >
                ALL
              </Button>
              {statuses.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={activeStatus === status ? "default" : "outline"}
                  onClick={() => {
                    setActiveStatus(status)
                    setCurrentPage(1)
                  }}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">Visibility</h3>
            <div className="flex flex-wrap gap-2">
              <VisibilityButton value="active" activeValue={showFilter} onSelect={setShowFilter} label="Active Only" />
              <VisibilityButton value="all" activeValue={showFilter} onSelect={setShowFilter} label="Include Inactive" />
              <VisibilityButton value="inactive" activeValue={showFilter} onSelect={setShowFilter} label="Inactive Only" />
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col bg-background p-0">
          <div className="sticky top-0 z-10 border-b border-border/60 bg-muted/10">
            <div className={cn("grid h-10 items-center gap-5 px-8 text-xs font-medium uppercase tracking-wide text-muted-foreground", MASTERLIST_GRID_COLUMNS)}>
              <SortHeader label="Employee Name" active={sortColumn === "name"} direction={sortDirection} onClick={() => toggleSort("name")} className="" />
              <div>Position</div>
              <SortHeader label="Department" active={sortColumn === "department"} direction={sortDirection} onClick={() => toggleSort("department")} className="" />
              <SortHeader label="Status" active={sortColumn === "status"} direction={sortDirection} onClick={() => toggleSort("status")} className="" />
              <div className="text-right">Actions</div>
            </div>
          </div>

          <div className="flex-1 divide-y divide-border/60 bg-background">
            {paginatedEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
                <div className="rounded-md border border-border/60 bg-muted/20 p-4">
                  <IconSearch className="h-8 w-8 text-muted-foreground/70" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No records found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria.</p>
                </div>
              </div>
            ) : (
              paginatedEmployees.map((employee) => (
                <div key={employee.id} className={cn("group grid items-center gap-5 px-8 py-4 transition-colors hover:bg-muted/5", MASTERLIST_GRID_COLUMNS)}>
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
                    <p className="truncate text-sm font-medium text-foreground/80">{employee.position}</p>
                    <p className="truncate text-xs text-muted-foreground">{employee.branch}</p>
                  </div>

                  <div>
                    <p className="truncate text-xs text-muted-foreground">{employee.department}</p>
                  </div>

                  <div>
                    <Badge variant={employee.isActive ? "default" : "secondary"}>
                      {employee.isActive ? employee.employmentStatus : "INACTIVE"}
                    </Badge>
                  </div>

                  <div className="flex justify-end">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button asChild variant="outline" size="sm" className="gap-1 border-border/60">
                            <Link
                              href={{
                                pathname: `/${companyId}/employees/${employee.id}`,
                                query: { page: String(safeCurrentPage) },
                              }}
                            >
                              <IconEye className="h-3.5 w-3.5" />
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
                              <IconTrash className="h-3.5 w-3.5" />
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
            <div className="sticky bottom-0 flex h-12 items-center justify-between border-t border-border/60 bg-background px-8">
              <div className="text-xs text-muted-foreground">
                Page {safeCurrentPage} of {totalPages} • {totalCount} Employees
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="border-border/60 hover:bg-muted/50 disabled:opacity-30"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className="border-border/60 hover:bg-muted/50 disabled:opacity-30"
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="inline-flex items-center gap-2">
              <IconAlertTriangle className="h-4 w-4 text-destructive" />
              Delete Employee Record
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-medium text-foreground">{deleteTarget?.fullName}</span> (
              {deleteTarget?.employeeNumber}) from the active employee masterlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                handleConfirmDelete()
              }}
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
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
      {active ? direction === "asc" ? <IconChevronUp className="h-3 w-3" /> : <IconChevronDown className="h-3 w-3" /> : <IconChevronsUp className="h-3 w-3 opacity-60" />}
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
      variant={activeValue === value ? "default" : "outline"}
      onClick={() => onSelect(value)}
    >
      {label}
    </Button>
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
