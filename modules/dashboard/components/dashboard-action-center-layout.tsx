"use client"

import { useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  IconCalendarCheck,
  IconChecklist,
  IconClockHour4,
  IconCurrencyPeso,
  IconFileInvoice,
  IconGauge,
  IconRefresh,
  IconUsers,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

// ─── Animation ─────────────────────────────────────────────────────────────

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4 },
}

// ─── Shared building blocks ────────────────────────────────────────────────

function PageHeader({
  companyId,
  companyName,
  companyRole,
  data,
}: DashboardActionCenterLayoutProps) {
  const roleLabel = useMemo(() => companyRole.split("_").join(" "), [companyRole])
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleCycleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("cycle", value)
    router.push(`/${companyId}/dashboard?${params.toString()}`)
  }

  return (
    <div className="flex flex-col justify-between gap-6 border-b border-border/60 px-8 pb-8 pt-8 md:flex-row md:items-end">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Management Overview</p>
        <div className="flex items-center gap-4">
          <h1 className="inline-flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
            <IconGauge className="h-7 w-7" />
            Dashboard
          </h1>
          <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
            {companyName}
          </div>
          <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium capitalize text-primary">
            {roleLabel}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={data.cycleMode} onValueChange={handleCycleChange}>
          <SelectTrigger className="w-[155px] border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current cycle</SelectItem>
            <SelectItem value="previous">Previous cycle</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="border-border/60 hover:bg-muted/50" onClick={() => router.refresh()}>
          <IconRefresh className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function ApprovalRows({
  approvals,
  compact = false,
}: {
  approvals: DashboardActionCenterData["approvals"]
  compact?: boolean
}) {
  const rows = compact ? approvals.slice(0, 5) : approvals

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="rounded-md border border-border/60 bg-muted/20 p-4">
          <IconChecklist className="h-8 w-8 text-muted-foreground/70" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">All clear</p>
          <p className="text-sm text-muted-foreground">No pending approvals this cycle.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Column header */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-muted/10">
        <div className={cn(
          "grid h-10 items-center px-8 text-xs font-medium uppercase tracking-wide text-muted-foreground",
          compact ? "grid-cols-8" : "grid-cols-12"
        )}>
          <div className={compact ? "col-span-2" : "col-span-2"}>Ref</div>
          <div className={compact ? "col-span-2" : "col-span-2"}>Module</div>
          <div className={compact ? "col-span-2" : "col-span-3"}>Employee</div>
          {!compact && <div className="col-span-2">Owner</div>}
          {!compact && <div className="col-span-1 text-right">Amount</div>}
          <div className={compact ? "col-span-2" : "col-span-2"}>Priority</div>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/60">
        {rows.map((row) => (
          <div
            key={row.ref}
            className={cn(
              "group grid items-center px-8 py-3.5 transition-colors hover:bg-muted/5",
              compact ? "grid-cols-8" : "grid-cols-12"
            )}
          >
            <div className={compact ? "col-span-2" : "col-span-2"}>
              <Badge variant="secondary" className="font-medium">{row.ref}</Badge>
            </div>
            <div className={cn("text-sm text-muted-foreground", compact ? "col-span-2" : "col-span-2")}>
              {row.module}
            </div>
            <div className={cn("truncate text-sm font-medium text-foreground", compact ? "col-span-2" : "col-span-3")}>
              {row.employee}
            </div>
            {!compact && <div className="col-span-2 text-sm text-muted-foreground">{row.owner}</div>}
            {!compact && <div className="col-span-1 text-right text-sm tabular-nums text-muted-foreground">{row.amount}</div>}
            <div className={compact ? "col-span-2" : "col-span-2"}>
              <Badge variant={priorityVariant(row.priority)}>{row.priority}</Badge>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function MetricBlock({
  icon,
  label,
  value,
  sub,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}

function MiniTableRows({ columns, rows, statusCol }: { columns: string[]; rows: string[][]; statusCol?: number }) {
  return (
    <>
      <div className="border-b border-border/60 bg-muted/10">
        <div className="grid h-9 items-center px-6 text-xs font-medium uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
          {columns.map((col) => <div key={col}>{col}</div>)}
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((row, i) => (
          <div
            key={`mtr-${i}`}
            className="grid items-center px-6 py-2.5 text-sm transition-colors hover:bg-muted/5"
            style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
          >
            {row.map((cell, j) => (
              <div key={`mc-${i}-${j}`} className={j === 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
                {statusCol !== undefined && j === statusCol ? (
                  <Badge variant="outline" className="text-xs">{cell}</Badge>
                ) : cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
//  Dashboard — Overview Layout
//
//  Full-width horizontal bands. Metrics strip at top, then the
//  approval queue as the primary content, then timekeeping + leave
//  side by side at the bottom. Reads top-to-bottom like a report.
// ═══════════════════════════════════════════════════════════════════════════

export function DashboardActionCenterLayout(props: DashboardActionCenterLayoutProps) {
  const { data } = props

  return (
    <motion.div {...pageTransition} className="min-h-screen w-full bg-background">
      <PageHeader {...props} />

      {/* Metrics strip */}
      <div className="grid grid-cols-2 gap-6 border-b border-border/60 px-8 py-6 sm:grid-cols-3 xl:grid-cols-5">
        <MetricBlock icon={<IconUsers className="h-3.5 w-3.5" />} label="Employees" value={data.stats.employeesValue} sub={data.stats.employeesDelta} />
        <MetricBlock icon={<IconClockHour4 className="h-3.5 w-3.5" />} label="Attendance" value={data.stats.timekeepingValue} sub={data.stats.timekeepingDelta} />
        <MetricBlock icon={<IconCurrencyPeso className="h-3.5 w-3.5" />} label="Net Payroll" value={data.stats.netPayrollValue} sub={data.stats.netPayrollDelta} />
        <MetricBlock icon={<IconCalendarCheck className="h-3.5 w-3.5" />} label="Leave + OT" value={data.stats.leaveOtValue} sub={data.stats.leaveOtDelta} />
        <MetricBlock icon={<IconChecklist className="h-3.5 w-3.5" />} label="Approvals" value={data.stats.approvalsValue} sub={data.stats.approvalsDelta} />
      </div>

      {/* Approval queue — primary content */}
      <div className="border-b border-border/60">
        <div className="flex items-center justify-between px-8 py-4">
          <h2 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <IconFileInvoice className="h-3.5 w-3.5" /> Pending Approvals
          </h2>
          <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
            {data.approvals.length} pending
          </div>
        </div>
        <ApprovalRows approvals={data.approvals} />
      </div>

      {/* Timekeeping + Leave/OT */}
      <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-border/60">
        <div>
          <div className="px-8 py-4">
            <h2 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <IconClockHour4 className="h-3.5 w-3.5" /> Timekeeping Exceptions
            </h2>
          </div>
          <MiniTableRows columns={["Employee", "Issue", "Date", "Status"]} rows={data.timekeepingExceptions} statusCol={3} />
        </div>
        <div>
          <div className="px-8 py-4">
            <h2 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <IconCalendarCheck className="h-3.5 w-3.5" /> Leave + Overtime
            </h2>
          </div>
          <MiniTableRows columns={["Item", "Count", "Notes"]} rows={data.leaveOtRows} />
        </div>
      </div>
    </motion.div>
  )
}
