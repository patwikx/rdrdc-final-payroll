"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  IconBuildingBank,
  IconChevronLeft,
  IconChevronRight,
  IconCashBanknote,
  IconChecklist,
  IconDownload,
  IconDots,
  IconEye,
  IconFileInvoice,
  IconReceipt,
  IconSearch,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type PayrollPayslipsPageClientProps = {
  companyId: string
  companyName: string
  defaultStartDate: string
  defaultEndDate: string
  pageSize: number
}

type EmployeeRow = {
  employeeId: string
  employeeName: string
  employeeNumber: string
  employeePhotoUrl: string | null
  payslipCount: number
}

type PayslipRow = {
  id: string
  payslipNumber: string
  runNumber: string
  runPeriodLabel: string
  grossPay: string
  totalDeductions: string
  netPay: string
  releasedAt: string
}

type PayslipStats = {
  totalEmployees: number
  totalPayslips: number
  totalNet: string
  releasedCount: number
}

const defaultStats: PayslipStats = {
  totalEmployees: 0,
  totalPayslips: 0,
  totalNet: "PHP 0.00",
  releasedCount: 0,
}

export function PayrollPayslipsPageClient({
  companyId,
  companyName,
  defaultStartDate,
  defaultEndDate,
  pageSize,
}: PayrollPayslipsPageClientProps) {
  const [searchText, setSearchText] = useState("")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [payslips, setPayslips] = useState<PayslipRow[]>([])
  const [stats, setStats] = useState<PayslipStats>(defaultStats)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMorePayslips, setHasMorePayslips] = useState(false)

  const fetchData = async (options?: { employeeId?: string | null; page?: number }) => {
    const targetEmployeeId = options?.employeeId ?? selectedEmployeeId
    const targetPage = options?.page ?? currentPage

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        companyId,
        search: searchText,
        page: String(targetPage),
        pageSize: String(pageSize),
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      })

      if (targetEmployeeId) {
        params.set("selectedEmployeeId", targetEmployeeId)
      }

      const response = await fetch(`/api/payroll/payslips?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Unable to load payslips.")
      }

      const payload = (await response.json()) as {
        employees: EmployeeRow[]
        selectedEmployeeId: string | null
        payslips: PayslipRow[]
        stats: PayslipStats
        hasMorePayslips: boolean
      }

      setEmployees(payload.employees)
      setSelectedEmployeeId(payload.selectedEmployeeId)
      setPayslips(payload.payslips)
      setStats(payload.stats)
      setHasMorePayslips(payload.hasMorePayslips)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load payslips."
      setError(message)
      setEmployees([])
      setPayslips([])
      setStats(defaultStats)
      setHasMorePayslips(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      void fetchData({ page: 1, employeeId: null })
    }, 250)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])

  useEffect(() => {
    void fetchData({ page: 1, employeeId: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, defaultStartDate, defaultEndDate, pageSize])

  const selectedEmployee = useMemo(
    () => employees.find((row) => row.employeeId === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  )
  const hasEmployeeRows = employees.length > 0

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Payroll Operations</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              <IconFileInvoice className="size-6 text-primary" />
              Payslips History
            </h1>
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              <IconBuildingBank className="mr-1 size-3.5" />
              {companyName}
            </Badge>
            <Badge variant="secondary" className="h-6 px-2 text-[11px]">
              {defaultStartDate} to {defaultEndDate}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Select an employee on the left to review all generated payslips.</p>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4 sm:px-6">
        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="grid grid-cols-2 gap-px bg-border/60 xl:grid-cols-4">
            <div className="bg-background px-3 py-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <IconUsers className="size-3.5" /> Employees
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{String(stats.totalEmployees)}</p>
            </div>
            <div className="bg-background px-3 py-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <IconReceipt className="size-3.5" /> Total Payslips
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{String(stats.totalPayslips)}</p>
            </div>
            <div className="bg-background px-3 py-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <IconChecklist className="size-3.5" /> Released
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{String(stats.releasedCount)}</p>
            </div>
            <div className="bg-background px-3 py-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <IconCashBanknote className="size-3.5" /> Aggregate Net
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{stats.totalNet}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <IconReceipt className="size-4 text-primary" />
              Payslip Review Workspace
            </h2>
          </div>

          <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="space-y-3 border-b border-border/60 p-4 lg:border-b-0 lg:border-r">
              <div className="relative">
                <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search employee"
                  className="h-9 pl-8"
                />
              </div>
              <ScrollArea className="h-[420px] pr-1 lg:h-[calc(100vh-360px)]">
                <div className="space-y-2">
                  {isLoading && !hasEmployeeRows ? (
                    <p className="px-2 py-4 text-xs text-muted-foreground">Loading employees...</p>
                  ) : employees.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-muted-foreground">No employees found.</p>
                  ) : (
                    employees.map((employee) => (
                      <button
                        key={employee.employeeId}
                        type="button"
                        onClick={() => {
                          setCurrentPage(1)
                          setSelectedEmployeeId(employee.employeeId)
                          void fetchData({ employeeId: employee.employeeId, page: 1 })
                        }}
                        className={cn(
                          "w-full border-l-2 border-transparent border-y border-r border-border/60 bg-background px-3 py-2 text-left text-xs transition-colors hover:bg-muted/30",
                          selectedEmployeeId === employee.employeeId ? "border-l-primary bg-primary/5" : ""
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="h-9 w-9 shrink-0 border border-border/60">
                            <AvatarImage
                              src={employee.employeePhotoUrl ?? undefined}
                              alt={employee.employeeName}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-primary/5 text-[10px] font-semibold text-primary">
                              {employee.employeeName
                                .split(",")
                                .map((part) => part.trim()[0] ?? "")
                                .slice(0, 2)
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{employee.employeeName}</p>
                            <p className="text-muted-foreground">{employee.employeeNumber}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </aside>

            <section className="space-y-3 p-4">
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              {selectedEmployee ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <IconUser className="size-3.5 text-primary" />
                        <span>{selectedEmployee.employeeName}</span>
                      </h3>
                      <p className="text-xs text-muted-foreground">{selectedEmployee.employeeNumber}</p>
                    </div>
                    <Badge variant="outline" className="h-6 px-2 text-[11px]">
                      {selectedEmployee.payslipCount} payslip{selectedEmployee.payslipCount === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="overflow-x-auto border border-border/60">
                    <table className="w-full min-w-[860px]">
                      <thead className="bg-muted/20">
                        <tr className="border-b border-border/60">
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Payslip #</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Run</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Period</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Gross</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Deductions</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Net</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Released</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading ? (
                          <tr>
                            <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">Loading payslips...</td>
                          </tr>
                        ) : payslips.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">No payslips found.</td>
                          </tr>
                        ) : (
                          payslips.map((payslip) => (
                            <tr key={payslip.id} className="border-b border-border/50 hover:bg-muted/20">
                              <td className="px-3 py-2.5 text-sm font-medium text-foreground">{payslip.payslipNumber}</td>
                              <td className="px-3 py-2.5 text-sm text-foreground">{payslip.runNumber}</td>
                              <td className="px-3 py-2.5 text-sm text-foreground">{payslip.runPeriodLabel}</td>
                              <td className="px-3 py-2.5 text-sm text-foreground">{payslip.grossPay}</td>
                              <td className="px-3 py-2.5 text-sm text-foreground">{payslip.totalDeductions}</td>
                              <td className="px-3 py-2.5 text-sm font-medium text-foreground">{payslip.netPay}</td>
                              <td className="px-3 py-2.5 text-sm text-foreground">{payslip.releasedAt}</td>
                              <td className="px-3 py-2.5">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" size="icon-sm" variant="ghost">
                                      <IconDots className="size-4 rotate-90" />
                                      <span className="sr-only">Open actions</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem asChild>
                                      <Link href={`/${companyId}/payroll/payslips/${payslip.id}`} className="inline-flex items-center gap-1.5">
                                        <IconEye className="size-3.5" />
                                        View
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link href={`/${companyId}/payroll/payslips/${payslip.id}/download`} className="inline-flex items-center gap-1.5">
                                        <IconDownload className="size-3.5" />
                                        Download
                                      </Link>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2">
                    <p className="text-xs text-muted-foreground">Page {currentPage}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const next = Math.max(1, currentPage - 1)
                          setCurrentPage(next)
                          void fetchData({ page: next })
                        }}
                        disabled={currentPage <= 1 || isLoading}
                      >
                        <IconChevronLeft className="size-3.5" />
                        Previous
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const next = currentPage + 1
                          setCurrentPage(next)
                          void fetchData({ page: next })
                        }}
                        disabled={!hasMorePayslips || isLoading}
                      >
                        Next
                        <IconChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[280px] items-center justify-center border border-dashed border-border/60">
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <IconUsers className="size-4" />
                    Select an employee to view payslips.
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
