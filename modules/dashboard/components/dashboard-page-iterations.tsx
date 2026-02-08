"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCalendarCheck,
  IconChecklist,
  IconClockHour4,
  IconCurrencyPeso,
  IconFileInvoice,
  IconRefresh,
  IconShieldCheck,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { DashboardActionCenterData } from "@/modules/dashboard/utils/get-dashboard-action-center-data"

type IterationId = "overview" | "ops" | "workflow" | "dense" | "action"

type DashboardPageIterationsProps = {
  companyName: string
  companyCode: string
  companyRole: string
}

const ITERATIONS: { id: IterationId; title: string; subtitle: string }[] = [
  { id: "overview", title: "Iteration 1", subtitle: "Executive Overview" },
  { id: "ops", title: "Iteration 2", subtitle: "Operations Console" },
  { id: "workflow", title: "Iteration 3", subtitle: "Workflow Board" },
  { id: "dense", title: "Iteration 4", subtitle: "Table-Dense" },
  { id: "action", title: "Iteration 5", subtitle: "Action Center" },
]

const approvalsFallback = [
  { ref: "OT-2298", module: "Overtime", employee: "A. Soriano", owner: "Payroll", amount: "PHP 4,820", priority: "High" },
  { ref: "LV-882", module: "Leave", employee: "J. Lim", owner: "HR", amount: "-", priority: "Medium" },
  { ref: "DTR-312", module: "Timekeeping", employee: "R. Santos", owner: "HR", amount: "-", priority: "High" },
  { ref: "PR-77", module: "Payroll", employee: "Batch", owner: "Super Admin", amount: "PHP 4.8M", priority: "Critical" },
]

const timekeepingExceptionsFallback = [
  ["R. Santos", "Missing Time-Out", "Feb 12", "For correction"],
  ["J. Natividad", "Duplicate Punch", "Feb 12", "Review"],
  ["L. Garcia", "Unscheduled OT", "Feb 13", "Pending"],
]

const leaveOtRowsFallback = [
  ["Leave Requests", "34", "12 awaiting approval"],
  ["Overtime Requests", "29", "9 awaiting approval"],
  ["Leave Conflicts", "3", "Needs HR decision"],
  ["OT Budget Alert", "2", "Exceeds threshold"],
]

export function DashboardPageIterations({ companyName, companyCode, companyRole }: DashboardPageIterationsProps) {
  const [active, setActive] = useState<IterationId>("overview")
  const roleLabel = useMemo(() => companyRole.split("_").join(" "), [companyRole])

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{companyCode}</p>
            <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconChecklist className="size-5" /> {companyName} Management Dashboard Concepts</h1>
            <p className="text-xs text-muted-foreground">Standard management view with employees, payroll, timekeeping, leave, overtime, and approvals.</p>
          </div>
          <Badge variant="outline" className="text-xs">Role: {roleLabel}</Badge>
        </div>
      </header>

      <ControlsBar />

      <section className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-card/40 p-2 sm:grid-cols-3 lg:grid-cols-5">
        {ITERATIONS.map((iteration) => {
          const isActive = iteration.id === active
          return (
            <Button
              key={iteration.id}
              type="button"
              variant={isActive ? "default" : "ghost"}
              className="h-auto flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left"
              onClick={() => setActive(iteration.id)}
            >
              <span>{iteration.title}</span>
              <span className={cn("text-[10px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>{iteration.subtitle}</span>
            </Button>
          )
        })}
      </section>

      <AnimatePresence mode="wait">
        <motion.section key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeOut" }}>
          {active === "overview" ? <OverviewLayout /> : null}
          {active === "ops" ? <OperationsLayout /> : null}
          {active === "workflow" ? <WorkflowLayout /> : null}
          {active === "dense" ? <DenseLayout /> : null}
          {active === "action" ? <ActionLayout /> : null}
        </motion.section>
      </AnimatePresence>
    </main>
  )
}

type DashboardActionCenterProps = DashboardPageIterationsProps & {
  data: DashboardActionCenterData
}

export function DashboardActionCenter({ companyName, companyRole, data }: DashboardActionCenterProps) {
  const roleLabel = useMemo(() => companyRole.split("_").join(" "), [companyRole])

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconChecklist className="size-5" /> {companyName} Management Dashboard</h1>
            <p className="text-xs text-muted-foreground">Action Center layout with employees, payroll, timekeeping, leave, overtime, and approvals.</p>
          </div>
          <Badge variant="outline" className="text-xs">Role: {roleLabel}</Badge>
        </div>
      </header>

      <ControlsBar />
      <ActionLayout data={data} />
    </main>
  )
}

