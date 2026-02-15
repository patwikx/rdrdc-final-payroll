"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconCalendarCheck,
  IconChecklist,
  IconClockHour4,
  IconCurrencyPeso,
  IconFileInvoice,
  IconGauge,
  IconRefresh,
  IconTrendingUp,
  IconUsers,
  IconAlertCircle,
  IconPlayerPlay,
  IconUserPlus,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { DashboardActionCenterData } from "@/modules/dashboard/utils/get-dashboard-action-center-data"

/**
 * Dashboard Layout — Main Content + Right Sidebar
 *
 * Main area on the left with KPI strip and tables.
 * Right sidebar containing readiness gauges, critical actions,
 * and quick links.
 */

type Props = {
  companyId: string
  companyName: string
  companyCode: string
  companyRole: string
  data: DashboardActionCenterData
}

const APPROVALS_PAGE_SIZE = 5
const EXCEPTIONS_PAGE_SIZE = 5

const priorityVariant = (p: string): "default" | "secondary" | "destructive" | "outline" => {
  if (p === "Critical") return "destructive"
  if (p === "High") return "default"
  return "secondary"
}

const getModuleIcon = (module: string) => {
  switch (module) {
    case "Leave":
      return <IconCalendarCheck className="size-3.5" />
    case "Overtime":
      return <IconClockHour4 className="size-3.5" />
    case "Timekeeping":
      return <IconClockHour4 className="size-3.5" />
    case "Payroll":
      return <IconCurrencyPeso className="size-3.5" />
    default:
      return <IconFileInvoice className="size-3.5" />
  }
}

