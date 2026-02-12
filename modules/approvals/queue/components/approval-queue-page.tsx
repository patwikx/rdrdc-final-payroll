"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconCheck,
  IconClockHour4,
  IconDots,
  IconEye,
  IconListDetails,
  IconSearch,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  approveLeaveRequestByHrAction,
  approveOvertimeRequestByHrAction,
  rejectLeaveRequestByHrAction,
  rejectOvertimeRequestByHrAction,
} from "@/modules/approvals/queue/actions/finalize-approval-queue-request-action"
import type { ApprovalQueueItem } from "@/modules/approvals/queue/utils/get-approval-queue-data"

type ApprovalQueuePageProps = {
  companyId: string
  companyName: string
  items: ApprovalQueueItem[]
  summary: {
    total: number
    leave: number
    overtime: number
    highPriority: number
  }
}

type ActionMode = "APPROVE" | "REJECT"

const priorityBadge = (priority: ApprovalQueueItem["priority"]): "default" | "secondary" | "destructive" => {
  if (priority === "HIGH") return "destructive"
  if (priority === "MEDIUM") return "secondary"
  return "default"
}

const requestTypeLabel = (kind: ApprovalQueueItem["kind"]): string => {
  return kind === "LEAVE" ? "Leave Request" : "Overtime Request"
}

