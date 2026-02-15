"use client"

import { useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  IconBuildingStore,
  IconCalendar,
  IconCalendarCheck,
  IconChecklist,
  IconClockHour4,
  IconCurrencyPeso,
  IconFileInvoice,
  IconGauge,
  IconHourglass,
  IconRefresh,
  IconTrendingUp,
  IconUsers,
  IconAlertCircle,
  IconArrowRight,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { DashboardActionCenterData } from "@/modules/dashboard/utils/get-dashboard-action-center-data"

// ─── Types ─────────────────────────────────────────────────────────────────

export type DashboardActionCenterLayoutProps = {
  companyId: string
  companyName: string
  companyCode: string
  companyRole: string
  data: DashboardActionCenterData
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const priorityVariant = (p: string): "default" | "secondary" | "destructive" | "outline" => {
  if (p === "Critical") return "destructive"
  if (p === "High") return "default"
  return "secondary"
}

const getModuleIcon = (module: string) => {
  switch (module) {
    case "Leave":
      return <IconCalendarCheck className="h-3.5 w-3.5" />
    case "Overtime":
      return <IconClockHour4 className="h-3.5 w-3.5" />
    case "Timekeeping":
      return <IconClockHour4 className="h-3.5 w-3.5" />
    case "Payroll":
      return <IconCurrencyPeso className="h-3.5 w-3.5" />
    default:
      return <IconFileInvoice className="h-3.5 w-3.5" />
  }
}

// ─── Animation ─────────────────────────────────────────────────────────────

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
}

// ═══════════════════════════════════════════════════════════════════════════
//  Dashboard — Improved HR-Friendly Layout
//
//  Structure:
//  1. Welcome header with company context and period selector
//  2. Key metrics cards (5 stats in clear grid)
//  3. Main content: Left (Pending Approvals) + Right (Timekeeping & Summary)
//  4. Quick actions footer
// ═══════════════════════════════════════════════════════════════════════════

export function DashboardActionCenterLayout(props: DashboardActionCenterLayoutProps) {
  const { companyId, companyName, companyRole, data } = props
  const router = useRouter()
  const searchParams = useSearchParams()

  const roleLabel = useMemo(() => companyRole.split("_").join(" "), [companyRole])

  const handleCycleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("cycle", value)
    router.push(`/${companyId}/dashboard?${params.toString()}`)
  }

  // Parse the confusing deltas into clearer labels
  const periodLabel = data.stats.timekeepingDelta.match(/\(([^)]+)\)/)?.[1] || "Current period"
  
  // Calculate payroll status
  const payrollStatus = data.stats.netPayrollValue !== "PHP 0" 
    ? { label: "In Progress", color: "default" as const }
    : { label: "No Active Run", color: "secondary" as const }

  // Filter to only show approvals that need HR attention
  const hrActionableOwners = ["HR", "Payroll", "Super Admin"]
  const hrApprovals = data.approvals.filter(a => hrActionableOwners.includes(a.owner))
  
  // Calculate total pending items
  const totalPending = hrApprovals.length
  const criticalCount = hrApprovals.filter(a => a.priority === "Critical" || a.priority === "High").length

  return (
    <motion.div {...pageTransition} className="min-h-screen w-full bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-muted/20">
        <div className="flex flex-col justify-between gap-4 px-6 py-6 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconBuildingStore className="h-4 w-4" />
              <span>{companyName}</span>
              <span className="text-border">|</span>
              <Badge variant="outline" className="text-xs capitalize">
                {roleLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                <IconGauge className="h-6 w-6 text-primary" />
                HR Dashboard
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Overview for {periodLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={data.cycleMode} onValueChange={handleCycleChange}>
              <SelectTrigger className="w-[160px] border-border/60 bg-background">
                <IconCalendar className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current cycle</SelectItem>
                <SelectItem value="previous">Previous cycle</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon" 
              className="border-border/60"
              onClick={() => router.refresh()}
            >
              <IconRefresh className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <motion.div 
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5"
      >
        {/* Total Employees */}
        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Total Employees</p>
                  <p className="text-3xl font-semibold tracking-tight text-foreground">
                    {data.stats.employeesValue}
                  </p>
                </div>
                <div className="rounded-md bg-primary/10 p-2">
                  <IconUsers className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <IconTrendingUp className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600 font-medium">{data.stats.employeesDelta}</span>
                <span>new this period</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payroll Status */}
        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Payroll Status</p>
                  <p className="text-3xl font-semibold tracking-tight text-foreground">
                    {data.stats.netPayrollValue}
                  </p>
                </div>
                <div className={cn(
                  "rounded-md p-2",
                  payrollStatus.label === "In Progress" ? "bg-primary/10" : "bg-muted"
                )}>
                  <IconCurrencyPeso className={cn(
                    "h-4 w-4",
                    payrollStatus.label === "In Progress" ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
              </div>
              <div className="mt-3">
                <Badge 
                  variant={payrollStatus.label === "In Progress" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {payrollStatus.label}
                </Badge>
                {data.stats.netPayrollDelta !== "+0.0%" && data.stats.netPayrollDelta !== "-0.0%" && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {data.stats.netPayrollDelta} vs last period
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Approvals */}
        <motion.div variants={fadeInUp}>
          <Card className={cn("h-full", totalPending > 0 && "border-amber-500/30")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Pending Approvals</p>
                  <p className={cn(
                    "text-3xl font-semibold tracking-tight",
                    totalPending > 0 ? "text-amber-600" : "text-foreground"
                  )}>
                    {totalPending}
                  </p>
                </div>
                <div className={cn(
                  "rounded-md p-2",
                  totalPending > 0 ? "bg-amber-500/10" : "bg-muted"
                )}>
                  <IconHourglass className={cn(
                    "h-4 w-4",
                    totalPending > 0 ? "text-amber-600" : "text-muted-foreground"
                  )} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                {criticalCount > 0 ? (
                  <>
                    <IconAlertCircle className="h-3 w-3 text-destructive" />
                    <span className="text-destructive font-medium">{criticalCount} urgent</span>
                    <span className="text-muted-foreground">need attention</span>
                  </>
                ) : totalPending > 0 ? (
                  <span className="text-muted-foreground">Waiting for review</span>
                ) : (
                  <span className="text-emerald-600 font-medium">All caught up!</span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendance Issues */}
        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Attendance Issues</p>
                  <p className="text-3xl font-semibold tracking-tight text-foreground">
                    {data.timekeepingExceptions.filter(r => r[1] !== "No exceptions").length}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <IconClockHour4 className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {data.timekeepingExceptions.filter(r => r[1] !== "No exceptions").length > 0 
                  ? "Exceptions need review" 
                  : "No issues this period"}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Leave & OT Requests */}
        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Leave & OT</p>
                  <p className="text-3xl font-semibold tracking-tight text-foreground">
                    {data.stats.leaveOtValue}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <IconCalendarCheck className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {data.stats.leaveOtDelta}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <div className="grid gap-6 px-6 pb-6 lg:grid-cols-3">
        {/* Pending Approvals - Takes up 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconChecklist className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Pending Approvals</h2>
              {totalPending > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalPending}
                </Badge>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs"
              onClick={() => router.push(`/${companyId}/approvals`)}
            >
              View all
              <IconArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>

          <Card>
            {hrApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="rounded-full bg-emerald-500/10 p-4">
                  <IconChecklist className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">All approvals completed</p>
                  <p className="text-xs text-muted-foreground">No pending items requiring HR action</p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden">
                {/* Table Header */}
                <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                    <div className="col-span-2">Request ID</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-3">Employee</div>
                    <div className="col-span-2">Stage</div>
                    <div className="col-span-2">Priority</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>
                </div>
                {/* Table Rows */}
                <div className="divide-y divide-border/60">
                  {hrApprovals.map((row) => (
                    <div
                      key={row.ref}
                      className="grid grid-cols-12 items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="col-span-2 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground truncate block">
                          {row.ref}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          {getModuleIcon(row.module)}
                          <span>{row.module}</span>
                        </div>
                      </div>
                      <div className="col-span-3 truncate text-sm font-medium text-foreground">
                        {row.employee}
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline" className="text-xs">
                          {row.owner}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <Badge 
                          variant={priorityVariant(row.priority)}
                          className="text-xs"
                        >
                          {row.priority}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => router.push(`/${companyId}/approvals`)}
                        >
                          Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Timekeeping Issues */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconClockHour4 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Attendance Issues</h2>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs"
                onClick={() => router.push(`/${companyId}/attendance/exceptions`)}
              >
                View all
                <IconArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <Card>
              {data.timekeepingExceptions.filter(r => r[1] !== "No exceptions").length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <div className="rounded-full bg-emerald-500/10 p-3">
                    <IconChecklist className="h-5 w-5 text-emerald-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">No attendance issues</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {data.timekeepingExceptions
                    .filter(r => r[1] !== "No exceptions")
                    .slice(0, 5)
                    .map((row, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">{row[0]}</p>
                        <p className="text-xs text-muted-foreground">{row[1]} • {row[2]}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {row[3]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Quick Stats Summary */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <IconTrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Quick Stats</h2>
            </div>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Leave Requests</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {data.leaveOtRows[0]?.[1] || "0"}
                    </span>
                    <span className="text-xs text-muted-foreground">pending</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">OT Requests</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {data.leaveOtRows[1]?.[1] || "0"}
                  </span>
                    <span className="text-xs text-muted-foreground">pending</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payroll Runs</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {data.leaveOtRows[3]?.[1] || "0"}
                    </span>
                    <span className="text-xs text-muted-foreground">awaiting approval</span>
                  </div>
                </div>
                <div className="border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Cycle Readiness</span>
                    <span className={cn(
                      "text-sm font-semibold",
                      data.cycleReadiness >= 80 ? "text-emerald-600" : 
                      data.cycleReadiness >= 50 ? "text-amber-600" : "text-destructive"
                    )}>
                      {data.cycleReadiness}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <IconArrowRight className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-auto py-3 justify-start text-left"
                onClick={() => router.push(`/${companyId}/employees/onboarding`)}
              >
                <div>
                  <p className="text-xs font-medium">Add Employee</p>
                  <p className="text-xs text-muted-foreground">Start onboarding</p>
                </div>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-auto py-3 justify-start text-left"
                onClick={() => router.push(`/${companyId}/payroll/runs/new`)}
              >
                <div>
                  <p className="text-xs font-medium">Run Payroll</p>
                  <p className="text-xs text-muted-foreground">Create new run</p>
                </div>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-auto py-3 justify-start text-left"
                onClick={() => router.push(`/${companyId}/attendance/dtr`)}
              >
                <div>
                  <p className="text-xs font-medium">View DTR</p>
                  <p className="text-xs text-muted-foreground">Daily records</p>
                </div>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-auto py-3 justify-start text-left"
                onClick={() => router.push(`/${companyId}/approvals`)}
              >
                <div>
                  <p className="text-xs font-medium">Approvals</p>
                  <p className="text-xs text-muted-foreground">Review queue</p>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
