import Link from "next/link"
import {
  IconAlertTriangle,
  IconBuilding,
  IconChartBar,
  IconChecklist,
  IconClockHour4,
  IconPackage,
  IconTimeline,
  IconUser,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type {
  EmployeePortalMaterialRequestKpiDashboard,
  EmployeePortalMaterialRequestKpiRange,
} from "@/modules/material-requests/types/employee-portal-material-request-types"

type MaterialRequestKpiDashboardPageProps = {
  companyId: string
  canViewCompanyWide: boolean
  dashboard: EmployeePortalMaterialRequestKpiDashboard
}

const RANGE_OPTIONS: Array<{ value: EmployeePortalMaterialRequestKpiRange; label: string }> = [
  { value: "LAST_30_DAYS", label: "30 Days" },
  { value: "LAST_90_DAYS", label: "90 Days" },
  { value: "LAST_180_DAYS", label: "180 Days" },
  { value: "YTD", label: "YTD" },
  { value: "ALL", label: "All" },
]

const formatDurationFromMs = (durationMs: number | null): string => {
  if (durationMs === null) {
    return "-"
  }

  const totalMinutes = Math.round(durationMs / (60 * 1000))
  if (totalMinutes <= 0) {
    return "< 1m"
  }

  const days = Math.floor(totalMinutes / (24 * 60))
  const remainingAfterDays = totalMinutes % (24 * 60)
  const hours = Math.floor(remainingAfterDays / 60)
  const minutes = remainingAfterDays % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)

  return parts.join(" ")
}

export function MaterialRequestKpiDashboardPage({
  companyId,
  canViewCompanyWide,
  dashboard,
}: MaterialRequestKpiDashboardPageProps) {
  const rangeLabel = dashboard.startDateLabel
    ? `${dashboard.startDateLabel} to ${dashboard.endDateLabel}`
    : `All records up to ${dashboard.endDateLabel}`

  return (
    <div className="w-full min-h-screen animate-in fade-in bg-background pb-8 duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">Analytics Workspace</p>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Material Request KPI Dashboard</h1>
          <Badge variant="outline" className="rounded-full border border-border/60">
            {canViewCompanyWide ? "Company Scope" : "My Requests"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{rangeLabel}</p>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => {
            const isActive = option.value === dashboard.range
            return (
              <Button key={option.value} type="button" variant={isActive ? "default" : "outline"} size="sm" asChild>
                <Link href={`/${companyId}/employee-portal/material-request-kpis?range=${option.value}`}>
                  {option.label}
                </Link>
              </Button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Submitted Requests</p>
              <IconChecklist className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{dashboard.overview.totalSubmittedRequests}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Completed Fulfillment</p>
              <IconPackage className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{dashboard.overview.completedRequests}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Pending Approval</p>
              <IconTimeline className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{dashboard.overview.pendingApprovalRequests}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">In Processing</p>
              <IconClockHour4 className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{dashboard.overview.inProgressProcessingRequests}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Avg Approval</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatDurationFromMs(dashboard.overview.avgApprovalLeadTimeMs)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Avg Queue</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatDurationFromMs(dashboard.overview.avgPurchaserQueueTimeMs)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Avg Processing</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatDurationFromMs(dashboard.overview.avgPurchaserProcessingTimeMs)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Avg Fulfillment</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatDurationFromMs(dashboard.overview.avgFulfillmentLeadTimeMs)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Avg Acknowledgment</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatDurationFromMs(dashboard.overview.avgAcknowledgmentLeadTimeMs)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">SLA Breaches</p>
            <IconAlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border/60 px-3 py-2 text-xs">
              <p className="text-muted-foreground">Approval &gt; {dashboard.slaTargetsHours.approval}h</p>
              <p className="text-lg font-semibold text-foreground">{dashboard.overview.approvalSlaBreachCount}</p>
            </div>
            <div className="rounded-xl border border-border/60 px-3 py-2 text-xs">
              <p className="text-muted-foreground">Queue &gt; {dashboard.slaTargetsHours.queue}h</p>
              <p className="text-lg font-semibold text-foreground">{dashboard.overview.queueSlaBreachCount}</p>
            </div>
            <div className="rounded-xl border border-border/60 px-3 py-2 text-xs">
              <p className="text-muted-foreground">Processing &gt; {dashboard.slaTargetsHours.processing}h</p>
              <p className="text-lg font-semibold text-foreground">{dashboard.overview.processingSlaBreachCount}</p>
            </div>
            <div className="rounded-xl border border-border/60 px-3 py-2 text-xs">
              <p className="text-muted-foreground">Fulfillment &gt; {dashboard.slaTargetsHours.fulfillment}h</p>
              <p className="text-lg font-semibold text-foreground">{dashboard.overview.fulfillmentSlaBreachCount}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">By Purchaser</p>
              <IconUser className="h-4 w-4 text-primary" />
            </div>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Purchaser</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Avg Processing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.byPurchaser.length > 0 ? dashboard.byPurchaser.map((row) => (
                  <TableRow key={row.purchaserKey}>
                    <TableCell>{row.purchaserName}</TableCell>
                    <TableCell className="text-right">{row.requestCount}</TableCell>
                    <TableCell className="text-right">{row.completedCount}</TableCell>
                    <TableCell className="text-right">{formatDurationFromMs(row.avgProcessingTimeMs)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No purchaser KPI data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">By Department</p>
              <IconBuilding className="h-4 w-4 text-primary" />
            </div>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Avg Fulfillment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.byDepartment.length > 0 ? dashboard.byDepartment.map((row) => (
                  <TableRow key={row.departmentId}>
                    <TableCell>{row.departmentName}</TableCell>
                    <TableCell className="text-right">{row.requestCount}</TableCell>
                    <TableCell className="text-right">{row.completedCount}</TableCell>
                    <TableCell className="text-right">{formatDurationFromMs(row.avgFulfillmentTimeMs)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No department KPI data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">By Month</p>
              <IconChartBar className="h-4 w-4 text-primary" />
            </div>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Avg Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.byMonth.length > 0 ? dashboard.byMonth.map((row) => (
                  <TableRow key={row.monthKey}>
                    <TableCell>{row.monthLabel}</TableCell>
                    <TableCell className="text-right">{row.requestCount}</TableCell>
                    <TableCell className="text-right">{row.completedCount}</TableCell>
                    <TableCell className="text-right">{formatDurationFromMs(row.avgApprovalTimeMs)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No monthly KPI data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Approval Step KPI</p>
              <IconTimeline className="h-4 w-4 text-primary" />
            </div>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead className="text-right">Acted</TableHead>
                  <TableHead className="text-right">Avg Turnaround</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.byApprovalStep.length > 0 ? dashboard.byApprovalStep.map((row) => (
                  <TableRow key={row.stepNumber}>
                    <TableCell>{row.stepName}</TableCell>
                    <TableCell className="text-right">{row.actedCount}</TableCell>
                    <TableCell className="text-right">{formatDurationFromMs(row.avgTurnaroundTimeMs)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No approval-step KPI data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
