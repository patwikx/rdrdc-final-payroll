// nav-main.tsx
"use client"

import * as React from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

interface NavMainItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  badge?: number
  badgeVariant?: "default" | "secondary" | "destructive" | "outline"
  items?: {
    title: string
    url: string
    badge?: number
    badgeVariant?: "default" | "secondary" | "destructive" | "outline"
  }[]
}

interface NavMainProps {
  items: NavMainItem[]
}

export function NavMain({ items }: NavMainProps) {
  const pathname = usePathname()

  // Check if current item or any of its subitems is active
  const isItemActive = React.useCallback((item: NavMainItem): boolean => {
    if (pathname === item.url) return true
    return item.items?.some(subItem => pathname === subItem.url) ?? false
  }, [pathname])

  // Check if subitem is active
  const isSubItemActive = React.useCallback((url: string): boolean => {
    return pathname === url
  }, [pathname])

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const itemIsActive = isItemActive(item)
          const hasSubItems = item.items && item.items.length > 0

          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={itemIsActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                {hasSubItems ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton 
                        tooltip={item.title}
                        className={cn(
                          itemIsActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                        )}
                      >
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <Badge variant={item.badgeVariant || "destructive"} className="ml-auto h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full">
                            {item.badge}
                          </Badge>
                        )}
                        <ChevronRight className={cn(
                          "transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90",
                          item.badge !== undefined && item.badge > 0 ? "ml-2" : "ml-auto"
                        )} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => {
                          const subItemIsActive = isSubItemActive(subItem.url)
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton 
                                asChild
                                className={cn(
                                  subItemIsActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                                )}
                              >
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                  {subItem.badge !== undefined && subItem.badge > 0 && (
                                    <Badge 
                                      variant={subItem.badgeVariant || "destructive"} 
                                      className={cn(
                                        "ml-auto h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full",
                                        subItem.title === "Done Requests" && "bg-green-600 hover:bg-green-600/80 text-white"
                                      )}
                                    >
                                      {subItem.badge}
                                    </Badge>
                                  )}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : (
                  <SidebarMenuButton 
                    tooltip={item.title}
                    className={cn(
                      itemIsActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                    asChild
                  >
                    <Link href={item.url}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}