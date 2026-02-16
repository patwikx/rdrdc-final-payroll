"use client"

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconChevronLeft,
  IconChevronRight,
  IconClockHour4,
  IconDatabase,
  IconHistory,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUserCircle,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { AuditLogsViewModel } from "@/modules/audit/utils/get-audit-logs-view-model"

type AuditLogsPageProps = {
  data: AuditLogsViewModel
}

type ActionFilter = AuditLogsViewModel["actionFilter"]
type RangeFilter = AuditLogsViewModel["rangeFilter"]
type RouteUpdates = {
  q?: string
  action?: ActionFilter
  range?: RangeFilter
  table?: string | null
  page?: number
}

const AUDIT_GRID_COLUMNS =
  "grid-cols-[minmax(190px,_1.35fr)_minmax(170px,_1fr)_minmax(180px,_1.1fr)_110px_minmax(280px,_2.1fr)]"

const ACTION_OPTIONS: Array<{ label: string; value: ActionFilter }> = [
  { label: "All Actions", value: "ALL" },
  { label: "Create", value: "CREATE" },
  { label: "Update", value: "UPDATE" },
  { label: "Delete", value: "DELETE" },
  { label: "Restore", value: "RESTORE" },
]

const RANGE_OPTIONS: Array<{ label: string; value: RangeFilter }> = [
  { label: "24 Hours", value: "24H" },
  { label: "7 Days", value: "7D" },
  { label: "30 Days", value: "30D" },
  { label: "All Time", value: "ALL" },
]

const shorten = (value: string | null, maxLength = 80): string => {
  if (!value) return "-"
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

const prettifyAuditValue = (value: string | null): string => {
  if (!value) return "-"
  const trimmed = value.trim()
  if (!trimmed) return "-"

  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    } catch {
      return value
    }
  }

  return value
}

