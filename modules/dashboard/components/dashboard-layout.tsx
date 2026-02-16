"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  IconAlertCircle,
  IconArrowRight,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconChecklist,
  IconClockHour4,
  IconCurrencyPeso,
  IconGauge,
  IconPlayerPlay,
  IconRefresh,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { DashboardActionCenterData } from "@/modules/dashboard/utils/get-dashboard-action-center-data"

type Props = {
  companyId: string
  companyName: string
  companyCode: string
  companyRole: string
  data: DashboardActionCenterData
}

const APPROVALS_PAGE_SIZE = 5
const EXCEPTIONS_PAGE_SIZE = 5

const priorityVariant = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
  if (priority === "Critical") return "destructive"
  if (priority === "High") return "default"
  if (priority === "Medium") return "secondary"
  return "outline"
}

const getModuleIcon = (module: string) => {
  switch (module) {
    case "Leave":
      return <IconCalendar className="size-3.5" />
    case "Overtime":
      return <IconClockHour4 className="size-3.5" />
    case "Timekeeping":
      return <IconClockHour4 className="size-3.5" />
    case "Payroll":
      return <IconCurrencyPeso className="size-3.5" />
    default:
      return <IconChecklist className="size-3.5" />
  }
}

const getReadinessTone = (value: number) => {
  if (value >= 80) {
    return {
      labelClass: "text-emerald-600",
      barClass: "bg-emerald-500",
    }
  }

  if (value >= 50) {
    return {
      labelClass: "text-amber-600",
      barClass: "bg-amber-500",
    }
  }

  return {
    labelClass: "text-destructive",
    barClass: "bg-destructive",
  }
}

const getCriticalActionHref = (
  companyId: string,
  key: "payroll" | "timekeeping" | "leave" | "overtime"
): string => {
  if (key === "payroll") return `/${companyId}/payroll/runs`
  if (key === "timekeeping") return `/${companyId}/attendance/dtr`
  if (key === "leave") return `/${companyId}/approvals?kind=LEAVE`
  return `/${companyId}/approvals?kind=OVERTIME`
}

