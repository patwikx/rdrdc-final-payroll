"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconAlertTriangle,
  IconCloudUpload,
  IconInfoCircle,
  IconPlayerPlay,
  IconRefresh,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { syncLegacyEmployeesAction } from "@/modules/settings/employment/actions/sync-legacy-employees-action"
import type { SyncLegacyEmployeesInput } from "@/modules/settings/employment/schemas/sync-legacy-employees-schema"

type LegacyEmployeeSyncPageProps = {
  companyId: string
  companyName: string
}

type SyncResult = Awaited<ReturnType<typeof syncLegacyEmployeesAction>>

const Required = () => <span className="ml-1 text-destructive">*</span>

export function LegacyEmployeeSyncPage({ companyId, companyName }: LegacyEmployeeSyncPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SyncResult | null>(null)

  const [form, setForm] = useState<SyncLegacyEmployeesInput>({
    companyId,
    baseUrl: "",
    legacyScopeId: "",
    apiToken: "",
    employeeEndpoint: "/api/migration/employees",
    timeoutMs: 30000,
    dryRun: true,
  })

  const summaryRows = useMemo(() => {
    if (!result || !result.ok) return []

    return [
      { label: "Fetched Legacy Employees", value: result.summary.fetched },
      { label: "Processed Rows", value: result.summary.processed },
      { label: "Skipped Already Matched", value: result.summary.skippedAlreadyMatched },
      { label: "Created Users", value: result.summary.createdUsers },
      { label: "Created Employees", value: result.summary.createdEmployees },
      { label: "Linked Records", value: result.summary.linkedExisting },
      { label: "Conflicts", value: result.summary.conflicts },
      { label: "Invalid Rows", value: result.summary.invalidRows },
      { label: "Errors", value: result.summary.errors },
    ]
  }, [result])

  const handleRunSync = () => {
    startTransition(async () => {
      const response = await syncLegacyEmployeesAction({
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
          <IconUsers className="size-5" />
          Legacy Employee Sync
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sync employee profiles and user login accounts from your legacy system into {companyName}.
        </p>
      </header>

      <section className="space-y-6 px-4 py-6 sm:px-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Legacy API Connection</CardTitle>
            <CardDescription>
              Old `employeeId` will map to new `username` and `employeeNumber`. Existing matched rows are skipped.
            </CardDescription>
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
                <Label htmlFor="apiToken">API Token</Label>
                <Input
                  id="apiToken"
                  type="password"
                  placeholder="Bearer token from legacy system"
                  value={form.apiToken ?? ""}
                  onChange={(event) => setForm((previous) => ({ ...previous, apiToken: event.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="legacyScopeId">Legacy Business Unit ID</Label>
                <Input
                  id="legacyScopeId"
                  placeholder="Optional. If blank, current companyId is used."
                  value={form.legacyScopeId ?? ""}
                  onChange={(event) => setForm((previous) => ({ ...previous, legacyScopeId: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeEndpoint">
                  Employee Endpoint<Required />
                </Label>
                <Input
                  id="employeeEndpoint"
                  value={form.employeeEndpoint}
                  onChange={(event) => setForm((previous) => ({ ...previous, employeeEndpoint: event.target.value }))}
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
                  Dry run evaluates employee/user matching without writing records.
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
                    employeeEndpoint: "/api/migration/employees",
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
                  <CardTitle className="text-base">Conflicts</CardTitle>
                  <CardDescription>First 200 conflict rows.</CardDescription>
                </CardHeader>
                <CardContent>
                  {result.conflicts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No conflicts found.</p>
                  ) : (
                    <ScrollArea className="h-72 pr-3">
                      <div className="space-y-2">
                        {result.conflicts.map((item, index) => (
                          <div key={`${item.employeeId}-${String(index)}`} className="rounded-md border border-border/60 px-3 py-2">
                            <p className="text-xs font-medium uppercase text-foreground">{item.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.employeeId} · {item.name}
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
                  <CardTitle className="text-base">Invalid Rows</CardTitle>
                  <CardDescription>First 200 invalid legacy rows.</CardDescription>
                </CardHeader>
                <CardContent>
                  {result.invalidRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No invalid rows.</p>
                  ) : (
                    <ScrollArea className="h-72 pr-3">
                      <div className="space-y-2">
                        {result.invalidRows.map((item, index) => (
                          <div key={`${item.employeeId}-${String(index)}`} className="rounded-md border border-border/60 px-3 py-2">
                            <p className="text-xs font-medium uppercase text-foreground">{item.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.employeeId || "(no id)"} · {item.name}
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
                          <div key={`${item.employeeId}-${String(index)}`} className="rounded-md border border-border/60 px-3 py-2">
                            <p className="text-xs font-medium uppercase text-foreground">
                              {item.employeeId || "(no id)"}
                            </p>
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
                Recommended: dry run first, check conflicts/invalid rows, then apply sync.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  )
}