function ControlsBar() {
  return (
    <div className="grid gap-3 rounded-xl border border-border/70 bg-card p-3 lg:grid-cols-[1fr_auto]">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button variant="outline" className="justify-between">Run payroll validation <IconArrowUpRight className="size-4" /></Button>
        <Button variant="outline" className="justify-between">Approve HR queue <IconArrowUpRight className="size-4" /></Button>
        <Button variant="outline" className="justify-between">Resolve DTR blockers <IconArrowUpRight className="size-4" /></Button>
        <Button variant="outline" className="justify-between">Review leave + OT <IconArrowUpRight className="size-4" /></Button>
      </div>
      <div className="flex items-center gap-2">
        <Select defaultValue="current">
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current payroll cycle</SelectItem>
            <SelectItem value="previous">Previous cycle</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon"><IconRefresh className="size-4" /></Button>
      </div>
    </div>
  )
}

function OverviewLayout() {
  return (
    <div className="space-y-3">
      <StatStrip />
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <ApprovalTableCard />
        <ModuleHealthCard />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <TimekeepingCard />
        <LeaveOvertimeCard />
        <EmployeeCard />
      </div>
    </div>
  )
}

function OperationsLayout() {
  return (
    <div className="space-y-3">
      <StatStrip />
      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr_1fr]">
        <EmployeeCard compact />
        <ApprovalTableCard />
        <TimekeepingCard compact />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <LeaveOvertimeCard compact />
        <PayrollReadinessCard />
      </div>
    </div>
  )
}

function WorkflowLayout() {
  return (
    <div className="space-y-3">
      <StatStrip />
      <div className="grid gap-3 lg:grid-cols-4">
        <StageCard title="Supervisor" refs={["LV-882", "OT-2301", "DTR-314"]} />
        <StageCard title="HR" refs={["LV-889", "DTR-312", "EMP-191"]} />
        <StageCard title="Payroll" refs={["OT-2298", "ADJ-194"]} />
        <StageCard title="Super Admin" refs={["PR-77", "CFG-21"]} />
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <ApprovalTableCard />
        <div className="space-y-3">
          <TimekeepingCard compact />
          <LeaveOvertimeCard compact />
        </div>
      </div>
    </div>
  )
}

function DenseLayout() {
  return (
    <div className="space-y-3">
      <StatStrip />
      <div className="grid gap-3 lg:grid-cols-2">
        <ApprovalTableCard dense />
        <PayrollReadinessCard />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <TimekeepingCard />
        <LeaveOvertimeCard />
      </div>
      <EmployeeCard />
    </div>
  )
}

function ActionLayout({ data }: { data?: DashboardActionCenterData }) {
  const criticalActions = data?.criticalActions ?? [
    { key: "payroll", label: "Approve payroll run", count: 1 },
    { key: "timekeeping", label: "Clear attendance blockers", count: 6 },
    { key: "leave", label: "Resolve leave conflicts", count: 3 },
    { key: "overtime", label: "Approve OT batch", count: 9 },
  ]
  const readiness = data?.cycleReadiness ?? 86

  return (
    <div className="space-y-3">
      <StatStrip stats={data?.stats} />
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <ApprovalTableCard rows={data?.approvals} />
        <Card>
          <CardHeader>
            <CardTitle>Critical Management Actions</CardTitle>
            <CardDescription>Priority actions across modules this cycle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticalActions.map((action) => (
              <Button key={action.key} className="w-full justify-between" variant="outline" disabled={action.count === 0}>
                {action.label} ({action.count})
                <IconArrowUpRight className="size-4" />
              </Button>
            ))}
            <div className="rounded-md border border-border/60 bg-background p-2.5">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Cycle readiness</p>
              <Progress value={readiness} className="mt-2" />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <TimekeepingCard compact rows={data?.timekeepingExceptions} />
        <LeaveOvertimeCard compact rows={data?.leaveOtRows} />
        <EmployeeCard compact rows={data?.employeeRows} />
      </div>
    </div>
  )
}

function StatStrip({ stats }: { stats?: DashboardActionCenterData["stats"] }) {
  const resolved = stats ?? {
    employeesValue: "452",
    employeesDelta: "+12",
    timekeepingValue: "96.4%",
    timekeepingDelta: "+0.6%",
    netPayrollValue: "PHP 4.8M",
    netPayrollDelta: "+6.2%",
    leaveOtValue: "63",
    leaveOtDelta: "+15",
    approvalsValue: "21",
    approvalsDelta: "-3",
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard title="Employees" value={resolved.employeesValue} delta={resolved.employeesDelta} icon={IconUsers} />
      <StatCard title="Timekeeping" value={resolved.timekeepingValue} delta={resolved.timekeepingDelta} icon={IconClockHour4} />
      <StatCard title="Net Payroll" value={resolved.netPayrollValue} delta={resolved.netPayrollDelta} icon={IconCurrencyPeso} />
      <StatCard title="Leave + OT" value={resolved.leaveOtValue} delta={resolved.leaveOtDelta} icon={IconCalendarCheck} />
      <StatCard title="Approvals" value={resolved.approvalsValue} delta={resolved.approvalsDelta} icon={IconChecklist} />
    </section>
  )
}