export function AuditLogsPage({ data }: AuditLogsPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isRoutePending, startRouteTransition] = useTransition()

  const [searchInput, setSearchInput] = useState(data.query)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  const selectedRow = useMemo(
    () => data.rows.find((row) => row.id === selectedRowId) ?? null,
    [data.rows, selectedRowId]
  )

  const stats = useMemo(
    () => [
      {
        id: "total",
        label: "Visible Logs",
        value: data.summary.totalVisible.toLocaleString("en-PH"),
        icon: IconHistory,
      },
      {
        id: "create",
        label: "Create Events",
        value: data.summary.createCount.toLocaleString("en-PH"),
        icon: IconPlus,
      },
      {
        id: "update",
        label: "Update Events",
        value: data.summary.updateCount.toLocaleString("en-PH"),
        icon: IconRefresh,
      },
      {
        id: "delete",
        label: "Delete Events",
        value: data.summary.deleteCount.toLocaleString("en-PH"),
        icon: IconTrash,
      },
    ],
    [data.summary]
  )

  const buildNextUrl = useCallback((updates: RouteUpdates) => {
    const params = new URLSearchParams(searchParams.toString())

    if (typeof updates.q !== "undefined") {
      const value = updates.q.trim()
      if (value) params.set("q", value)
      else params.delete("q")
    }

    if (typeof updates.action !== "undefined") {
      if (updates.action === "ALL") params.delete("action")
      else params.set("action", updates.action)
    }

    if (typeof updates.range !== "undefined") {
      if (updates.range === "30D") params.delete("range")
      else params.set("range", updates.range)
    }

    if (typeof updates.table !== "undefined") {
      if (updates.table && updates.table.trim().length > 0) params.set("table", updates.table)
      else params.delete("table")
    }

    if (typeof updates.page !== "undefined") {
      if (updates.page > 1) params.set("page", String(updates.page))
      else params.delete("page")
    }

    return params.toString() ? `${pathname}?${params.toString()}` : pathname
  }, [pathname, searchParams])

  const updateRoute = useCallback((updates: RouteUpdates, options?: { replace?: boolean }) => {
    const nextUrl = buildNextUrl(updates)
    startRouteTransition(() => {
      if (options?.replace) {
        router.replace(nextUrl, { scroll: false })
        return
      }
      router.push(nextUrl, { scroll: false })
    })
  }, [buildNextUrl, router])

  useEffect(() => {
    if (data.pagination.hasPrevPage) {
      router.prefetch(buildNextUrl({ page: data.pagination.page - 1 }))
    }
    if (data.pagination.hasNextPage) {
      router.prefetch(buildNextUrl({ page: data.pagination.page + 1 }))
    }
  }, [
    buildNextUrl,
    data.pagination.hasNextPage,
    data.pagination.hasPrevPage,
    data.pagination.page,
    router,
  ])

  const applySearch = () => {
    updateRoute({
      q: searchInput,
      page: 1,
    })
  }

  const resetFilters = () => {
    setSearchInput("")
    updateRoute({
      q: "",
      action: "ALL",
      range: "30D",
      table: null,
      page: 1,
    })
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">System Settings</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconHistory className="size-6 text-primary" />
                Audit Logs
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                {data.companyName}
              </Badge>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                {data.pagination.totalItems.toLocaleString("en-PH")} Records
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Review the full system audit trail with filterable event history.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border border-border/60 bg-background/90 p-2">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 border border-border/60 bg-background p-4">
          <div className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Search Logs</h3>
            <div className="group relative">
              <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Actor, table, reason..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch()
                }}
                className="pl-9"
              />
            </div>
            <Button type="button" variant="outline" className="h-8 w-full px-2" onClick={applySearch}>
              Apply Search
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconRefresh className="h-3.5 w-3.5" />
              Action Type
            </h3>
            <div className="flex flex-wrap gap-2">
              {ACTION_OPTIONS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  className="h-8 px-2"
                  variant={data.actionFilter === item.value ? "default" : "outline"}
                  onClick={() => updateRoute({ action: item.value, page: 1 })}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconClockHour4 className="h-3.5 w-3.5" />
              Time Range
            </h3>
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  className="h-8 px-2"
                  variant={data.rangeFilter === item.value ? "default" : "outline"}
                  onClick={() => updateRoute({ range: item.value, page: 1 })}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconDatabase className="h-3.5 w-3.5" />
              Data Table
            </h3>
            <div className="max-h-64 space-y-1 overflow-auto border border-border/60 bg-muted/20 p-2">
              <button
                type="button"
                onClick={() => updateRoute({ table: null, page: 1 })}
                className={cn(
                  "w-full border px-2.5 py-2 text-left text-sm transition-colors",
                  !data.tableFilter
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-transparent text-foreground/90 hover:bg-muted"
                )}
              >
                All Tables
              </button>
              {data.availableTables.map((tableName) => (
                <button
                  key={tableName}
                  type="button"
                  onClick={() => updateRoute({ table: tableName, page: 1 })}
                  className={cn(
                    "w-full border px-2.5 py-2 text-left text-sm transition-colors",
                    data.tableFilter === tableName
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-transparent text-foreground/90 hover:bg-muted"
                  )}
                >
                  {tableName}
                </button>
              ))}
              {data.availableTables.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">No tables available for this filter set.</p>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="border border-border/60 bg-background">
          <div className="grid gap-2 border-b border-border/60 px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <div key={item.id} className="border border-border/60 bg-background px-3 py-2">
                <div className="inline-flex h-6 w-6 items-center justify-center border border-border/60 bg-muted text-foreground">
                  <item.icon className="h-3.5 w-3.5" />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p>
                <p className="text-base font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="sticky top-0 z-10 border-b border-border/60 bg-muted/10">
            <div
              className={cn(
                "grid h-10 items-center gap-5 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                AUDIT_GRID_COLUMNS
              )}
            >
              <div>Timestamp (PH)</div>
              <div>Actor</div>
              <div>Table / Record</div>
              <div>Action</div>
              <div>Details</div>
            </div>
          </div>

          <div className="divide-y divide-border/60 bg-background">
            {data.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                <div className="border border-border/60 bg-muted/20 p-4">
                  <IconSearch className="h-8 w-8 text-muted-foreground/70" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No audit logs found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search and filter criteria.</p>
                </div>
              </div>
            ) : (
              data.rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedRowId(row.id)}
                  className={cn(
                    "group grid w-full items-center gap-5 px-4 py-3 text-left transition-colors hover:bg-muted/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    AUDIT_GRID_COLUMNS
                  )}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{row.createdAtLabel}</p>
                    <p className="text-xs text-muted-foreground">{row.createdAtIso}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <IconUserCircle className="h-4 w-4 text-muted-foreground" />
                      {row.actorName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{row.actorUsername ?? "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="truncate text-sm font-medium text-foreground">{row.tableName}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.recordId}</p>
                  </div>

                  <div>
                    <AuditActionBadge action={row.action} />
                  </div>

                  <div className="space-y-1">
                    <p className="truncate text-sm text-foreground">
                      {row.reason ? row.reason : row.fieldName ? `Field: ${row.fieldName}` : "No reason provided"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.fieldName ? `${row.fieldName}: ` : ""}
                      {shorten(row.oldValue, 45)} → {shorten(row.newValue, 45)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">IP: {row.ipAddress ?? "-"}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {data.pagination.totalItems > 0 ? (
            <div className="flex h-12 items-center justify-between border-t border-border/60 bg-background px-4">
              <div className="text-xs text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages} • {data.pagination.totalItems.toLocaleString("en-PH")} Logs
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={!data.pagination.hasPrevPage || isRoutePending}
                  onClick={() => updateRoute({ page: data.pagination.page - 1 }, { replace: true })}
                >
                  <IconChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={!data.pagination.hasNextPage || isRoutePending}
                  onClick={() => updateRoute({ page: data.pagination.page + 1 }, { replace: true })}
                >
                  Next
                  <IconChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </section>

      <Dialog open={Boolean(selectedRow)} onOpenChange={(open) => (!open ? setSelectedRowId(null) : undefined)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>

          {selectedRow ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="Action">
                  <AuditActionBadge action={selectedRow.action} />
                </DetailItem>
                <DetailItem label="Timestamp (PH)">{selectedRow.createdAtLabel}</DetailItem>
                <DetailItem label="Table">{selectedRow.tableName}</DetailItem>
                <DetailItem label="Record ID">{selectedRow.recordId}</DetailItem>
                <DetailItem label="Actor">{selectedRow.actorName}</DetailItem>
                <DetailItem label="Username">{selectedRow.actorUsername ?? "-"}</DetailItem>
                <DetailItem label="Field">{selectedRow.fieldName ?? "-"}</DetailItem>
                <DetailItem label="Reason">{selectedRow.reason ?? "-"}</DetailItem>
                <DetailItem label="IP Address">{selectedRow.ipAddress ?? "-"}</DetailItem>
                <DetailItem label="User Agent">{selectedRow.userAgent ?? "-"}</DetailItem>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Old Value</p>
                <pre className="max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-foreground">
                  {prettifyAuditValue(selectedRow.oldValue)}
                </pre>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New Value</p>
                <pre className="max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-foreground">
                  {prettifyAuditValue(selectedRow.newValue)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  )
}

function AuditActionBadge({ action }: { action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" }) {
  if (action === "CREATE") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">CREATE</Badge>
  }
  if (action === "UPDATE") {
    return <Badge>UPDATE</Badge>
  }
  if (action === "DELETE") {
    return <Badge variant="destructive">DELETE</Badge>
  }
  return <Badge variant="secondary">RESTORE</Badge>
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-sm text-foreground">{children}</p>
    </div>
  )
}
