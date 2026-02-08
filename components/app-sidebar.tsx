"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  IconCalendarTime,
  IconChartBar,
  IconCommand,
  IconCreditCardPay,
  IconLayoutRows,
  IconSettings,
  IconUsers,
  IconWaveSine,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { setActiveCompanyAction } from "@/modules/auth/actions/set-active-company-action"
import {
  getSidebarModulesForRole,
  toCompanyScopedPath,
} from "@/modules/navigation/sidebar-config"

type SidebarCompany = {
  companyId: string
  companyCode: string
  companyName: string
  role: string
}

type AppSidebarProps = {
  companies: SidebarCompany[]
  activeCompanyId: string
  className?: string
}

const companyLogos = [IconLayoutRows, IconWaveSine, IconCommand]

const moduleIconMap = {
  employees: <IconUsers className="size-4" />,
  timekeeping: <IconCalendarTime className="size-4" />,
  payroll: <IconCreditCardPay className="size-4" />,
  leaveOvertime: <IconChartBar className="size-4" />,
  settings: <IconSettings className="size-4" />,
}

export function AppSidebar({ companies, activeCompanyId, className }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const activeCompany = companies.find((company) => company.companyId === activeCompanyId) ?? companies[0]

  const teams = companies.map((company, index) => {
    const CompanyLogo = companyLogos[index % companyLogos.length]

    return {
      id: company.companyId,
      name: `${company.companyCode} - ${company.companyName}`,
      logo: <CompanyLogo />,
      plan: company.role,
    }
  })

  const handleTeamChange = async (companyId: string) => {
    const result = await setActiveCompanyAction({ companyId })
    if (!result.ok) {
      return
    }

    router.push(`/${companyId}/dashboard`)
    router.refresh()
  }

  const normalizeCompanyPath = (path: string): string => {
    const parts = path.split("/").filter(Boolean)
    if (parts.length <= 1) {
      return "/"
    }

    return `/${parts.slice(1).join("/")}`
  }

  const matchesPath = (path: string, target: string): boolean => {
    return path === target || path.startsWith(`${target}/`)
  }

  const currentCompanyPath = normalizeCompanyPath(pathname)

  const navMain = getSidebarModulesForRole(activeCompany?.role).map((module) => ({
    title: module.label,
    url:
      module.items[0] !== undefined
        ? toCompanyScopedPath(activeCompany.companyId, module.items[0].path)
        : toCompanyScopedPath(activeCompany.companyId, "/dashboard"),
    icon: moduleIconMap[module.icon],
    isActive: module.matchPrefixes.some((prefix) => matchesPath(currentCompanyPath, prefix)),
    items: module.items.map((subItem) => ({
      title: subItem.label,
      url: toCompanyScopedPath(activeCompany.companyId, subItem.path),
      isActive: matchesPath(currentCompanyPath, subItem.path),
    })),
  }))

  return (
    <Sidebar collapsible="icon" className={cn("bg-sidebar-background text-[12px]", className)}>
      <SidebarHeader>
        <div className="group-data-[collapsible=icon]:hidden rounded-sm border border-sidebar-border/55 bg-sidebar-background/70 p-1.5">
          <TeamSwitcher
            teams={teams}
            activeTeamId={activeCompanyId}
            onTeamChange={handleTeamChange}
          />
        </div>

        <div className="hidden group-data-[collapsible=icon]:block">
          <TeamSwitcher
            teams={teams}
            activeTeamId={activeCompanyId}
            onTeamChange={handleTeamChange}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
