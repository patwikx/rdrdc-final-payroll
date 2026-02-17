"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import type { ComponentType, ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconArrowLeft,
  IconClockHour4,
  IconDownload,
  IconFileAnalytics,
  IconFilter,
  IconPrinter,
  IconRefresh,
  IconUserCheck,
  IconUserX,
  IconUsers,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { DemographicBreakdownRow, DemographicEmployeeRow } from "@/modules/reports/payroll/types/report-view-models"

type DemographicReportClientProps = {
  companyId: string
  companyName: string
  generatedAtLabel: string
  asOfDateValue: string
  totalEmployees: number
  activeEmployees: number
  inactiveEmployees: number
  averageAgeYears: number | null
  filters: {
    departmentId: string
    includeInactive: boolean
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  breakdowns: {
    byGender: DemographicBreakdownRow[]
    byCivilStatus: DemographicBreakdownRow[]
    byEmploymentStatus: DemographicBreakdownRow[]
    byEmploymentType: DemographicBreakdownRow[]
    byEmploymentClass: DemographicBreakdownRow[]
    byDepartment: DemographicBreakdownRow[]
    byBranch: DemographicBreakdownRow[]
    byAgeBracket: DemographicBreakdownRow[]
  }
  employees: DemographicEmployeeRow[]
}

const countFormatter = new Intl.NumberFormat("en-PH")
const decimalFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type DemographicColumnKey =
  | "employee"
  | "department"
  | "branch"
  | "gender"
  | "civilStatus"
  | "employmentStatus"
  | "hireDate"
  | "age"
  | "address"
  | "contactNumbers"
  | "emergencyContact"
  | "emergencyContactNumber"
  | "education"

type DemographicColumnDefinition = {
  key: DemographicColumnKey
  label: string
  align?: "left" | "right"
  cellClassName?: string
  renderCell: (row: DemographicEmployeeRow) => ReactNode
}

const DEMOGRAPHIC_COLUMNS: DemographicColumnDefinition[] = [
  {
    key: "employee",
    label: "Employee",
    renderCell: (row) => (
      <>
        <p className="font-medium text-foreground">{row.employeeName}</p>
        <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
      </>
    ),
  },
  {
    key: "department",
    label: "Department",
    renderCell: (row) => row.departmentName ?? "UNASSIGNED",
  },
  {
    key: "branch",
    label: "Branch",
    renderCell: (row) => row.branchName ?? "UNASSIGNED",
  },
  {
    key: "gender",
    label: "Gender",
    renderCell: (row) => row.genderLabel,
  },
  {
    key: "civilStatus",
    label: "Civil Status",
    renderCell: (row) => row.civilStatusLabel,
  },
  {
    key: "employmentStatus",
    label: "Employment Status",
    renderCell: (row) => row.employmentStatusName,
  },
  {
    key: "hireDate",
    label: "Hire Date",
    renderCell: (row) => row.hireDateValue,
  },
  {
    key: "age",
    label: "Age",
    align: "right",
    renderCell: (row) => row.ageYears ?? "-",
  },
  {
    key: "address",
    label: "Address",
    cellClassName: "whitespace-pre-line",
    renderCell: (row) => row.addressLabel,
  },
  {
    key: "contactNumbers",
    label: "Contact Number(s)",
    cellClassName: "whitespace-pre-line",
    renderCell: (row) => row.contactNumbersLabel,
  },
  {
    key: "emergencyContact",
    label: "Emergency Contact",
    cellClassName: "whitespace-pre-line",
    renderCell: (row) => row.emergencyContactName,
  },
  {
    key: "emergencyContactNumber",
    label: "Emergency Contact Number",
    cellClassName: "whitespace-pre-line",
    renderCell: (row) => row.emergencyContactNumber,
  },
  {
    key: "education",
    label: "Education",
    cellClassName: "whitespace-pre-line",
    renderCell: (row) => row.educationLabel,
  },
]

const SnapshotMetric = ({
  icon: Icon,
  label,
  value,
  accentClassName,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  accentClassName?: string
}) => {
  return (
    <div className="rounded-md border border-border/70 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary/80" />
      </div>
      <p className={cn("mt-1 text-lg font-semibold tracking-tight text-foreground", accentClassName)}>{value}</p>
    </div>
  )
}

export function DemographicReportClient({
  companyId,
  companyName,
  generatedAtLabel,
  asOfDateValue,
  totalEmployees,
  activeEmployees,
  inactiveEmployees,
  averageAgeYears,
  filters,
  options,
  employees,
}: DemographicReportClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<DemographicColumnKey[]>(() =>
    DEMOGRAPHIC_COLUMNS.map((column) => column.key)
  )

  const visibleColumns = useMemo(() => {
    const selectedKeys = new Set(visibleColumnKeys)
    return DEMOGRAPHIC_COLUMNS.filter((column) => selectedKeys.has(column.key))
  }, [visibleColumnKeys])

  const visibleColumnCount = Math.max(visibleColumns.length, 1)

  const exportHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.departmentId) params.set("departmentId", filters.departmentId)
    if (filters.includeInactive) params.set("includeInactive", "true")
    return `/${companyId}/reports/payroll/demographics/export?${params.toString()}`
  }, [companyId, filters.departmentId, filters.includeInactive])

  const printHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.departmentId) params.set("departmentId", filters.departmentId)
    if (filters.includeInactive) params.set("includeInactive", "true")
    params.set("columns", visibleColumnKeys.join(","))
    return `/${companyId}/reports/payroll/demographics/print?${params.toString()}`
  }, [companyId, filters.departmentId, filters.includeInactive, visibleColumnKeys])

  const updateRoute = (updates: {
    departmentId?: string
  }) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    const nextDepartmentId = updates.departmentId ?? filters.departmentId

    if (nextDepartmentId) nextParams.set("departmentId", nextDepartmentId)
    else nextParams.delete("departmentId")

    if (filters.includeInactive) nextParams.set("includeInactive", "true")
    else nextParams.delete("includeInactive")

    startTransition(() => {
      const query = nextParams.toString()
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname)
    })
  }

  const toggleColumnVisibility = (key: DemographicColumnKey) => {
    setVisibleColumnKeys((current) => {
      const isSelected = current.includes(key)
      if (isSelected) {
        if (current.length === 1) return current
        return current.filter((columnKey) => columnKey !== key)
      }

      const keySet = new Set(current)
      return DEMOGRAPHIC_COLUMNS.filter((column) => keySet.has(column.key) || column.key === key).map(
        (column) => column.key
      )
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
              <p className="text-xs text-muted-foreground">Payroll Reports</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  <IconFileAnalytics className="size-6 text-primary sm:size-7" />
                  Demographic Report
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {companyName}
                </Badge>
                <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                  As of {asOfDateValue}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Workforce segmentation and distribution metrics. Generated: {generatedAtLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" type="button" size="sm" className="h-8 border-border/70">
                <Link href={`/${companyId}/reports/payroll`}>
                  <IconArrowLeft className="mr-1.5 h-4 w-4" />
                  Back to Payroll Reports
                </Link>
              </Button>
              <Button asChild className="h-8 bg-blue-600 text-white hover:bg-blue-700" size="sm">
                <Link href={printHref} target="_blank" rel="noopener noreferrer">
                  <IconPrinter className="mr-1.5 h-4 w-4" />
                  Print Report
                </Link>
              </Button>
              <Button asChild className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" size="sm">
                <Link href={exportHref}>
                  <IconDownload className="mr-1.5 h-4 w-4" />
                  Export CSV
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </header>

      <section className="w-full py-4">
        <div className="border-y border-border/70 bg-background">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 pb-3 pt-2 sm:px-6 lg:px-8">
            <div>
              <h2 className="text-base font-semibold">Employee Roster</h2>
              <p className="text-xs text-muted-foreground">
                Workforce summary and employee-level details for quick audit and export cross-checks.
              </p>
            </div>
            <Badge variant="outline" className="rounded-sm px-2 text-[11px]">
              {countFormatter.format(employees.length)} records
            </Badge>
          </div>

          <div className="space-y-4 border-b border-border/60 px-4 py-4 sm:px-6 lg:px-8">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <SnapshotMetric
                icon={IconUsers}
                label="Total Employees"
                value={countFormatter.format(totalEmployees)}
              />
              <SnapshotMetric
                icon={IconUserCheck}
                label="Active"
                value={countFormatter.format(activeEmployees)}
                accentClassName="text-emerald-700 dark:text-emerald-300"
              />
              <SnapshotMetric
                icon={IconUserX}
                label="Inactive"
                value={countFormatter.format(inactiveEmployees)}
                accentClassName="text-amber-700 dark:text-amber-300"
              />
              <SnapshotMetric
                icon={IconClockHour4}
                label="Average Age"
                value={averageAgeYears === null ? "-" : decimalFormatter.format(averageAgeYears)}
              />
            </div>
          </div>

          <div className="p-0">
            <div className="overflow-x-hidden">
              <table className="w-full table-fixed border-collapse text-xs">
                <thead className="bg-muted/30">
                  <tr className="bg-background">
                    <th colSpan={visibleColumnCount} className="border-b border-border px-2 pb-2 pt-0">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1 pt-1 text-left">
                          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Columns
                          </p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" className="h-8 min-w-[170px] justify-between">
                                <span className="inline-flex items-center gap-1.5">
                                  <IconFilter className="h-3.5 w-3.5" />
                                  {visibleColumns.length === DEMOGRAPHIC_COLUMNS.length
                                    ? "All columns"
                                    : `${visibleColumns.length} columns`}
                                </span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52">
                              <DropdownMenuLabel>Select Columns</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {DEMOGRAPHIC_COLUMNS.map((column) => (
                                <DropdownMenuCheckboxItem
                                  key={column.key}
                                  checked={visibleColumnKeys.includes(column.key)}
                                  onCheckedChange={() => toggleColumnVisibility(column.key)}
                                >
                                  {column.label}
                                </DropdownMenuCheckboxItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="space-y-1 pt-1 text-left">
                          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Departments
                          </p>
                          <Select
                            value={filters.departmentId || "__ALL__"}
                            onValueChange={(value) => {
                              updateRoute({ departmentId: value === "__ALL__" ? "" : value })
                            }}
                          >
                            <SelectTrigger className="h-8">
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
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            startTransition(() => {
                              router.replace(pathname)
                            })
                          }}
                        >
                          <IconRefresh className="mr-1.5 h-3.5 w-3.5" />
                          Reset Filters
                        </Button>
                      </div>
                      {isPending ? (
                        <p className="mt-1 text-left text-[11px] font-normal text-muted-foreground">Loading report...</p>
                      ) : null}
                    </th>
                  </tr>
                  <tr>
                    {visibleColumns.map((column) => (
                      <th
                        key={column.key}
                        className={cn(
                          "border border-border px-2 py-1.5 text-left break-words whitespace-normal",
                          column.align === "right" ? "text-right" : ""
                        )}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumnCount}
                        className="border border-border px-3 py-8 text-center text-sm text-muted-foreground"
                      >
                        No employee records found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    employees.map((row) => (
                      <tr key={row.employeeId} className="hover:bg-muted/20">
                        {visibleColumns.map((column) => (
                          <td
                            key={`${row.employeeId}-${column.key}`}
                            className={cn(
                              "border border-border px-2 py-1.5 align-top break-words whitespace-normal",
                              column.align === "right" ? "text-right" : "",
                              column.cellClassName
                            )}
                          >
                            {column.renderCell(row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
