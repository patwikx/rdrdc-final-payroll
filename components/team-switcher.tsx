"use client"

import * as React from "react"
import { IconBuilding, IconCheck, IconPlus, IconSelector } from "@tabler/icons-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type TeamOption = {
  id: string
  name: string
  code: string
  plan: string
}

export function TeamSwitcher({
  teams,
  activeTeamId,
  onTeamChange,
}: {
  teams: TeamOption[]
  activeTeamId?: string
  onTeamChange?: (teamId: string) => void | Promise<void>
}) {
  const { isMobile } = useSidebar()

  const activeTeam = React.useMemo(() => {
    if (!activeTeamId) return teams[0]
    return teams.find((t) => t.id === activeTeamId) ?? teams[0]
  }, [activeTeamId, teams])

  if (!activeTeam) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <IconBuilding className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeTeam.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeTeam.code} · {activeTeam.plan}
                </span>
              </div>
              <IconSelector className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Companies
            </DropdownMenuLabel>

            {teams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => void onTeamChange?.(team.id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <IconBuilding className="size-3.5" />
                </div>
                <div className="grid flex-1 leading-tight">
                  <span className="truncate text-sm font-medium">{team.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {team.code}
                  </span>
                </div>
                {team.id === activeTeamId && (
                  <IconCheck className="ml-auto size-4 text-sidebar-primary" />
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem className="gap-2 p-2" disabled>
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <IconPlus className="size-4" />
              </div>
              <span className="text-muted-foreground">Add company</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
