"use client"

import { signOut } from "next-auth/react"
import { IconLogout } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"

type EmployeePortalHeaderProps = {
  companyName: string
}

export function EmployeePortalHeader({ companyName }: EmployeePortalHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border/60 bg-muted/30 px-4 sm:px-6">
      <div className="flex items-center gap-2.5">
        <SidebarTrigger />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Employee Self-Service Portal</p>
          <p className="truncate text-sm font-semibold text-foreground">{companyName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-lg"
        >
          <IconLogout className="mr-2 size-4" />
          Logout
        </Button>
      </div>
    </header>
  )
}
