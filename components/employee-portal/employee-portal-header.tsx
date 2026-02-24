"use client"

import Link from "next/link"
import { IconLayoutDashboard } from "@tabler/icons-react"

import { EmployeePortalChangelogNotification } from "@/components/employee-portal/employee-portal-changelog-notification"
import { NavUser } from "@/components/nav-user"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"

type EmployeePortalHeaderProps = {
  companyId: string
  dashboardHref?: string | null
  accountHref: string
  user: {
    name: string
    email: string
    avatar?: string | null
  }
}

export function EmployeePortalHeader({
  companyId,
  dashboardHref = null,
  accountHref,
  user,
}: EmployeePortalHeaderProps) {
  return (
    <header className="flex min-h-14 items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-2 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <SidebarTrigger />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Employee Self-Service Portal</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <EmployeePortalChangelogNotification companyId={companyId} userEmail={user.email} />
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
        <NavUser user={user} accountHref={accountHref} inSidebar={false} compactOnMobile squareAvatar />
      </div>
    </header>
  )
}
