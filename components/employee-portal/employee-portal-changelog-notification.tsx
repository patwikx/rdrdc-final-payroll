"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { IconAlertCircle, IconBell, IconCheck, IconHistory, IconSparkles } from "@tabler/icons-react"

import {
  EMPLOYEE_PORTAL_CHANGE_LOG_ENTRIES,
  EMPLOYEE_PORTAL_CHANGE_LOG_LATEST_ID,
  type EmployeePortalChangeLogEntry,
} from "@/components/employee-portal/employee-portal-changelog-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type EmployeePortalChangelogNotificationProps = {
  companyId: string
  userEmail: string
}

const moduleLabel: Record<EmployeePortalChangeLogEntry["module"], string> = {
  EMPLOYEE_PORTAL: "Employee Portal",
  MATERIAL_REQUESTS: "Material Requests",
  LEAVE_OVERTIME: "Leave & Overtime",
  NOTIFICATIONS: "Notifications",
}

const getUpdateIcon = (type: EmployeePortalChangeLogEntry["type"]) => {
  if (type === "major") {
    return <IconSparkles className="h-4 w-4 text-orange-500" />
  }

  if (type === "minor") {
    return <IconCheck className="h-4 w-4 text-green-500" />
  }

  return <IconAlertCircle className="h-4 w-4 text-blue-500" />
}

const getTypeBadgeVariant = (
  type: EmployeePortalChangeLogEntry["type"]
): "destructive" | "default" | "secondary" => {
  if (type === "major") {
    return "destructive"
  }

  if (type === "minor") {
    return "default"
  }

  return "secondary"
}

const buildStorageKey = (params: { companyId: string; userEmail: string }): string => {
  const normalizedEmail = params.userEmail.trim().toLowerCase() || "anonymous"
  return `employee-portal:changelog:last-seen:${params.companyId}:${normalizedEmail}`
}

const countUnreadEntries = (lastSeenId: string | null): number => {
  if (!lastSeenId) {
    return EMPLOYEE_PORTAL_CHANGE_LOG_ENTRIES.length
  }

  const seenIndex = EMPLOYEE_PORTAL_CHANGE_LOG_ENTRIES.findIndex((entry) => entry.id === lastSeenId)
  if (seenIndex < 0) {
    return EMPLOYEE_PORTAL_CHANGE_LOG_ENTRIES.length
  }

  return seenIndex
}

export function EmployeePortalChangelogNotification({
  companyId,
  userEmail,
}: EmployeePortalChangelogNotificationProps) {
  const [open, setOpen] = useState(false)
  const [hasAutoOpened, setHasAutoOpened] = useState(false)
  const [hasLoadedSeenState, setHasLoadedSeenState] = useState(false)
  const [lastSeenId, setLastSeenId] = useState<string | null>(null)
  const storageKey = useMemo(() => buildStorageKey({ companyId, userEmail }), [companyId, userEmail])
  const unreadCount = countUnreadEntries(lastSeenId)

  const markAsRead = () => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(storageKey, EMPLOYEE_PORTAL_CHANGE_LOG_LATEST_ID)
    setLastSeenId(EMPLOYEE_PORTAL_CHANGE_LOG_LATEST_ID)
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const stored = window.localStorage.getItem(storageKey)
    setLastSeenId(stored)
    setHasLoadedSeenState(true)
  }, [storageKey])

  useEffect(() => {
    if (!hasLoadedSeenState || hasAutoOpened) {
      return
    }

    if (unreadCount > 0) {
      setOpen(true)
    }
    setHasAutoOpened(true)
  }, [hasAutoOpened, hasLoadedSeenState, unreadCount])

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && open) {
      markAsRead()
    }

    setOpen(nextOpen)
  }

  const currentVersion = EMPLOYEE_PORTAL_CHANGE_LOG_ENTRIES[0]?.version ?? "2.0.0"
  const currentVersionDate = EMPLOYEE_PORTAL_CHANGE_LOG_ENTRIES[0]?.date ?? "-"

  return (
    <Popover open={open} onOpenChange={handleDialogOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative"
              aria-label="Open employee portal change log"
              title="Employee Portal Change Log"
            >
              <IconBell className="size-4" />
              {hasLoadedSeenState && unreadCount > 0 ? (
                <>
                  <span className="bg-primary text-primary-foreground absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                  <span className="bg-primary absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" />
                </>
              ) : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Employee Portal Updates</p>
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-[28rem] max-w-[calc(100vw-1rem)] p-0">
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-medium leading-none">
              <IconHistory className="h-4 w-4" />
              Employee Portal Updates
            </h4>
            <p className="text-sm text-muted-foreground">
              Recent improvements compared against the legacy workflow.
            </p>
          </div>

          <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
            {EMPLOYEE_PORTAL_CHANGE_LOG_ENTRIES.map((entry, index) => {
              const isUnread = hasLoadedSeenState ? index < unreadCount : false

              return (
                <div key={entry.id} className="space-y-2 border-b pb-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getUpdateIcon(entry.type)}
                      <span className="text-sm font-medium">v{entry.version}</span>
                      <Badge variant={getTypeBadgeVariant(entry.type)} className="text-xs">
                        {entry.type}
                      </Badge>
                      {isUnread ? (
                        <Badge variant="outline" className="text-xs">
                          New
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">{entry.date}</span>
                  </div>

                  <h5 className="text-sm font-medium">{entry.title}</h5>

                  <ul className="space-y-1">
                    {entry.changes.map((change, changeIndex) => (
                      <li key={`${entry.id}-change-${changeIndex}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="mt-1 text-green-500">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                      {moduleLabel[entry.module]}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                      {entry.commit}
                    </Badge>
                    {entry.legacyParity ? (
                      <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                        Legacy Parity
                      </Badge>
                    ) : null}
                  </div>

                  {entry.relatedRoute ? (
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                      <Link href={`/${companyId}${entry.relatedRoute}`} onClick={() => setOpen(false)}>
                        Open Related Page
                      </Link>
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between border-t pt-2">
            <p className="text-xs text-muted-foreground">
              Current version: <span className="font-mono font-medium">v{currentVersion}</span> • Last updated: {currentVersionDate}
            </p>
            <Button
              type="button"
              size="sm"
              variant={unreadCount > 0 ? "default" : "outline"}
              onClick={() => {
                markAsRead()
                setOpen(false)
              }}
            >
              {unreadCount > 0 ? "Mark As Read" : "Close"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