export function ApprovalQueuePage({ companyId, companyName, items, summary }: ApprovalQueuePageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [selectedKind, setSelectedKind] = useState<"ALL" | "LEAVE" | "OVERTIME">("ALL")
  const [detailItem, setDetailItem] = useState<ApprovalQueueItem | null>(null)
  const [actionItem, setActionItem] = useState<ApprovalQueueItem | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>("APPROVE")
  const [actionNotes, setActionNotes] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return items.filter((item) => {
      const kindMatch = selectedKind === "ALL" || item.kind === selectedKind
      if (!kindMatch) return false
      if (!normalized) return true

      return (
        item.employeeName.toLowerCase().includes(normalized) ||
        item.requestNumber.toLowerCase().includes(normalized) ||
        item.department.toLowerCase().includes(normalized)
      )
    })
  }, [items, query, selectedKind])

  const openActionDialog = (item: ApprovalQueueItem, mode: ActionMode) => {
    setActionItem(item)
    setActionMode(mode)
    setActionNotes("")
    setActionError(null)
  }

  const closeActionDialog = (force = false) => {
    if (isPending && !force) return
    setActionItem(null)
    setActionNotes("")
    setActionError(null)
  }

  const submitAction = () => {
    if (!actionItem) return

    const noteText = actionNotes.trim()
    if (noteText.length < 2) {
      setActionError("Please provide at least 2 characters.")
      return
    }

    startTransition(async () => {
      let result: { ok: true; message: string } | { ok: false; error: string }

      if (actionMode === "APPROVE") {
        result =
          actionItem.kind === "LEAVE"
            ? await approveLeaveRequestByHrAction({
                companyId,
                requestId: actionItem.requestId,
                remarks: noteText,
              })
            : await approveOvertimeRequestByHrAction({
                companyId,
                requestId: actionItem.requestId,
                remarks: noteText,
              })
      } else {
        result =
          actionItem.kind === "LEAVE"
            ? await rejectLeaveRequestByHrAction({
                companyId,
                requestId: actionItem.requestId,
                reason: noteText,
              })
            : await rejectOvertimeRequestByHrAction({
                companyId,
                requestId: actionItem.requestId,
                reason: noteText,
              })
      }

      if (!result.ok) {
        setActionError(result.error)
        setPageError(result.error)
        return
      }

      setPageError(null)
      toast.success(result.message)
      closeActionDialog(true)
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <section className="border-b border-border/60 px-4 py-6 sm:px-6">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground"><IconShieldCheck className="size-5" /> {companyName} Leave & Overtime Approval Queue</h1>
        <p className="text-sm text-muted-foreground">
          HR final validation queue. All items shown here are already supervisor-approved.
        </p>
      </section>

      <div className="space-y-4 py-6">

      {pageError ? (
        <div className="px-4 sm:px-6">
          <section className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {pageError}
          </section>
        </div>
      ) : null}

      <section className="overflow-hidden border border-border/60">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 sm:divide-x sm:divide-border/60">
          <MetricTile label="Total Pending HR" value={String(summary.total)} icon={<IconListDetails className="size-4" />} />
          <MetricTile label="Leave Requests" value={String(summary.leave)} icon={<IconCalendarEvent className="size-4" />} />
          <MetricTile label="Overtime Requests" value={String(summary.overtime)} icon={<IconClockHour4 className="size-4" />} />
          <MetricTile label="High Priority" value={String(summary.highPriority)} icon={<IconAlertCircle className="size-4" />} />
        </div>
      </section>

      <section className="border-y border-border/60 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee or request" className="pl-8" />
          </div>
          <Button type="button" variant={selectedKind === "ALL" ? "default" : "outline"} onClick={() => setSelectedKind("ALL")}>
            <IconListDetails className="size-3.5" />
            All
          </Button>
          <Button
            type="button"
            variant={selectedKind === "LEAVE" ? "default" : "outline"}
            onClick={() => setSelectedKind("LEAVE")}
          >
            <IconCalendarEvent className="size-3.5" />
            Leave
          </Button>
          <Button
            type="button"
            variant={selectedKind === "OVERTIME" ? "default" : "outline"}
            onClick={() => setSelectedKind("OVERTIME")}
          >
            <IconClockHour4 className="size-3.5" />
            Overtime
          </Button>
        </div>
      </section>

      {summary.total === 0 ? (
        <section className="border-y border-border/60 bg-background px-4 py-10 text-center sm:px-6">
          <h2 className="text-base text-foreground">No requests pending for HR final validation.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New leave and overtime requests will appear here after supervisor approval.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden border-y border-border/60 bg-background">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Request</th>
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-left">Requested Date/Time</th>
                  <th className="px-3 py-2 text-left">Requested Duration</th>
                  <th className="px-3 py-2 text-left">Supervisor</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr className="border-t border-border/50 bg-background">
                    <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={7}>
                      No requests found for the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, index) => (
                    <tr
                      key={item.id}
                      className={
                        index % 2 === 0
                          ? "border-t border-border/50 bg-background"
                          : "border-t border-border/50 bg-muted/10"
                      }
                    >
                      <td className="px-3 py-2">
                        <div>{item.requestNumber}</div>
                        <div className="text-[11px] text-muted-foreground">{requestTypeLabel(item.kind)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{item.employeeName}</div>
                        <div className="text-[11px] text-muted-foreground">{item.department}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{item.scheduleLabel}</td>
                      <td className="px-3 py-2">
                        <div>{item.quantityLabel}</div>
                        {item.kind === "OVERTIME" && item.ctoConversionPreview ? (
                          <Badge className="mt-1 bg-primary text-primary-foreground">Converts to CTO (1:1)</Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{item.supervisorName}</td>
                      <td className="px-3 py-2">
                        <Badge variant={priorityBadge(item.priority)}>{item.priority}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="icon-sm" variant="ghost">
                              <IconDots className="size-4 rotate-90" />
                              <span className="sr-only">Open actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onSelect={() => setDetailItem(item)}>
                              <IconEye className="mr-2 size-4" />
                              Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openActionDialog(item, "APPROVE")}>
                              <IconCheck className="mr-2 size-4" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openActionDialog(item, "REJECT")}>
                              <IconX className="mr-2 size-4" />
                              Reject
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
        </section>
      )}

      <Sheet open={Boolean(detailItem)} onOpenChange={(open) => (!open ? setDetailItem(null) : null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/60 p-6">
            <SheetTitle>Request Details</SheetTitle>
            <SheetDescription>
              {detailItem ? `${detailItem.requestNumber} - ${requestTypeLabel(detailItem.kind)}` : ""}
            </SheetDescription>
          </SheetHeader>

          {detailItem ? (
            <div className="space-y-4 p-6">
              <DetailRow label="Employee" value={`${detailItem.employeeName} (${detailItem.employeeNumber})`} />
              <DetailRow label="Department" value={detailItem.department} />
              <DetailRow label="Filed Date" value={detailItem.filedAt} />
              <DetailRow label="Schedule" value={detailItem.scheduleLabel} />
              <DetailRow label="Duration" value={detailItem.quantityLabel} />
              {detailItem.kind === "OVERTIME" && detailItem.ctoConversionPreview ? (
                <DetailRow label="Conversion Preview" value="Will convert to CTO leave credits (1:1) on HR final approval." />
              ) : null}
              <DetailRow label="Reason" value={detailItem.reason} multiline />
              <DetailRow label="Supervisor" value={detailItem.supervisorName} />
              <DetailRow label="Supervisor Approved At" value={detailItem.supervisorApprovedAt} />
              <DetailRow label="Supervisor Remarks" value={detailItem.supervisorRemarks} multiline />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(actionItem)} onOpenChange={(open) => (!open ? closeActionDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionMode === "APPROVE" ? "Approve Request" : "Reject Request"}</DialogTitle>
            <DialogDescription>
              {actionItem
                ? `${requestTypeLabel(actionItem.kind)} ${actionItem.requestNumber} for ${actionItem.employeeName}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm text-foreground">
              {actionMode === "APPROVE" ? "HR remarks" : "Rejection reason"}
              <span className="ml-1 text-destructive">*</span>
            </label>
            <Textarea
              value={actionNotes}
              onChange={(event) => setActionNotes(event.target.value)}
              placeholder={actionMode === "APPROVE" ? "Enter final HR remarks" : "Enter rejection reason"}
              className="min-h-24"
              disabled={isPending}
            />
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeActionDialog()} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={submitAction} disabled={isPending}>
              {isPending ? "Saving..." : actionMode === "APPROVE" ? "Approve Request" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </main>
  )
}

function DetailRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={multiline ? "whitespace-pre-wrap text-sm text-foreground" : "text-sm text-foreground"}>{value}</p>
    </div>
  )
}

function MetricTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="border-b border-border/60 p-3 sm:border-b-0">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}
