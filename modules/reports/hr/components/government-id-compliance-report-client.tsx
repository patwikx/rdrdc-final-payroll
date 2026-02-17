"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
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
  GovernmentIdComplianceRow,
  GovernmentIdComplianceScope,
} from "@/modules/reports/hr/utils/get-government-id-compliance-view-model"

const TABLE_PAGE_SIZE = 10

type GovernmentIdComplianceReportClientProps = {
  companyId: string
  companyName: string
  asOfDateValue: string
  generatedAtLabel: string
  filters: {
    departmentId: string
    includeInactive: boolean
    complianceScope: GovernmentIdComplianceScope
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  summary: {
    totalEmployees: number
    compliantCount: number
    incompleteCount: number
    missingAnyCount: number
    qualityIssueCount: number
    averageCompletionRate: number
  }
  rows: GovernmentIdComplianceRow[]
}

const numberFormatter = new Intl.NumberFormat("en-PH")
const decimalFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const idStatusTone: Record<
  "VALID" | "MISSING" | "LOW_QUALITY",
  {
    label: string
    className: string
  }
> = {
  VALID: {
    label: "VALID",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  MISSING: {
    label: "MISSING",
    className: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  LOW_QUALITY: {
    label: "LOW QUALITY",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
}

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

function IdStatusCell({
  status,
  value,
}: {
  status: "VALID" | "MISSING" | "LOW_QUALITY"
  value: string | null
}) {
  const tone = idStatusTone[status]
  return (
    <div className="space-y-1">
      <Badge variant="outline" className={cn("h-6 px-2 text-[11px]", tone.className)}>
        {tone.label}
      </Badge>
      <p className="text-[11px] text-muted-foreground">{value ?? "-"}</p>
    </div>
  )
}

export function GovernmentIdComplianceReportClient({
  companyId,
  companyName,
  asOfDateValue,
  generatedAtLabel,
  filters,
  options,
  summary,
  rows,
}: GovernmentIdComplianceReportClientProps) {
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
    if (filters.complianceScope !== "all") params.set("complianceScope", filters.complianceScope)
    return `/${companyId}/reports/hr/government-id-compliance/export?${params.toString()}`
  }, [companyId, filters.complianceScope, filters.departmentId, filters.includeInactive])

  const printHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.departmentId) params.set("departmentId", filters.departmentId)
    if (filters.includeInactive) params.set("includeInactive", "true")
    if (filters.complianceScope !== "all") params.set("complianceScope", filters.complianceScope)
    return `/${companyId}/reports/hr/government-id-compliance/print?${params.toString()}`
  }, [companyId, filters.complianceScope, filters.departmentId, filters.includeInactive])

  const updateRoute = (updates: {
    departmentId?: string
    includeInactive?: boolean
    complianceScope?: GovernmentIdComplianceScope
  }) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    const nextDepartmentId = updates.departmentId ?? filters.departmentId
    const nextIncludeInactive = updates.includeInactive ?? filters.includeInactive
    const nextComplianceScope = updates.complianceScope ?? filters.complianceScope

    if (nextDepartmentId) nextParams.set("departmentId", nextDepartmentId)
    else nextParams.delete("departmentId")

    if (nextIncludeInactive) nextParams.set("includeInactive", "true")
    else nextParams.delete("includeInactive")

    if (nextComplianceScope !== "all") nextParams.set("complianceScope", nextComplianceScope)
    else nextParams.delete("complianceScope")

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
                  <IconChecklist className="size-6 text-primary sm:size-7" />
                  Government ID Compliance
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {companyName}
                </Badge>
                <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                  As of {asOfDateValue}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Required TIN, SSS, PhilHealth, and Pag-IBIG coverage with per-employee ID quality checks. Generated:{" "}
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
              icon={IconCheck}
              label="Compliant"
              value={numberFormatter.format(summary.compliantCount)}
              valueClassName="text-emerald-700 dark:text-emerald-300"
            />
            <MetricCard
              icon={IconAlertTriangle}
              label="Incomplete"
              value={numberFormatter.format(summary.incompleteCount)}
              valueClassName="text-amber-700 dark:text-amber-300"
            />
            <MetricCard
              icon={IconAlertTriangle}
              label="Missing Any ID"
              value={numberFormatter.format(summary.missingAnyCount)}
              valueClassName="text-rose-700 dark:text-rose-300"
            />
            <MetricCard
              icon={IconFileAnalytics}
              label="Avg Completion"
              value={`${decimalFormatter.format(summary.averageCompletionRate)}%`}
            />
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

              <div className="w-full space-y-1 sm:w-[250px]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Compliance Scope</p>
                <Select
                  value={filters.complianceScope}
                  onValueChange={(value) => {
                    updateRoute({ complianceScope: value as GovernmentIdComplianceScope })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All records</SelectItem>
                    <SelectItem value="compliant">Compliant only</SelectItem>
                    <SelectItem value="incomplete">Incomplete only</SelectItem>
                    <SelectItem value="missing-any">Missing any required ID</SelectItem>
                    <SelectItem value="quality-issues">Low-quality values</SelectItem>
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
                      complianceScope: "all",
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
                    <TableHead>TIN</TableHead>
                    <TableHead>SSS</TableHead>
                    <TableHead>PhilHealth</TableHead>
                    <TableHead>Pag-IBIG</TableHead>
                    <TableHead className="text-right">Completion</TableHead>
                    <TableHead>Missing Required IDs</TableHead>
                    <TableHead>Quality Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
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
                        <TableCell>
                          <IdStatusCell status={row.tinStatus} value={row.tinValue} />
                        </TableCell>
                        <TableCell>
                          <IdStatusCell status={row.sssStatus} value={row.sssValue} />
                        </TableCell>
                        <TableCell>
                          <IdStatusCell status={row.philHealthStatus} value={row.philHealthValue} />
                        </TableCell>
                        <TableCell>
                          <IdStatusCell status={row.pagIbigStatus} value={row.pagIbigValue} />
                        </TableCell>
                        <TableCell className="text-right font-medium">{decimalFormatter.format(row.completionRate)}%</TableCell>
                        <TableCell className="max-w-[280px] whitespace-normal break-words text-[11px] leading-4">
                          {row.missingIdLabels.length > 0 ? row.missingIdLabels.join(", ") : "-"}
                        </TableCell>
                        <TableCell className="max-w-[280px] whitespace-normal break-words text-[11px] leading-4">
                          {row.qualityIssueLabels.length > 0 ? (
                            <span className="text-amber-700 dark:text-amber-300">{row.qualityIssueLabels.join(", ")}</span>
                          ) : (
                            "-"
                          )}
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
