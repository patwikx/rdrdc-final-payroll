"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { IconArrowRight, IconFilter, IconHistory, IconSparkles } from "@tabler/icons-react"

import { EMPLOYEE_PORTAL_CHANGE_LOG_ENTRIES, type EmployeePortalChangeLogEntry } from "@/components/employee-portal/employee-portal-changelog-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { SYSTEM_UPDATE_ENTRIES, type SystemUpdateEntry } from "@/system-update-notes"

type ReleaseTypeFilter = "all" | EmployeePortalChangeLogEntry["type"]
type SourceFilter = "all" | "portal" | "system"

type UnifiedChangeLogEntry = {
  id: string
  version: string
  date: string
  type: "major" | "minor" | "patch"
  title: string
  changes: string[]
  source: "portal" | "system"
  moduleLabel: string
  commit: string | null
  relatedRoute: string | null
  legacyParity: boolean | null
}

type EmployeePortalChangeLogPageProps = {
  companyId: string
}

const monthLabel = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" })
const shortDateLabel = new Intl.DateTimeFormat("en-PH", { month: "short", day: "2-digit", timeZone: "Asia/Manila" })

const moduleLabels: Record<EmployeePortalChangeLogEntry["module"], string> = {
  EMPLOYEE_PORTAL: "Employee Portal",
  MATERIAL_REQUESTS: "Material Requests",
  LEAVE_OVERTIME: "Leave & Overtime",
  NOTIFICATIONS: "Notifications",
}

const typeToneClass: Record<UnifiedChangeLogEntry["type"], string> = {
  major: "border-destructive/60 bg-destructive/10 text-destructive",
  minor: "border-emerald-600/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  patch: "border-blue-600/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
}

const mapPortalEntry = (entry: EmployeePortalChangeLogEntry): UnifiedChangeLogEntry => {
  return {
    id: `portal-${entry.id}`,
    version: entry.version,
    date: entry.date,
    type: entry.type,
    title: entry.title,
    changes: entry.changes,
    source: "portal",
    moduleLabel: moduleLabels[entry.module],
    commit: entry.commit,
    relatedRoute: entry.relatedRoute ?? null,
    legacyParity: entry.legacyParity,
  }
}

const mapSystemEntry = (entry: SystemUpdateEntry): UnifiedChangeLogEntry => {
  return {
    id: `system-${entry.version}-${entry.date}`,
    version: entry.version,
    date: entry.date,
    type: entry.type,
    title: entry.title,
    changes: entry.changes,
    source: "system",
    moduleLabel: "Core System",
    commit: null,
    relatedRoute: null,
    legacyParity: null,
  }
}

const toDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`)

export function EmployeePortalChangeLogPage({ companyId }: EmployeePortalChangeLogPageProps) {
  const [typeFilter, setTypeFilter] = useState<ReleaseTypeFilter>("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [versionFilter, setVersionFilter] = useState<string>("all")

  const allEntries = useMemo(() => {
    const merged = [...EMPLOYEE_PORTAL_CHANGE_LOG_ENTRIES.map(mapPortalEntry), ...SYSTEM_UPDATE_ENTRIES.map(mapSystemEntry)]
    return merged.sort((a, b) => {
      const dateDiff = toDate(b.date).getTime() - toDate(a.date).getTime()
      if (dateDiff !== 0) return dateDiff
      return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: "base" })
    })
  }, [])

  const versionOptions = useMemo(() => {
    return Array.from(new Set(allEntries.map((entry) => entry.version)))
  }, [allEntries])

  const filteredEntries = useMemo(() => {
    return allEntries.filter((entry) => {
      const matchesType = typeFilter === "all" || entry.type === typeFilter
      const matchesSource = sourceFilter === "all" || entry.source === sourceFilter
      const matchesVersion = versionFilter === "all" || entry.version === versionFilter
      return matchesType && matchesSource && matchesVersion
    })
  }, [allEntries, sourceFilter, typeFilter, versionFilter])

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, UnifiedChangeLogEntry[]>()
    for (const entry of filteredEntries) {
      const key = monthLabel.format(toDate(entry.date))
      const rows = groups.get(key) ?? []
      rows.push(entry)
      groups.set(key, rows)
    }
    return Array.from(groups.entries())
  }, [filteredEntries])

  const currentVersion = allEntries[0]?.version ?? "-"

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.35) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at top, black 30%, transparent 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-muted/40 via-background/40 to-background" />

      <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <header className="border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="inline-flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              <IconHistory className="h-7 w-7 text-primary" />
              Changelog
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Version</span>
              <Badge variant="outline" className="font-mono text-[11px]">
                v{currentVersion}
              </Badge>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Employee Portal and system release history with version controls and timeline grouping.
          </p>
        </header>

        <section className="mt-5 flex flex-wrap items-center gap-2 border-b border-border/60 pb-4">
          <Button
            type="button"
            size="sm"
            variant={typeFilter === "all" ? "default" : "outline"}
            className="h-8 px-3"
            onClick={() => setTypeFilter("all")}
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={typeFilter === "major" ? "default" : "outline"}
            className="h-8 px-3"
            onClick={() => setTypeFilter("major")}
          >
            Major
          </Button>
          <Button
            type="button"
            size="sm"
            variant={typeFilter === "minor" ? "default" : "outline"}
            className="h-8 px-3"
            onClick={() => setTypeFilter("minor")}
          >
            Minor
          </Button>
          <Button
            type="button"
            size="sm"
            variant={typeFilter === "patch" ? "default" : "outline"}
            className="h-8 px-3"
            onClick={() => setTypeFilter("patch")}
          >
            Patch
          </Button>

          <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as SourceFilter)}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="portal">Employee Portal</SelectItem>
              <SelectItem value="system">Core System</SelectItem>
            </SelectContent>
          </Select>

          <Select value={versionFilter} onValueChange={setVersionFilter}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue placeholder="Version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Versions</SelectItem>
              {versionOptions.map((version) => (
                <SelectItem key={version} value={version}>
                  v{version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto h-8 px-3"
            onClick={() => {
              setTypeFilter("all")
              setSourceFilter("all")
              setVersionFilter("all")
            }}
          >
            <IconFilter className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        </section>

        <section className="mt-5 space-y-7">
          {groupedByMonth.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/70 p-8 text-center text-sm text-muted-foreground">
              No changelog entries match the selected controls.
            </div>
          ) : (
            groupedByMonth.map(([month, rows]) => (
              <div key={month}>
                <h2 className="mb-3 text-2xl font-semibold tracking-tight text-foreground">{month}</h2>
                <div className="rounded-xl border border-border/60 bg-background/75 backdrop-blur">
                  {rows.map((entry) => (
                    <article key={entry.id} className="border-b border-border/60 px-4 py-4 last:border-b-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs uppercase text-muted-foreground">
                              {shortDateLabel.format(toDate(entry.date))}
                            </span>
                            <Badge className={cn("border text-[10px] uppercase", typeToneClass[entry.type])}>
                              {entry.type}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              v{entry.version}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {entry.moduleLabel}
                            </Badge>
                            {entry.commit ? (
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {entry.commit}
                              </Badge>
                            ) : null}
                            {entry.legacyParity ? (
                              <Badge variant="outline" className="text-[10px]">
                                Legacy Parity
                              </Badge>
                            ) : null}
                          </div>
                          <h3 className="text-lg font-semibold text-foreground">{entry.title}</h3>
                          <ul className="space-y-1">
                            {entry.changes.map((change) => (
                              <li key={`${entry.id}-${change}`} className="text-sm text-muted-foreground">
                                - {change}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {entry.relatedRoute ? (
                          <Link
                            href={`/${companyId}${entry.relatedRoute}`}
                            className="inline-flex items-center gap-1 self-start rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                          >
                            Open
                            <IconArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground">
                            <IconSparkles className="h-3.5 w-3.5" />
                            System release
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
