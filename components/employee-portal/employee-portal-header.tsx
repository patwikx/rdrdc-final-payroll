"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { IconLayoutDashboard } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"

type EmployeePortalHeaderProps = {
  companyName: string
  dashboardHref?: string | null
}

export function EmployeePortalHeader({ companyName, dashboardHref = null }: EmployeePortalHeaderProps) {
  return (
    <header className="flex min-h-14 items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-2 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <SidebarTrigger />
        <div className="min-w-0 max-w-[150px] sm:max-w-none">
          <p className="text-xs text-muted-foreground">Employee Self-Service Portal</p>
          <p className="truncate text-sm font-semibold text-foreground">{companyName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {dashboardHref ? (
          <Button
            asChild
            variant="outline"
            size="icon"
            className="sm:hidden"
            aria-label="Open HR / Payroll workspace"
            title="HR / Payroll Workspace"
          >
            <Link href={dashboardHref}>
              <IconLayoutDashboard className="size-4" />
            </Link>
          </Button>
        ) : null}
        {dashboardHref ? (
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link href={dashboardHref}>
              <IconLayoutDashboard className="mr-2 size-4" />
              HR / Payroll Workspace
            </Link>
          </Button>
        ) : null}
        <Button
          variant="ghost"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
        >
          Logout
        </Button>
      </div>
    </header>
  )
}
