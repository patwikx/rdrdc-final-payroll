"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendarEvent,
  IconChecklist,
  IconDownload,
  IconFileAnalytics,
  IconPrinter,
  IconRefresh,
  IconUsers,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type {
  EmploymentMilestoneScope,
  EmploymentMilestonesRow,
} from "@/modules/reports/hr/utils/get-employment-milestones-view-model"

const TABLE_PAGE_SIZE = 10

type EmploymentMilestonesReportClientProps = {
  companyId: string
  companyName: string
  asOfDateValue: string
  generatedAtLabel: string
  filters: {
    departmentId: string
    includeInactive: boolean
    milestoneScope: EmploymentMilestoneScope
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  summary: {
    totalEmployees: number
    dueTodayCount: number
    upcoming30Count: number
    overdueCount: number
    withoutMilestoneCount: number
  }
  rows: EmploymentMilestonesRow[]
}

const numberFormatter = new Intl.NumberFormat("en-PH")

function MetricCard({
  label,
  value,
  icon: Icon,
  valueClassName,
}: {
  label: string
  value: string
  icon: typeof IconUsers
  valueClassName?: string
}) {
  return (
    <div className="rounded-md border border-border/70 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary/80" />
      </div>
      <p className={cn("mt-1 text-lg font-semibold tracking-tight text-foreground", valueClassName)}>{value}</p>
    </div>
  )
}

export function EmploymentMilestonesReportClient({
  companyId,
  companyName,
  asOfDateValue,
  generatedAtLabel,
  filters,
  options,
  summary,
  rows,
}: EmploymentMilestonesReportClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * TABLE_PAGE_SIZE
  const pagedRows = rows.slice(pageStart, pageStart + TABLE_PAGE_SIZE)

  const exportHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.departmentId) params.set("departmentId", filters.departmentId)
    if (filters.includeInactive) params.set("includeInactive", "true")
    if (filters.milestoneScope !== "all") params.set("milestoneScope", filters.milestoneScope)
    return `/${companyId}/reports/hr/employment-milestones/export?${params.toString()}`
  }, [companyId, filters.departmentId, filters.includeInactive, filters.milestoneScope])

  const printHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.departmentId) params.set("departmentId", filters.departmentId)
    if (filters.includeInactive) params.set("includeInactive", "true")
    if (filters.milestoneScope !== "all") params.set("milestoneScope", filters.milestoneScope)
    return `/${companyId}/reports/hr/employment-milestones/print?${params.toString()}`
  }, [companyId, filters.departmentId, filters.includeInactive, filters.milestoneScope])

  const updateRoute = (updates: {
    departmentId?: string
    includeInactive?: boolean
    milestoneScope?: EmploymentMilestoneScope
  }) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    const nextDepartmentId = updates.departmentId ?? filters.departmentId
    const nextIncludeInactive = updates.includeInactive ?? filters.includeInactive
    const nextMilestoneScope = updates.milestoneScope ?? filters.milestoneScope

    if (nextDepartmentId) nextParams.set("departmentId", nextDepartmentId)
    else nextParams.delete("departmentId")

    if (nextIncludeInactive) nextParams.set("includeInactive", "true")
    else nextParams.delete("includeInactive")

    if (nextMilestoneScope !== "all") nextParams.set("milestoneScope", nextMilestoneScope)
    else nextParams.delete("milestoneScope")

    startTransition(() => {
      const query = nextParams.toString()
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname)
      setPage(1)
    })
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20">
        <div className="pointer-events-none absolute -right-24 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-8 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />

        <section className="relative w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Reports</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  <IconCalendarEvent className="size-6 text-primary sm:size-7" />
                  Employment Milestones
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {companyName}
                </Badge>
                <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                  As of {asOfDateValue}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Milestone tracking for probation, regularization, contract end, and separation planning. Generated:{" "}
                {generatedAtLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" type="button" size="sm" className="h-8 border-border/70">
                <Link href={`/${companyId}/reports/payroll`}>
                  <IconArrowLeft className="mr-1.5 h-4 w-4" />
                  Back to Payroll Reports
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </header>

      <section className="w-full py-4">
        <div className="border-y border-border/70 bg-background">
          <div className="grid gap-2 border-b border-border/60 px-4 py-3 sm:px-6 lg:grid-cols-2 xl:grid-cols-5 lg:px-8">
            <MetricCard icon={IconUsers} label="Employees" value={numberFormatter.format(summary.totalEmployees)} />
            <MetricCard
              icon={IconCalendarEvent}
              label="Due Today"
              value={numberFormatter.format(summary.dueTodayCount)}
              valueClassName="text-blue-700 dark:text-blue-300"
            />
            <MetricCard
              icon={IconChecklist}
              label="Upcoming 30 Days"
              value={numberFormatter.format(summary.upcoming30Count)}
              valueClassName="text-emerald-700 dark:text-emerald-300"
            />
            <MetricCard
              icon={IconAlertTriangle}
              label="Overdue"
              value={numberFormatter.format(summary.overdueCount)}
              valueClassName="text-amber-700 dark:text-amber-300"
            />
            <MetricCard icon={IconFileAnalytics} label="No Milestone Date" value={numberFormatter.format(summary.withoutMilestoneCount)} />
          </div>

          <section className="space-y-3 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full space-y-1 sm:w-[240px]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Department</p>
                <Select
                  value={filters.departmentId || "__ALL__"}
                  onValueChange={(value) => {
                    updateRoute({ departmentId: value === "__ALL__" ? "" : value })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">All departments</SelectItem>
                    {options.departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full space-y-1 sm:w-[230px]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Milestone Scope</p>
                <Select
                  value={filters.milestoneScope}
                  onValueChange={(value) => {
                    updateRoute({ milestoneScope: value as EmploymentMilestoneScope })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All milestones</SelectItem>
                    <SelectItem value="upcoming-30">Upcoming in 30 days</SelectItem>
                    <SelectItem value="upcoming-60">Upcoming in 60 days</SelectItem>
                    <SelectItem value="upcoming-90">Upcoming in 90 days</SelectItem>
                    <SelectItem value="overdue">Overdue only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full space-y-1 sm:w-auto">
                <p className="invisible text-[10px] font-medium uppercase tracking-wide">Action</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    updateRoute({
                      departmentId: "",
                      includeInactive: false,
                      milestoneScope: "all",
                    })
                  }}
                >
                  <IconRefresh className="mr-1.5 h-4 w-4" />
                  Reset
                </Button>
              </div>

              <div className="ml-auto flex w-full items-end gap-2 sm:w-auto">
                <Button asChild type="button" className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
                  <Link href={printHref} target="_blank" rel="noopener noreferrer">
                    <IconPrinter className="mr-1.5 h-4 w-4" />
                    Print
                  </Link>
                </Button>
                <Button asChild type="button" className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto">
                  <Link href={exportHref}>
                    <IconDownload className="mr-1.5 h-4 w-4" />
                    Export CSV
                  </Link>
                </Button>
              </div>

              {isPending ? <p className="pb-1 text-xs text-muted-foreground">Loading report...</p> : null}
            </div>

            <div className="w-full overflow-x-auto">
              <Table className="w-full table-fixed border border-border/60 text-xs [&_th]:whitespace-normal [&_th]:border [&_th]:border-border/60 [&_td]:align-top [&_td]:whitespace-normal [&_td]:break-words [&_td]:border [&_td]:border-border/60">
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hire Date</TableHead>
                    <TableHead>Probation End</TableHead>
                    <TableHead>Regularization</TableHead>
                    <TableHead>Contract End</TableHead>
                    <TableHead>Separation Date</TableHead>
                    <TableHead>Last Working Day</TableHead>
                    <TableHead>Next Milestone</TableHead>
                    <TableHead className="text-right">Days to Next</TableHead>
                    <TableHead>Overdue Milestones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No employee rows found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedRows.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell>
                          <p className="font-medium text-foreground">{row.employeeName}</p>
                          <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                        </TableCell>
                        <TableCell>{row.departmentName ?? "UNASSIGNED"}</TableCell>
                        <TableCell>
                          <Badge variant={row.isActive ? "secondary" : "outline"} className="h-6 px-2 text-[11px]">
                            {row.isActive ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.hireDateValue}</TableCell>
                        <TableCell>{row.probationEndDateValue ?? "-"}</TableCell>
                        <TableCell>{row.regularizationDateValue ?? "-"}</TableCell>
                        <TableCell>{row.contractEndDateValue ?? "-"}</TableCell>
                        <TableCell>{row.separationDateValue ?? "-"}</TableCell>
                        <TableCell>{row.lastWorkingDayValue ?? "-"}</TableCell>
                        <TableCell>
                          {row.nextMilestoneLabel && row.nextMilestoneDateValue
                            ? `${row.nextMilestoneLabel} (${row.nextMilestoneDateValue})`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.daysToNextMilestone === null ? "-" : row.daysToNextMilestone}
                        </TableCell>
                        <TableCell className="max-w-[260px] whitespace-normal break-words text-[11px] leading-4">
                          {row.overdueMilestonesLabel}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs">
              <p className="text-muted-foreground">
                Showing {rows.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + TABLE_PAGE_SIZE, rows.length)} of{" "}
                {rows.length} records • Page {safePage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={safePage <= 1}
                  onClick={() => setPage((previous) => Math.max(Math.min(previous, totalPages) - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((previous) => Math.min(Math.min(previous, totalPages) + 1, totalPages))}
                >
                  Next
                </Button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