export function DashboardLayout({ companyId, companyName, data }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [approvalsPage, setApprovalsPage] = useState(1)
  const [exceptionsPage, setExceptionsPage] = useState(1)

  const periodLabel = data.stats.timekeepingDelta.match(/\(([^)]+)\)/)?.[1] || "Current period"

  const hrApprovals = useMemo(() => {
    const hrActionableOwners = new Set(["HR", "Payroll", "Super Admin"])
    return data.approvals.filter((item) => hrActionableOwners.has(item.owner))
  }, [data.approvals])

  const totalPending = hrApprovals.length
  const criticalCount = hrApprovals.filter((item) => item.priority === "Critical" || item.priority === "High").length
  const exceptionsOnly = data.timekeepingExceptions.filter((row) => row[1] !== "No exceptions")

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

  const cycleBadgeVariant: "default" | "secondary" | "destructive" =
    data.cycleReadiness >= 80 ? "default" : data.cycleReadiness >= 50 ? "secondary" : "destructive"

  const handleCycleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("cycle", value)
    router.replace(`/${companyId}/dashboard?${params.toString()}`)
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-28 top-12 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />

        <section className="relative w-full px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Payroll Operations Center</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  <IconGauge className="size-6 text-primary sm:size-7" />
                  Dashboard
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {companyName}
                </Badge>
                <Badge variant={cycleBadgeVariant} className="h-6 px-2 text-[11px]">
                  {data.cycleReadiness}% Ready
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Live operational overview for {periodLabel}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={data.cycleMode} onValueChange={handleCycleChange}>
                <SelectTrigger className="h-9 w-[170px] border-border/70">
                  <IconCalendar className="mr-1.5 size-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current cycle</SelectItem>
                  <SelectItem value="previous">Previous cycle</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 border-border/70"
                onClick={() => router.refresh()}
              >
                <IconRefresh className="size-4" />
              </Button>
              <Button type="button" className="h-9" onClick={() => router.push(`/${companyId}/payroll/runs`)}>
                <IconPlayerPlay className="mr-1.5 size-4" />
                Open Payroll Runs
              </Button>
            </div>
          </div>
        </section>
      </div>

      <section className="grid w-full gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8 2xl:px-10">
        <main className="space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <Card className="border-border/70 bg-gradient-to-br from-primary/10 to-background py-0">
              <CardHeader className="pb-1.5 pt-3">
                <CardDescription className="text-[11px] uppercase tracking-wide">Employees</CardDescription>
                <CardTitle className="text-lg">{data.stats.employeesValue}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-xs text-muted-foreground">{data.stats.employeesDelta} new in period</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 py-0">
              <CardHeader className="pb-1.5 pt-3">
                <CardDescription className="text-[11px] uppercase tracking-wide">Net Payroll</CardDescription>
                <CardTitle className="text-lg">{data.stats.netPayrollValue}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-xs text-muted-foreground">{data.stats.netPayrollDelta} vs last paid run</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 py-0">
              <CardHeader className="pb-1.5 pt-3">
                <CardDescription className="text-[11px] uppercase tracking-wide">Pending Approvals</CardDescription>
                <CardTitle className="text-lg">{totalPending}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-xs text-muted-foreground">{criticalCount > 0 ? `${criticalCount} urgent` : "No urgent blockers"}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 py-0">
              <CardHeader className="pb-1.5 pt-3">
                <CardDescription className="text-[11px] uppercase tracking-wide">Attendance Health</CardDescription>
                <CardTitle className="text-lg">{data.stats.timekeepingValue}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-xs text-muted-foreground">{data.stats.timekeepingDelta}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 py-0">
              <CardHeader className="pb-1.5 pt-3">
                <CardDescription className="text-[11px] uppercase tracking-wide">Leave & OT</CardDescription>
                <CardTitle className="text-lg">{data.stats.leaveOtValue}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-xs text-muted-foreground">{data.stats.leaveOtDelta}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 py-0">
              <CardHeader className="pb-1.5 pt-3">
                <CardDescription className="text-[11px] uppercase tracking-wide">Exceptions</CardDescription>
                <CardTitle className="text-lg">{exceptionsOnly.length}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-xs text-muted-foreground">{exceptionsOnly.length > 0 ? "Requires review" : "No exceptions"}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 py-0">
            <CardHeader className="border-b border-border/60 pb-3 pt-4">
              <div className="flex w-full items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <IconChecklist className="size-4 text-primary" />
                    Pending Approvals
                  </CardTitle>
                  <CardDescription className="text-xs">Requests already routed to HR or payroll.</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  onClick={() => router.push(`/${companyId}/approvals`)}
                >
                  View all
                  <IconArrowRight className="ml-1 size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {hrApprovals.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                  <IconChecklist className="size-6 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No pending items requiring HR action.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-xs">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="px-5 py-2 text-left font-medium text-muted-foreground">Ref</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Module</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Employee</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Owner</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Priority</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedHrApprovals.map((row) => (
                          <tr key={row.ref} className="border-t border-border/60 hover:bg-muted/10">
                            <td className="px-5 py-2.5 font-mono text-muted-foreground">{row.ref}</td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex items-center gap-1.5">{getModuleIcon(row.module)} {row.module}</span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-foreground">{row.employee}</td>
                            <td className="px-3 py-2.5">
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{row.owner}</Badge>
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge variant={priorityVariant(row.priority)} className="h-5 px-1.5 text-[10px]">
                                {row.priority}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push(row.reviewHref)}>
                                Review
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-2 text-xs text-muted-foreground">
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
                        onClick={() => setApprovalsPage((previous) => Math.max(1, previous - 1))}
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
                        onClick={() => setApprovalsPage((previous) => Math.min(approvalsTotalPages, previous + 1))}
                      >
                        Next
                        <IconChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 py-0">
            <CardHeader className="border-b border-border/60 pb-3 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <IconAlertCircle className="size-4 text-primary" />
                Attendance Exceptions
              </CardTitle>
              <CardDescription className="text-xs">Late, undertime, absences, and unresolved approvals.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {exceptionsOnly.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-6 py-12 text-center">
                  <IconChecklist className="size-5 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No attendance issues detected.</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border/60">
                    {pagedExceptions.map((row, index) => (
                      <div key={`${row[0]}-${row[2]}-${index}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/10">
                        <div>
                          <p className="text-xs font-medium text-foreground">{row[0]}</p>
                          <p className="text-[11px] text-muted-foreground">{row[1]} • {row[2]}</p>
                        </div>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          {row[3]}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-2 text-xs text-muted-foreground">
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
                        onClick={() => setExceptionsPage((previous) => Math.max(1, previous - 1))}
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
                        onClick={() => setExceptionsPage((previous) => Math.min(exceptionsTotalPages, previous + 1))}
                      >
                        Next
                        <IconChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-4">
          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <IconTrendingUp className="size-4 text-primary" />
                Cycle Readiness
              </CardTitle>
              <CardDescription className="text-xs">Status of key payroll dependencies.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {readinessItems.map((item) => {
                const tone = getReadinessTone(item.value)
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className={cn("font-medium", tone.labelClass)}>{item.value}%</span>
                    </div>
                    <Progress value={item.value} className={cn("h-1.5 [&>div]:transition-all", `[&>div]:${tone.barClass}`)} />
                  </div>
                )
              })}
              <Separator />
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Overall readiness</span>
                <Badge variant={cycleBadgeVariant} className="h-5 px-1.5 text-[10px]">
                  {data.cycleReadiness}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <IconAlertCircle className="size-4 text-primary" />
                Critical Actions
              </CardTitle>
              <CardDescription className="text-xs">Open operational blockers that require action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {data.criticalActions.filter((item) => item.count > 0).length === 0 ? (
                <p className="text-xs text-emerald-600">No critical items right now.</p>
              ) : (
                data.criticalActions
                  .filter((item) => item.count > 0)
                  .map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => router.push(getCriticalActionHref(companyId, item.key))}
                      className="flex w-full items-center justify-between border border-border/60 bg-muted/20 px-2.5 py-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="text-xs text-foreground">{item.label}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {item.count}
                      </Badge>
                    </button>
                  ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <IconUsers className="size-4 text-primary" />
                Workforce Pulse
              </CardTitle>
              <CardDescription className="text-xs">Quick snapshot from active employee records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {data.employeeRows.map((row) => (
                <div key={row[0]} className="flex items-center justify-between border border-border/60 bg-muted/20 px-2.5 py-2">
                  <span className="text-xs text-muted-foreground">{row[0]}</span>
                  <span className="text-xs font-medium text-foreground">{row[1]}</span>
                </div>
              ))}
            </CardContent>
          </Card>

        </aside>
      </section>
    </div>
  )
}
