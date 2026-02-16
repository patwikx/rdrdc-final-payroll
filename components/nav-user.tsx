"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { Button } from "@/components/ui/button"
import {
  IconBell,
  IconLayoutDashboard,
  IconLogout,
  IconRosetteDiscountCheck,
  IconSelector,
  IconUser,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { useTransition } from "react"

type WorkspaceMenuItem = {
  id: "dashboard" | "employee-portal"
  label: string
  href: string
  isCurrent?: boolean
}

export function NavUser({
  user,
  inSidebar = true,
  workspaceItems = [],
  accountHref,
}: {
  user: {
    name: string
    email: string
    avatar?: string | null
  }
  inSidebar?: boolean
  workspaceItems?: WorkspaceMenuItem[]
  accountHref?: string
}) {
  useSidebar()
  const router = useRouter()
  const [isLoggingOut, startLogoutTransition] = useTransition()

  const handleLogout = () => {
    startLogoutTransition(async () => {
      await signOut({ callbackUrl: "/login" })
    })
  }

  const initials = user.name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U"

  const triggerContent = (
    <>
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
        <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className={inSidebar ? "grid flex-1 text-left text-sm leading-tight" : "grid w-[170px] text-left text-sm leading-tight"}>
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-xs">{user.email}</span>
      </div>
      <IconSelector className="ml-auto size-4" />
    </>
  )

  const dropdownContent = (
    <DropdownMenuContent
      className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
      side="bottom"
      align="end"
      sideOffset={4}
    >
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate text-xs">{user.email}</span>
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        {accountHref ? (
          <DropdownMenuItem
            onSelect={() => {
              router.push(accountHref)
            }}
          >
            <IconRosetteDiscountCheck />
            Account
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem>
          <IconBell />
          Notifications
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      {workspaceItems.length > 0 ? (
        <>
          <DropdownMenuGroup>
            {workspaceItems.map((item) => (
              <DropdownMenuItem
                key={item.id}
                disabled={item.isCurrent}
                onSelect={() => {
                  if (item.isCurrent) return
                  window.location.assign(item.href)
                }}
              >
                {item.id === "dashboard" ? <IconLayoutDashboard /> : <IconUser />}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </>
      ) : null}
      <DropdownMenuItem
        onSelect={handleLogout}
        disabled={isLoggingOut}
        className="text-destructive focus:text-destructive"
      >
        <IconLogout className="text-destructive" />
        {isLoggingOut ? "Logging out..." : "Log out"}
      </DropdownMenuItem>
    </DropdownMenuContent>
  )

  if (!inSidebar) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 w-auto min-w-0 px-2">
            {triggerContent}
          </Button>
        </DropdownMenuTrigger>
        {dropdownContent}
      </DropdownMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {triggerContent}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {dropdownContent}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
