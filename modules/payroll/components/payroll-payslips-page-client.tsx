"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  IconCashBanknote,
  IconChecklist,
  IconDownload,
  IconEye,
  IconFileInvoice,
  IconReceipt,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground">
          <IconFileInvoice className="size-5" />
          {companyName} Payslips History
        </h1>
        <p className="text-xs text-muted-foreground">Select an employee on the left to review all generated payslips.</p>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Employees" value={String(stats.totalEmployees)} icon={<IconUsers className="size-4 text-primary" />} />
        <StatCard label="Total Payslips" value={String(stats.totalPayslips)} icon={<IconReceipt className="size-4 text-primary" />} />
        <StatCard label="Released Payslips" value={String(stats.releasedCount)} icon={<IconChecklist className="size-4 text-primary" />} />
        <StatCard label="Aggregate Net" value={stats.totalNet} icon={<IconCashBanknote className="size-4 text-primary" />} />
      </section>

      <Card className="rounded-xl border border-border/70 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <IconReceipt className="size-4 text-primary" />
            Payslip Review Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-3 rounded-md border border-border/60 p-3">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search employee"
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-[560px] pr-1">
              <div className="space-y-2">
                {isLoading ? (
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
                        void fetchData({ employeeId: employee.employeeId, page: 1 })
                      }}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left text-xs",
                        selectedEmployeeId === employee.employeeId
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 bg-background hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Avatar className="h-10 w-8 shrink-0 rounded-md border border-border/60">
                          <AvatarImage
                            src={employee.employeePhotoUrl ?? undefined}
                            alt={employee.employeeName}
                            className="rounded-md object-cover"
                          />
                          <AvatarFallback className="rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                            {employee.employeeName
                              .split(",")
                              .map((part) => part.trim()[0] ?? "")
                              .slice(0, 2)
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{employee.employeeName}</p>
                          <p className="text-muted-foreground">{employee.employeeNumber}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {employee.payslipCount} payslip{employee.payslipCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className="space-y-3 rounded-md border border-border/60 p-3">
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            {selectedEmployee ? (
              <>
                <div>
                  <h2 className="text-sm font-semibold">{selectedEmployee.employeeName}</h2>
                  <p className="text-xs text-muted-foreground">{selectedEmployee.employeeNumber}</p>
                </div>

                <div className="overflow-x-auto rounded-md border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Payslip #</th>
                        <th className="px-3 py-2 text-left">Run</th>
                        <th className="px-3 py-2 text-left">Period</th>
                        <th className="px-3 py-2 text-left">Gross</th>
                        <th className="px-3 py-2 text-left">Deductions</th>
                        <th className="px-3 py-2 text-left">Net</th>
                        <th className="px-3 py-2 text-left">Released</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">Loading payslips...</td>
                        </tr>
                      ) : payslips.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">No payslips found.</td>
                        </tr>
                      ) : (
                        payslips.map((payslip) => (
                          <tr key={payslip.id} className="border-t border-border/50">
                            <td className="px-3 py-2 font-medium">{payslip.payslipNumber}</td>
                            <td className="px-3 py-2">{payslip.runNumber}</td>
                            <td className="px-3 py-2">{payslip.runPeriodLabel}</td>
                            <td className="px-3 py-2">{payslip.grossPay}</td>
                            <td className="px-3 py-2">{payslip.totalDeductions}</td>
                            <td className="px-3 py-2 font-medium">{payslip.netPay}</td>
                            <td className="px-3 py-2">{payslip.releasedAt}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                <Button asChild variant="outline" size="sm">
                                  <Link href={`/${companyId}/payroll/payslips/${payslip.id}`} className="inline-flex items-center gap-1">
                                    <IconEye className="size-3.5" />
                                    View
                                  </Link>
                                </Button>
                                <Button asChild size="sm">
                                  <Link href={`/${companyId}/payroll/payslips/${payslip.id}/download`} className="inline-flex items-center gap-1">
                                    <IconDownload className="size-3.5" />
                                    Download
                                  </Link>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-2">
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
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {currentPage}</span>
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
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No employee selected.</p>
            )}
          </section>
        </CardContent>
      </Card>
    </main>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card className="rounded-xl border border-border/70 bg-card/80">
      <CardContent className="grid grid-cols-[auto_1fr_auto] items-center gap-2 p-2.5">
        <div className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background p-1.5">
          {icon}
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
