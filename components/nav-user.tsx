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
import { IconSelector, IconSparkles, IconRosetteDiscountCheck, IconCreditCard, IconBell, IconLogout } from "@tabler/icons-react"
import { signOut } from "next-auth/react"
import { useTransition } from "react"

export function NavUser({
  user,
  inSidebar = true,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
  inSidebar?: boolean
}) {
  const { isMobile } = useSidebar()
  const [isLoggingOut, startLogoutTransition] = useTransition()

  const handleLogout = () => {
    startLogoutTransition(async () => {
      await signOut({ callbackUrl: "/login" })
    })
  }

  const triggerContent = (
    <>
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarImage src={user.avatar} alt={user.name} />
        <AvatarFallback className="rounded-lg">CN</AvatarFallback>
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
      side={isMobile ? "bottom" : "right"}
      align="end"
      sideOffset={4}
    >
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-lg">CN</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate text-xs">{user.email}</span>
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem>
          <IconSparkles
          />
          Upgrade to Pro
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem>
          <IconRosetteDiscountCheck
          />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconCreditCard
          />
          Billing
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconBell
          />
          Notifications
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={handleLogout} disabled={isLoggingOut}>
        <IconLogout
        />
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
