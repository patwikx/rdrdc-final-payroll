"use client"

import { useMemo, useState, type ReactNode } from "react"
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

  const updateRoute = (updates: {
    q?: string
    action?: ActionFilter
    range?: RangeFilter
    table?: string | null
    page?: number
  }) => {
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

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.push(nextUrl)
  }

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
    <div className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <div className="flex flex-col justify-between gap-6 border-b border-border/60 px-8 pb-8 pt-8 md:flex-row md:items-end">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">System Settings</p>
          <div className="flex items-center gap-4">
            <h1 className="inline-flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
              <IconHistory className="h-7 w-7" />
              Audit Logs
            </h1>
            <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
              {data.companyName}
            </div>
            <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
              {data.pagination.totalItems.toLocaleString("en-PH")} Records
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="border-border/60 hover:bg-muted/50" onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-border/60 bg-muted/10 px-8 py-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.id} className="rounded-lg border border-border/60 bg-background p-3">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
              <item.icon className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-lg font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex min-h-[calc(100vh-260px)] flex-col lg:flex-row">
        <aside className="w-full shrink-0 space-y-8 border-r border-border/60 bg-background/50 p-6 backdrop-blur-sm lg:w-72">
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">Search Logs</h3>
            <div className="group relative">
              <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Actor, table, reason..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch()
                }}
                className="border-border/60 bg-muted/20 pl-9"
              />
            </div>
            <Button type="button" variant="outline" className="w-full border-border/60" onClick={applySearch}>
              Apply Search
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IconRefresh className="h-3 w-3" />
              Action Type
            </h3>
            <div className="flex flex-wrap gap-2">
              {ACTION_OPTIONS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={data.actionFilter === item.value ? "default" : "outline"}
                  onClick={() => updateRoute({ action: item.value, page: 1 })}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IconClockHour4 className="h-3 w-3" />
              Time Range
            </h3>
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={data.rangeFilter === item.value ? "default" : "outline"}
                  onClick={() => updateRoute({ range: item.value, page: 1 })}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconDatabase className="h-3 w-3" />
              Data Table
            </h3>
            <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-border/60 bg-muted/20 p-2">
              <button
                type="button"
                onClick={() => updateRoute({ table: null, page: 1 })}
                className={cn(
                  "w-full rounded-md border px-2.5 py-2 text-left text-sm font-medium leading-5 transition-colors",
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
                    "w-full rounded-md border px-2.5 py-2 text-left text-sm font-medium leading-5 transition-colors",
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

        <main className="flex flex-1 flex-col bg-background p-0">
          <div className="sticky top-0 z-10 border-b border-border/60 bg-muted/10">
            <div
              className={cn(
                "grid h-10 items-center gap-5 px-8 text-xs font-medium uppercase tracking-wide text-muted-foreground",
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

          <div className="flex-1 divide-y divide-border/60 bg-background">
            {data.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
                <div className="rounded-md border border-border/60 bg-muted/20 p-4">
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
                    "group grid w-full items-center gap-5 px-8 py-4 text-left transition-colors hover:bg-muted/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
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
            <div className="sticky bottom-0 flex h-12 items-center justify-between border-t border-border/60 bg-background px-8">
              <div className="text-xs text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages} • {data.pagination.totalItems.toLocaleString("en-PH")} Logs
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.pagination.hasPrevPage}
                  onClick={() => updateRoute({ page: data.pagination.page - 1 })}
                  className="border-border/60 hover:bg-muted/50 disabled:opacity-30"
                >
                  <IconChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.pagination.hasNextPage}
                  onClick={() => updateRoute({ page: data.pagination.page + 1 })}
                  className="border-border/60 hover:bg-muted/50 disabled:opacity-30"
                >
                  Next
                  <IconChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </main>
      </div>

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
    </div>
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