export function DashboardLayout({ companyId, companyName, data }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [approvalsPage, setApprovalsPage] = useState(1)
  const [exceptionsPage, setExceptionsPage] = useState(1)

  const periodLabel = data.stats.timekeepingDelta.match(/\(([^)]+)\)/)?.[1] || "Current period"

  const handleCycleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("cycle", value)
    router.push(`/${companyId}/dashboard?${params.toString()}`)
  }

  const hrActionableOwners = ["HR", "Payroll", "Super Admin"]
  const hrApprovals = data.approvals.filter((a) => hrActionableOwners.includes(a.owner))
  const totalPending = hrApprovals.length
  const criticalCount = hrApprovals.filter((a) => a.priority === "Critical" || a.priority === "High").length
  const exceptionsOnly = data.timekeepingExceptions.filter((r) => r[1] !== "No exceptions")
  const approvalsTotalPages = Math.max(1, Math.ceil(hrApprovals.length / APPROVALS_PAGE_SIZE))
  const safeApprovalsPage = Math.min(approvalsPage, approvalsTotalPages)
  const pagedHrApprovals = hrApprovals.slice(
    (safeApprovalsPage - 1) * APPROVALS_PAGE_SIZE,
    safeApprovalsPage * APPROVALS_PAGE_SIZE
  )
  const exceptionsTotalPages = Math.max(1, Math.ceil(exceptionsOnly.length / EXCEPTIONS_PAGE_SIZE))
  const safeExceptionsPage = Math.min(exceptionsPage, exceptionsTotalPages)
  const pagedExceptions = exceptionsOnly.slice(
    (safeExceptionsPage - 1) * EXCEPTIONS_PAGE_SIZE,
    safeExceptionsPage * EXCEPTIONS_PAGE_SIZE
  )

  const readinessItems = [
    { label: "Attendance Locked", value: data.payrollReadiness.attendanceLocked },
    { label: "Leave Computed", value: data.payrollReadiness.leaveDeductionsComputed },
    { label: "OT Premiums", value: data.payrollReadiness.otPremiumsComputed },
    { label: "Approvals Complete", value: data.payrollReadiness.approvalComplete },
  ]

  return (
    <div className="min-h-screen w-full bg-background">
      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-6 border-b border-border/60 px-8 pb-8 pt-8 md:flex-row md:items-end">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Payroll Operations</p>
          <div className="flex items-center gap-4">
            <h1 className="inline-flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
              <IconGauge className="h-7 w-7" /> HR Dashboard
            </h1>
            <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
              {companyName}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Overview for {periodLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={data.cycleMode} onValueChange={handleCycleChange}>
            <SelectTrigger className="w-[160px] border-border/60">
              <IconCalendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current cycle</SelectItem>
              <SelectItem value="previous">Previous cycle</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="border-border/60" onClick={() => router.refresh()}>
            <IconRefresh className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Main + Right Sidebar ── */}
      <div className="flex min-h-[calc(100vh-180px)] flex-col lg:flex-row">
        {/* Main Content */}
        <main className="flex flex-1 flex-col bg-background">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 border-b border-border/60 sm:grid-cols-5">
            {[
              { label: "Employees", value: data.stats.employeesValue, sub: `${data.stats.employeesDelta} new` },
              { label: "Net Payroll", value: data.stats.netPayrollValue, sub: `${data.stats.netPayrollDelta} vs last` },
              { label: "Pending", value: String(totalPending), sub: criticalCount > 0 ? `${criticalCount} urgent` : "Clear" },
              { label: "Exceptions", value: String(exceptionsOnly.length), sub: exceptionsOnly.length > 0 ? "Need review" : "None" },
              { label: "Leave & OT", value: data.stats.leaveOtValue, sub: "pending requests" },
            ].map((s) => (
              <div key={s.label} className="border-b border-r border-border/60 px-5 py-4 last:border-r-0 sm:border-b-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Approval Queue */}
          <div className="border-b border-border/60">
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2">
                <IconChecklist className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Pending Approvals</h2>
                {totalPending > 0 && <Badge variant="secondary">{totalPending}</Badge>}
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => router.push(`/${companyId}/approvals`)}>
                View all <IconArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>

            {hrApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <IconChecklist className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No pending items requiring HR action</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-6 py-2 text-left font-medium text-muted-foreground">Ref</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Module</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Employee</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Stage</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Priority</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedHrApprovals.map((row) => (
                      <tr key={row.ref} className="border-t border-border/60 hover:bg-muted/5">
                        <td className="px-6 py-2.5 font-mono text-muted-foreground">{row.ref}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1.5">{getModuleIcon(row.module)} {row.module}</span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-foreground">{row.employee}</td>
                        <td className="px-3 py-2.5"><Badge variant="outline">{row.owner}</Badge></td>
                        <td className="px-3 py-2.5"><Badge variant={priorityVariant(row.priority)}>{row.priority}</Badge></td>
                        <td className="px-3 py-2.5 text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push(row.reviewHref)}>Review</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hrApprovals.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-6 py-2 text-xs text-muted-foreground">
                <p>
                  Page {safeApprovalsPage} of {approvalsTotalPages} • {hrApprovals.length} records
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={safeApprovalsPage <= 1}
                    onClick={() => setApprovalsPage((prev) => Math.max(1, prev - 1))}
                  >
                    <IconChevronLeft className="size-3.5" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={safeApprovalsPage >= approvalsTotalPages}
                    onClick={() => setApprovalsPage((prev) => Math.min(approvalsTotalPages, prev + 1))}
                  >
                    Next
                    <IconChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Attendance Exceptions */}
          <div className="border-b border-border/60">
            <div className="flex items-center gap-2 px-6 py-3">
              <IconClockHour4 className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Attendance Exceptions</h2>
            </div>
            {exceptionsOnly.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-center">
                <IconChecklist className="h-5 w-5 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No attendance issues</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {pagedExceptions.map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-2.5 hover:bg-muted/5">
                    <div>
                      <p className="text-xs font-medium text-foreground">{row[0]}</p>
                      <p className="text-[11px] text-muted-foreground">{row[1]} • {row[2]}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{row[3]}</Badge>
                  </div>
                ))}
              </div>
            )}
            {exceptionsOnly.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-6 py-2 text-xs text-muted-foreground">
                <p>
                  Page {safeExceptionsPage} of {exceptionsTotalPages} • {exceptionsOnly.length} records
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={safeExceptionsPage <= 1}
                    onClick={() => setExceptionsPage((prev) => Math.max(1, prev - 1))}
                  >
                    <IconChevronLeft className="size-3.5" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={safeExceptionsPage >= exceptionsTotalPages}
                    onClick={() => setExceptionsPage((prev) => Math.min(exceptionsTotalPages, prev + 1))}
                  >
                    Next
                    <IconChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-full shrink-0 space-y-8 border-l border-border/60 bg-background/50 p-6 lg:w-72">
          {/* Cycle Readiness */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IconTrendingUp className="h-3 w-3" /> Cycle Readiness
            </h3>
            <div className="space-y-2.5">
              {readinessItems.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span
                      className={cn(
                        "font-medium",
                        item.value >= 80 ? "text-emerald-600" : item.value >= 50 ? "text-amber-600" : "text-destructive"
                      )}
                    >
                      {item.value}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        item.value >= 80 ? "bg-emerald-500" : item.value >= 50 ? "bg-amber-500" : "bg-destructive"
                      )}
                      style={{ width: `${Math.min(item.value, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="border-t border-border/60 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Overall</span>
                  <span
                    className={cn(
                      "font-semibold",
                      data.cycleReadiness >= 80 ? "text-emerald-600" : data.cycleReadiness >= 50 ? "text-amber-600" : "text-destructive"
                    )}
                  >
                    {data.cycleReadiness}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Critical Actions */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IconAlertCircle className="h-3 w-3" /> Critical Actions
            </h3>
            <div className="ml-1.5 flex flex-col gap-px border-l border-border/60 pl-3">
              {data.criticalActions
                .filter((a) => a.count > 0)
                .map((action) => (
                  <div key={action.key} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-muted-foreground">{action.label}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {action.count}
                    </Badge>
                  </div>
                ))}
              {data.criticalActions.filter((a) => a.count > 0).length === 0 && (
                <p className="py-1.5 text-xs text-emerald-600">No critical items</p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IconChecklist className="h-3 w-3" /> Quick Stats
            </h3>
            <div className="space-y-2">
              {data.employeeRows.map((row) => (
                <div key={row[0]} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row[0]}</span>
                  <span className="font-medium text-foreground">{row[1]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">Quick Actions</h3>
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="sm" className="h-8 justify-start gap-2 text-xs" onClick={() => router.push(`/${companyId}/employees/onboarding`)}>
                <IconUserPlus className="size-3.5" /> Add Employee
              </Button>
              <Button variant="ghost" size="sm" className="h-8 justify-start gap-2 text-xs" onClick={() => router.push(`/${companyId}/payroll`)}>
                <IconPlayerPlay className="size-3.5" /> Run Payroll
              </Button>
              <Button variant="ghost" size="sm" className="h-8 justify-start gap-2 text-xs" onClick={() => router.push(`/${companyId}/approvals`)}>
                <IconChecklist className="size-3.5" /> Approvals
              </Button>
              <Button variant="ghost" size="sm" className="h-8 justify-start gap-2 text-xs" onClick={() => router.push(`/${companyId}/employees`)}>
                <IconUsers className="size-3.5" /> Employees
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
