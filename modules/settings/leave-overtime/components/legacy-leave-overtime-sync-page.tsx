"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconAlertTriangle,
  IconCloudUpload,
  IconDatabaseImport,
  IconInfoCircle,
  IconPlayerPlay,
  IconRefresh,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { syncLegacyLeaveOvertimeAction } from "@/modules/settings/leave-overtime/actions/sync-legacy-leave-overtime-action"
import type { SyncLegacyLeaveOvertimeInput } from "@/modules/settings/leave-overtime/schemas/sync-legacy-leave-overtime-schema"

type LegacyLeaveOvertimeSyncPageProps = {
  companyId: string
  companyName: string
}

type SyncResult = Awaited<ReturnType<typeof syncLegacyLeaveOvertimeAction>>

const Required = () => <span className="ml-1 text-destructive">*</span>

export function LegacyLeaveOvertimeSyncPage({ companyId, companyName }: LegacyLeaveOvertimeSyncPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SyncResult | null>(null)

  const [form, setForm] = useState<SyncLegacyLeaveOvertimeInput>({
    companyId,
    baseUrl: "",
    legacyScopeId: "",
    apiToken: "",
    leaveEndpoint: "/api/migration/leave-requests",
    overtimeEndpoint: "/api/migration/overtime-requests",
    balanceEndpoint: "/api/migration/leave-balances",
    timeoutMs: 30000,
    dryRun: true,
  })

  const summaryRows = useMemo(() => {
    if (!result || !result.ok) return []
    return [
      { label: "Fetched Leave Requests", value: result.summary.fetched.leaveRequests },
      { label: "Fetched Overtime Requests", value: result.summary.fetched.overtimeRequests },
      { label: "Fetched Leave Balances", value: result.summary.fetched.leaveBalances },
      { label: "Processed Leave Requests", value: result.summary.processed.leaveRequests },
      { label: "Processed Overtime Requests", value: result.summary.processed.overtimeRequests },
      { label: "Processed Leave Balances", value: result.summary.processed.leaveBalances },
      { label: "Created Leave Types", value: result.summary.processed.leaveTypesCreated },
      { label: "Unmatched Rows", value: result.summary.unmatchedCount },
      { label: "Skipped Rows", value: result.summary.skippedCount },
      { label: "Errors", value: result.summary.errorCount },
    ]
  }, [result])

  const handleRunSync = () => {
    startTransition(async () => {
      const response = await syncLegacyLeaveOvertimeAction({
        ...form,
        companyId,
      })
      setResult(response)

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <IconDatabaseImport className="size-5" />
          Legacy Leave / OT Sync
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import leave, overtime, and leave-balance history from your legacy system into {companyName}.
        </p>
      </header>

      <section className="space-y-6 px-4 py-6 sm:px-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Legacy API Connection</CardTitle>
            <CardDescription>Provide your old system API details, then run dry-run first before apply mode.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="baseUrl">
                  Legacy Base URL<Required />
                </Label>
                <Input
                  id="baseUrl"
                  placeholder="https://legacy.example.com"
                  value={form.baseUrl}
                  onChange={(event) => setForm((previous) => ({ ...previous, baseUrl: event.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="token">API Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Optional bearer token"
                  value={form.apiToken ?? ""}
                  onChange={(event) => setForm((previous) => ({ ...previous, apiToken: event.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="legacyScopeId">Legacy Business Unit ID</Label>
                <Input
                  id="legacyScopeId"
                  placeholder="Optional. If blank, current companyId is used as scope."
                  value={form.legacyScopeId ?? ""}
                  onChange={(event) => setForm((previous) => ({ ...previous, legacyScopeId: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leaveEndpoint">
                  Leave Endpoint<Required />
                </Label>
                <Input
                  id="leaveEndpoint"
                  value={form.leaveEndpoint}
                  onChange={(event) => setForm((previous) => ({ ...previous, leaveEndpoint: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="overtimeEndpoint">
                  Overtime Endpoint<Required />
                </Label>
                <Input
                  id="overtimeEndpoint"
                  value={form.overtimeEndpoint}
                  onChange={(event) => setForm((previous) => ({ ...previous, overtimeEndpoint: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="balanceEndpoint">
                  Leave Balance Endpoint<Required />
                </Label>
                <Input
                  id="balanceEndpoint"
                  value={form.balanceEndpoint}
                  onChange={(event) => setForm((previous) => ({ ...previous, balanceEndpoint: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeoutMs">
                  Timeout (ms)<Required />
                </Label>
                <Input
                  id="timeoutMs"
                  type="number"
                  min={5000}
                  max={120000}
                  value={String(form.timeoutMs)}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      timeoutMs: Number(event.target.value) || 30000,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Dry Run Mode</p>
                <p className="text-xs text-muted-foreground">
                  Dry run validates and matches data without writing records.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={form.dryRun ? "secondary" : "default"}>{form.dryRun ? "DRY RUN" : "APPLY"}</Badge>
                <Switch
                  checked={form.dryRun}
                  onCheckedChange={(checked) => setForm((previous) => ({ ...previous, dryRun: checked }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleRunSync} disabled={isPending} className="gap-2">
                {isPending ? <IconRefresh className="size-4 animate-spin" /> : <IconPlayerPlay className="size-4" />}
                {isPending ? "Running Sync..." : form.dryRun ? "Run Dry Sync" : "Run Apply Sync"}
              </Button>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  setForm({
                  companyId,
                  baseUrl: "",
                  legacyScopeId: "",
                  apiToken: "",
                    leaveEndpoint: "/api/migration/leave-requests",
                    overtimeEndpoint: "/api/migration/overtime-requests",
                    balanceEndpoint: "/api/migration/leave-balances",
                    timeoutMs: 30000,
                    dryRun: true,
                  })
                }
              >
                Reset Defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        {result?.ok ? (
          <>
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2 text-base">
                  <IconCloudUpload className="size-4" />
                  Sync Summary
                </CardTitle>
                <CardDescription>{result.message}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {summaryRows.map((row) => (
                  <div key={row.label} className="rounded-md border border-border/60 bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="text-base font-semibold text-foreground">{row.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">Unmatched Rows</CardTitle>
                  <CardDescription>First 200 unmatched records.</CardDescription>
                </CardHeader>
                <CardContent>
                  {result.unmatched.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No unmatched records.</p>
                  ) : (
                    <ScrollArea className="h-72 pr-3">
                      <div className="space-y-2">
                        {result.unmatched.map((item, index) => (
                          <div key={`${item.domain}-${item.legacyRecordId}-${String(index)}`} className="rounded-md border border-border/60 px-3 py-2">
                            <p className="text-xs font-medium uppercase text-foreground">{item.domain}</p>
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.employeeNumber || "NO-ID"} · {item.firstName || "?"} {item.lastName || "?"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">Skipped Rows</CardTitle>
                  <CardDescription>First 200 skipped records.</CardDescription>
                </CardHeader>
                <CardContent>
                  {result.skipped.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No skipped records.</p>
                  ) : (
                    <ScrollArea className="h-72 pr-3">
                      <div className="space-y-2">
                        {result.skipped.map((item, index) => (
                          <div key={`${item.domain}-${item.legacyRecordId}-${String(index)}`} className="rounded-md border border-border/60 px-3 py-2">
                            <p className="text-xs font-medium uppercase text-foreground">{item.domain}</p>
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                            <p className="text-xs text-muted-foreground">{item.legacyRecordId}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="inline-flex items-center gap-2 text-base">
                    <IconAlertTriangle className="size-4 text-destructive" />
                    Errors
                  </CardTitle>
                  <CardDescription>First 200 runtime errors.</CardDescription>
                </CardHeader>
                <CardContent>
                  {result.errors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No runtime errors.</p>
                  ) : (
                    <ScrollArea className="h-72 pr-3">
                      <div className="space-y-2">
                        {result.errors.map((item, index) => (
                          <div key={`${item.domain}-${String(index)}`} className="rounded-md border border-border/60 px-3 py-2">
                            <p className="text-xs font-medium uppercase text-foreground">{item.domain}</p>
                            <p className="text-xs text-muted-foreground">{item.message}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {!result ? (
          <Card className="border-border/60 bg-muted/10">
            <CardContent className="flex items-start gap-3 py-4">
              <IconInfoCircle className="mt-0.5 size-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Recommended flow: run <span className="font-medium text-foreground">Dry Sync</span> first, review unmatched/skipped rows, then switch off dry run and execute apply sync.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  )
}
