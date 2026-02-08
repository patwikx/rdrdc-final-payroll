"use client"

import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { IconPlus, IconSelector } from "@tabler/icons-react"

type TeamOption = {
  id: string
  name: string
  logo: React.ReactNode
  plan: string
}

const triggerClass = "h-9 rounded-sm border border-sidebar-border/55 bg-sidebar-background/60 px-1.5"
const logoClass = "size-6 rounded-sm bg-sidebar-primary/20"

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
  const [activeTeam, setActiveTeam] = React.useState<TeamOption | undefined>(() => {
    if (!activeTeamId) {
      return teams[0]
    }

    return teams.find((team) => team.id === activeTeamId) ?? teams[0]
  })

  React.useEffect(() => {
    if (!activeTeamId) {
      return
    }

    const selectedTeam = teams.find((team) => team.id === activeTeamId)
    if (selectedTeam) {
      setActiveTeam(selectedTeam)
    }
  }, [activeTeamId, teams])

  if (!activeTeam) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className={triggerClass}>
              <div className={cn("inline-flex items-center justify-center text-sidebar-primary", logoClass)}>{activeTeam.logo}</div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs text-muted-foreground">{activeTeam.plan}</span>
              </div>
              <IconSelector className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Companies</DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => {
                  setActiveTeam(team)
                  void onTeamChange?.(team.id)
                }}
                className="relative gap-2 p-2 pl-8"
              >
                <span
                  className={cn(
                    "pointer-events-none absolute left-3 w-px bg-border/70",
                    index === 0 ? "top-1/2 bottom-0" : "top-0 bottom-0",
                    index === teams.length - 1 ? "bottom-1/2" : ""
                  )}
                />
                <span className="pointer-events-none absolute left-3 top-1/2 h-px w-3 bg-border/70" />
                <div className="flex size-6 items-center justify-center rounded-md border border-border/70">{team.logo}</div>
                <span className="truncate">{team.name}</span>
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" disabled>
              <div className="flex size-6 items-center justify-center rounded-md border border-border/70">
                <IconPlus className="size-4" />
              </div>
              <span className="text-muted-foreground">Add company (soon)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
