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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type TeamOption = {
  id: string
  name: string
  code: string
  logoUrl?: string | null
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
              <Avatar className="size-8 rounded-lg border border-sidebar-border/60 bg-sidebar-primary/5 [&_*]:rounded-lg">
                <AvatarImage src={activeTeam.logoUrl ?? undefined} alt={activeTeam.name} className="object-cover" />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                  <IconBuilding className="size-4" />
                </AvatarFallback>
              </Avatar>
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
                <Avatar className="size-6 rounded-md border border-border/60 bg-background [&_*]:rounded-md">
                  <AvatarImage src={team.logoUrl ?? undefined} alt={team.name} className="object-cover" />
                  <AvatarFallback className="bg-background text-foreground">
                    <IconBuilding className="size-3.5" />
                  </AvatarFallback>
                </Avatar>
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
