"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

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
import { IconChevronRight } from "@tabler/icons-react"

type NavMainItem = {
  title: string
  url: string
  icon?: React.ReactNode
  isActive?: boolean
  items?: {
    title: string
    url: string
    isActive?: boolean
  }[]
}

export function NavMain({ items }: { items: NavMainItem[] }) {
  const labelClass = "text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/60"
  const menuClass = "space-y-1"
  const buttonClass = "h-8 rounded-sm border border-sidebar-border/50 bg-sidebar-background/60 px-2 text-[10px] uppercase tracking-[0.08em]"
  const subClass = "h-6 rounded-sm border border-sidebar-border/45 bg-sidebar-background/50 px-1.5 text-[10px]"

  const activeSection = useMemo(() => items.find((item) => item.isActive)?.title ?? null, [items])
  const [openSection, setOpenSection] = useState<string | null>(activeSection)

  useEffect(() => {
    setOpenSection(activeSection)
  }, [activeSection])

  const handleSectionToggle = (sectionTitle: string, nextOpen: boolean) => {
    setOpenSection(nextOpen ? sectionTitle : null)
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className={labelClass}>Business Operations</SidebarGroupLabel>
      <SidebarMenu className={menuClass}>
        {items.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            open={openSection === item.title}
            onOpenChange={(nextOpen) => handleSectionToggle(item.title, nextOpen)}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={item.isActive}
                  className={buttonClass}
                >
                  <span className="inline-flex size-4 items-center justify-center">{item.icon}</span>
                  <span>{item.title}</span>
                  <IconChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={subItem.isActive}
                        className={subClass}
                      >
                        <Link href={subItem.url}>
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