function StatCard({ title, value, delta, icon: Icon }: { title: string; value: string; delta: string; icon: typeof IconUsers }) {
  return (
    <Card>
      <CardContent className="px-3 py-1.5">
        <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><Icon className="size-3.5" />{title}</p>
        <p className="text-lg leading-tight font-semibold text-foreground">{value}</p>
        <p className="text-[11px] leading-tight text-muted-foreground">{delta} vs last cycle</p>
      </CardContent>
    </Card>
  )
}

function ApprovalTableCard({ dense = false, rows }: { dense?: boolean; rows?: DashboardActionCenterData["approvals"] }) {
  const resolvedRows = rows ?? approvalsFallback

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2"><IconFileInvoice className="size-4 text-primary" /> Approval Queue</CardTitle>
        <CardDescription>Cross-module approvals for employees, timekeeping, payroll, leave, and overtime.</CardDescription>
      </CardHeader>
      <CardContent>
        <table className={cn("w-full text-xs", dense ? "[&_td]:py-1.5" : "[&_td]:py-2") }>
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2">Ref</th>
              <th className="pb-2">Module</th>
              <th className="pb-2">Employee</th>
              <th className="pb-2">Owner</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Priority</th>
            </tr>
          </thead>
          <tbody>
            {resolvedRows.map((row) => (
              <tr key={row.ref} className="border-t border-border/60">
                <td className="font-medium text-foreground">{row.ref}</td>
                <td className="text-muted-foreground">{row.module}</td>
                <td className="text-muted-foreground">{row.employee}</td>
                <td className="text-muted-foreground">{row.owner}</td>
                <td className="text-muted-foreground">{row.amount}</td>
                <td><Badge variant="secondary">{row.priority}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function ModuleHealthCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Module Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <HealthRow label="Employees data completeness" value={92} />
        <HealthRow label="Timekeeping sync" value={88} />
        <HealthRow label="Payroll readiness" value={94} />
        <HealthRow label="Leave workflow" value={79} />
        <HealthRow label="Overtime workflow" value={83} />
      </CardContent>
    </Card>
  )
}

function TimekeepingCard({ compact = false, rows }: { compact?: boolean; rows?: string[][] }) {
  const resolvedRows = rows ?? timekeepingExceptionsFallback

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2"><IconClockHour4 className="size-4 text-primary" /> Timekeeping</CardTitle>
      </CardHeader>
      <CardContent>
        <SimpleTable columns={["Employee", "Issue", "Date", "State"]} rows={compact ? resolvedRows.slice(0, 2) : resolvedRows} />
      </CardContent>
    </Card>
  )
}

function LeaveOvertimeCard({ compact = false, rows }: { compact?: boolean; rows?: string[][] }) {
  const resolvedRows = rows ?? leaveOtRowsFallback
  const rowsToShow = compact ? resolvedRows.slice(0, 3) : resolvedRows

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2"><IconCalendarCheck className="size-4 text-primary" /> Leave + Overtime</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2">Item</th>
              <th className="pb-2">Count</th>
              <th className="pb-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rowsToShow.map((row) => (
              <tr key={row[0]} className="border-t border-border/60">
                <td className="py-2 font-medium text-foreground">{row[0]}</td>
                <td className="py-2 text-muted-foreground">{row[1]}</td>
                <td className="py-2 text-muted-foreground">{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function EmployeeCard({ compact = false, rows }: { compact?: boolean; rows?: string[][] }) {
  const fallbackRows = compact
    ? [["New hires", "8"], ["Regularization due", "5"], ["Separation in process", "2"]]
    : [["New hires", "8"], ["Regularization due", "5"], ["Transfer requests", "4"], ["Separation in process", "2"]]

  const rowsToShow = rows ?? fallbackRows

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2"><IconUserPlus className="size-4 text-primary" /> Employees</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rowsToShow.map((row) => (
          <div key={row[0]} className="flex items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm">
            <span className="text-muted-foreground">{row[0]}</span>
            <span className="font-medium text-foreground">{row[1]}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PayrollReadinessCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2"><IconShieldCheck className="size-4 text-primary" /> Payroll Readiness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <HealthRow label="Attendance locked" value={93} />
        <HealthRow label="Leave deductions computed" value={88} />
        <HealthRow label="OT premiums computed" value={84} />
        <HealthRow label="Approval complete" value={76} />
        <div className="rounded-md border border-border/60 bg-background p-2.5">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><IconAlertTriangle className="size-3.5" /> 2 blockers require admin review.</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StageCard({ title, refs }: { title: string; refs: string[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {refs.map((ref) => (
          <div key={ref} className="rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm">{ref}</div>
        ))}
      </CardContent>
    </Card>
  )
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          {columns.map((column) => <th key={column} className="pb-2">{column}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.join("|")} className="border-t border-border/60">
            {row.map((cell, idx) => (
              <td key={`${cell}-${idx}`} className={cn("py-2 text-muted-foreground", idx === 0 ? "font-medium text-foreground" : "")}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function HealthRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-background p-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}%</span>
      </div>
      <Progress value={value} className="mt-2" />
    </div>
  )
}
