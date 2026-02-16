"use client"

import { useCallback, useEffect, useOptimistic, useState, useTransition, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconAlertCircle,
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
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
import type {
  ApprovalQueueItem,
  ApprovalQueueKindFilter,
} from "@/modules/approvals/queue/utils/get-approval-queue-data"

type ApprovalQueuePageProps = {
  companyId: string
  companyName: string
  items: ApprovalQueueItem[]
  filters: {
    query: string
    kind: ApprovalQueueKindFilter
  }
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  summary: {
    total: number
    leave: number
    overtime: number
    highPriority: number
  }
}

type ActionMode = "APPROVE" | "REJECT"
type QueueOptimisticState = {
  items: ApprovalQueueItem[]
  summary: ApprovalQueuePageProps["summary"]
  pagination: ApprovalQueuePageProps["pagination"]
}
type QueueOptimisticAction = {
  type: "remove_item"
  item: ApprovalQueueItem
}

const priorityBadge = (priority: ApprovalQueueItem["priority"]): "default" | "secondary" | "destructive" => {
  if (priority === "HIGH") return "destructive"
  if (priority === "MEDIUM") return "secondary"
  return "default"
}

const requestTypeLabel = (kind: ApprovalQueueItem["kind"]): string => {
  return kind === "LEAVE" ? "Leave Request" : "Overtime Request"
}

export function ApprovalQueuePage({
  companyId,
  companyName,
  items,
  filters,
  pagination,
  summary,
}: ApprovalQueuePageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [queryInputState, setQueryInputState] = useState({
    baseQuery: filters.query,
    value: filters.query,
  })
  const queryInput = queryInputState.baseQuery === filters.query ? queryInputState.value : filters.query
  const [queueState, applyQueueOptimisticAction] = useOptimistic<QueueOptimisticState, QueueOptimisticAction>(
    { items, summary, pagination },
    (state, action) => {
      if (action.type !== "remove_item") return state

      const nextItems = state.items.filter((item) => item.id !== action.item.id)
      const nextSummary = {
        total: Math.max(state.summary.total - 1, 0),
        leave: action.item.kind === "LEAVE" ? Math.max(state.summary.leave - 1, 0) : state.summary.leave,
        overtime:
          action.item.kind === "OVERTIME"
            ? Math.max(state.summary.overtime - 1, 0)
            : state.summary.overtime,
        highPriority:
          action.item.priority === "HIGH"
            ? Math.max(state.summary.highPriority - 1, 0)
            : state.summary.highPriority,
      }
      const totalItems = Math.max(state.pagination.totalItems - 1, 0)
      const totalPages = Math.max(1, Math.ceil(totalItems / state.pagination.pageSize))
      const nextPagination = {
        ...state.pagination,
        page: Math.min(state.pagination.page, totalPages),
        totalItems,
        totalPages,
      }

      return {
        items: nextItems,
        summary: nextSummary,
        pagination: nextPagination,
      }
    }
  )
  const [detailItem, setDetailItem] = useState<ApprovalQueueItem | null>(null)
  const [actionItem, setActionItem] = useState<ApprovalQueueItem | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>("APPROVE")
  const [actionNotes, setActionNotes] = useState("")

  const updateRoute = useCallback(
    (updates: {
      q?: string
      kind?: ApprovalQueueKindFilter
      page?: number
    }) => {
      const params = new URLSearchParams(searchParams.toString())

      if (typeof updates.q !== "undefined") {
        const trimmed = updates.q.trim()
        if (trimmed) params.set("q", trimmed)
        else params.delete("q")
      }

      if (typeof updates.kind !== "undefined") {
        if (updates.kind === "ALL") params.delete("kind")
        else params.set("kind", updates.kind)
      }

      if (typeof updates.page !== "undefined") {
        if (updates.page > 1) params.set("page", String(updates.page))
        else params.delete("page")
      }

      const nextSearch = params.toString()
      const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname
      const currentSearch = searchParams.toString()
      const currentUrl = currentSearch ? `${pathname}?${currentSearch}` : pathname
      if (nextUrl !== currentUrl) {
        router.replace(nextUrl)
      }
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextQuery = queryInput.trim()
      if (nextQuery === filters.query) return
      updateRoute({
        q: nextQuery,
        page: 1,
      })
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [filters.query, queryInput, updateRoute])

  const openActionDialog = (item: ApprovalQueueItem, mode: ActionMode) => {
    setActionItem(item)
    setActionMode(mode)
    setActionNotes("")
  }

  const closeActionDialog = (force = false) => {
    if (isPending && !force) return
    setActionItem(null)
    setActionNotes("")
  }

  const submitAction = () => {
    if (!actionItem) return

    const noteText = actionNotes.trim()
    if (noteText.length < 2) {
      toast.error("Please provide at least 2 characters.")
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
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      const shouldGoPrevPage = queueState.items.length === 1 && queueState.pagination.page > 1

      applyQueueOptimisticAction({
        type: "remove_item",
        item: actionItem,
      })

      if (shouldGoPrevPage) {
        updateRoute({
          page: queueState.pagination.page - 1,
        })
      }

      closeActionDialog(true)
    })
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <section className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Human Resources</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              <IconShieldCheck className="size-6 text-primary" /> Approval Queue
            </h1>
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              <IconBuilding className="mr-1 size-3.5" />
              {companyName}
            </Badge>
            <Badge variant="secondary" className="h-6 px-2 text-[11px]">
              {queueState.summary.total} Pending
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">HR final validation queue. All items shown here are already supervisor-approved.</p>
        </div>
      </section>

      <div className="space-y-4 px-4 py-4 sm:px-6">

      <section className="overflow-hidden border border-border/60 bg-background">
        <div className="grid grid-cols-2 gap-px bg-border/60 xl:grid-cols-4">
          <MetricTile label="Total Pending HR" value={String(queueState.summary.total)} icon={<IconListDetails className="size-4" />} />
          <MetricTile label="Leave Requests" value={String(queueState.summary.leave)} icon={<IconCalendarEvent className="size-4" />} />
          <MetricTile label="Overtime Requests" value={String(queueState.summary.overtime)} icon={<IconClockHour4 className="size-4" />} />
          <MetricTile label="High Priority" value={String(queueState.summary.highPriority)} icon={<IconAlertCircle className="size-4" />} />
        </div>
      </section>

      <section className="border border-border/60 bg-background px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[320px] max-w-full">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryInput}
              onChange={(event) =>
                setQueryInputState({
                  baseQuery: filters.query,
                  value: event.target.value,
                })
              }
              placeholder="Search employee or request"
              className="h-8 pl-8"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant={filters.kind === "ALL" ? "default" : "outline"}
            onClick={() =>
              updateRoute({
                kind: "ALL",
                page: 1,
              })
            }
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <IconListDetails className="size-3.5" />
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filters.kind === "LEAVE" ? "default" : "outline"}
            onClick={() =>
              updateRoute({
                kind: "LEAVE",
                page: 1,
              })
            }
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <IconCalendarEvent className="size-3.5" />
            Leave
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filters.kind === "OVERTIME" ? "default" : "outline"}
            onClick={() =>
              updateRoute({
                kind: "OVERTIME",
                page: 1,
              })
            }
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <IconClockHour4 className="size-3.5" />
            Overtime
          </Button>
        </div>
      </section>

      {queueState.summary.total === 0 ? (
        <section className="border border-border/60 bg-background px-4 py-10 text-center">
          <h2 className="text-base text-foreground">No requests pending for HR final validation.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New leave and overtime requests will appear here after supervisor approval.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-muted/20">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Employee</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Requested Date/Time</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Requested Duration</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Supervisor</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Priority</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queueState.items.length === 0 ? (
                  <tr className="border-t border-border/50">
                    <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={7}>
                      No requests found for the current filters.
                    </td>
                  </tr>
                ) : (
                  queueState.items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={
                        index % 2 === 0
                          ? "border-t border-border/50 bg-background hover:bg-muted/20"
                          : "border-t border-border/50 bg-muted/10 hover:bg-muted/20"
                      }
                    >
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-foreground">{item.requestNumber}</div>
                        <div className="text-xs text-muted-foreground">{requestTypeLabel(item.kind)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm text-foreground">{item.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{item.department}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{item.scheduleLabel}</td>
                      <td className="px-3 py-2">
                        <div className="text-sm text-foreground">{item.quantityLabel}</div>
                        {item.kind === "OVERTIME" && item.ctoConversionPreview ? (
                          <Badge className="mt-1 h-5 bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">Converts to CTO (1:1)</Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{item.supervisorName}</td>
                      <td className="px-3 py-2">
                        <Badge variant={priorityBadge(item.priority)} className="h-6 px-2 text-[10px] font-medium uppercase tracking-wide">{item.priority}</Badge>
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Page {queueState.pagination.page} of {queueState.pagination.totalPages} - {queueState.pagination.totalItems} records
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={queueState.pagination.page <= 1}
                onClick={() =>
                  updateRoute({
                    page: queueState.pagination.page - 1,
                  })
                }
              >
                <IconChevronLeft className="size-3.5" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={queueState.pagination.page >= queueState.pagination.totalPages}
                onClick={() =>
                  updateRoute({
                    page: queueState.pagination.page + 1,
                  })
                }
              >
                Next
                <IconChevronRight className="size-3.5" />
              </Button>
            </div>
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

          {actionItem ? (
            <div className="space-y-3 border border-border/60 bg-muted/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label="Leave Type"
                  value={actionItem.kind === "LEAVE" ? actionItem.leaveTypeName ?? "-" : "N/A (Overtime Request)"}
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Supervisor Status</p>
                  {actionItem.supervisorApprovedAt === "-" ? (
                    <Badge variant="secondary">Pending Supervisor Approval</Badge>
                  ) : (
                    <Badge>Supervisor Approved</Badge>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Request Date</p>
                <p className="whitespace-normal break-words text-sm text-foreground">{actionItem.scheduleLabel}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Reason</p>
                <Input
                  value={actionItem.reason}
                  readOnly
                  className="h-9"
                />
              </div>
            </div>
          ) : null}

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
    <div className="grid grid-cols-2 items-center bg-background px-3 py-2.5">
      <div className="min-w-0">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted text-foreground">{icon}</span>
        <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="text-right text-lg font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  )
}
