"use client"

import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"
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
  payslips: Array<{
    id: string
    employeeId: string
    payslipNumber: string
    employeeName: string
    employeeNumber: string
    employeePhotoUrl: string | null
    grossPay: string
    totalDeductions: string
    netPay: string
    releasedAt: string
    generatedAt: string
    runNumber: string
    runPeriodLabel: string
  }>
}

type EmployeeRow = {
  employeeId: string
  employeeName: string
  employeeNumber: string
  employeePhotoUrl: string | null
  payslipCount: number
}

const parseCurrency = (value: string): number => Number(value.replace(/[^0-9.-]/g, "")) || 0

const formatPhp = (value: number): string =>
  `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PayrollPayslipsPageClient({ companyId, companyName, payslips }: PayrollPayslipsPageClientProps) {
  const [searchText, setSearchText] = useState("")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)

  const employeeRows = useMemo(() => {
    const map = new Map<string, EmployeeRow>()

    for (const payslip of payslips) {
      const existing = map.get(payslip.employeeId)
      if (!existing) {
        map.set(payslip.employeeId, {
          employeeId: payslip.employeeId,
          employeeName: payslip.employeeName,
          employeeNumber: payslip.employeeNumber,
          employeePhotoUrl: payslip.employeePhotoUrl,
          payslipCount: 1,
        })
      } else {
        existing.payslipCount += 1
      }
    }

    return Array.from(map.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  }, [payslips])

  const filteredEmployees = useMemo(() => {
    const normalized = searchText.trim().toLowerCase()
    if (!normalized) {
      return employeeRows
    }

    return employeeRows.filter((row) => {
      return (
        row.employeeName.toLowerCase().includes(normalized) ||
        row.employeeNumber.toLowerCase().includes(normalized)
      )
    })
  }, [employeeRows, searchText])

  const resolvedSelectedEmployeeId =
    selectedEmployeeId && filteredEmployees.some((row) => row.employeeId === selectedEmployeeId)
      ? selectedEmployeeId
      : (filteredEmployees[0]?.employeeId ?? null)

  const selectedEmployee =
    resolvedSelectedEmployeeId
      ? filteredEmployees.find((row) => row.employeeId === resolvedSelectedEmployeeId) ?? null
      : null

  const selectedEmployeePayslips = useMemo(() => {
    if (!resolvedSelectedEmployeeId) {
      return []
    }

    return payslips.filter((row) => row.employeeId === resolvedSelectedEmployeeId)
  }, [payslips, resolvedSelectedEmployeeId])

  const stats = useMemo(() => {
    const totalEmployees = employeeRows.length
    const totalPayslips = payslips.length
    const totalNet = payslips.reduce((sum, row) => sum + parseCurrency(row.netPay), 0)
    const releasedCount = payslips.filter((row) => row.releasedAt !== "-").length

    return {
      totalEmployees,
      totalPayslips,
      totalNet,
      releasedCount,
    }
  }, [employeeRows.length, payslips])

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
        <StatCard label="Aggregate Net" value={formatPhp(stats.totalNet)} icon={<IconCashBanknote className="size-4 text-primary" />} />
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
                {filteredEmployees.length === 0 ? (
                  <p className="px-2 py-4 text-xs text-muted-foreground">No employees found.</p>
                ) : (
                  filteredEmployees.map((employee) => (
                    <button
                      key={employee.employeeId}
                      type="button"
                      onClick={() => setSelectedEmployeeId(employee.employeeId)}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left text-xs",
                        resolvedSelectedEmployeeId === employee.employeeId
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
                      {selectedEmployeePayslips.map((payslip) => (
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
                      ))}
                    </tbody>
                  </table>
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
