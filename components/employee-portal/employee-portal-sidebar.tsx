"use client"

import { useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  IconCalendarEvent,
  IconChecklist,
  IconClockHour4,
  IconFileText,
  IconHome2,
  IconLayoutRows,
  IconUser,
  IconUserCheck,
  IconCommand,
  IconWaveSine,
} from "@tabler/icons-react"

import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { setActiveCompanyAction } from "@/modules/auth/actions/set-active-company-action"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"

type PortalRole = CompanyRole

type EmployeePortalCompany = {
  companyId: string
  companyCode: string
  companyName: string
  role: string
}

type EmployeePortalSidebarProps = {
  companies: EmployeePortalCompany[]
  activeCompanyId: string
  companyRole: PortalRole
  canApproveRequests: boolean
}

const companyLogos = [IconLayoutRows, IconWaveSine, IconCommand]

const menuItems = [
  {
    title: "Dashboard",
    href: "/employee-portal",
    icon: IconHome2,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
  {
    title: "My Payslips",
    href: "/employee-portal/payslips",
    icon: IconFileText,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
  {
    title: "Leave Requests",
    href: "/employee-portal/leaves",
    icon: IconCalendarEvent,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
  {
    title: "Overtime Requests",
    href: "/employee-portal/overtime",
    icon: IconClockHour4,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
  {
    title: "My Profile",
    href: "/employee-portal/profile",
    icon: IconUser,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
] as const

const approverMenuItems = [
  {
    title: "Leave Approvals",
    href: "/employee-portal/leave-approvals",
    icon: IconChecklist,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
  {
    title: "Overtime Approvals",
    href: "/employee-portal/overtime-approvals",
    icon: IconChecklist,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
] as const

const adminMenuItems = [
  {
    title: "Request Approvers",
    href: "/employee-portal/approvers",
    icon: IconUserCheck,
    roles: ["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"],
  },
] as const

export function EmployeePortalSidebar({ companies, activeCompanyId, companyRole, canApproveRequests }: EmployeePortalSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const teams = useMemo(
    () =>
      companies.map((company, index) => {
        const CompanyLogo = companyLogos[index % companyLogos.length]
        return {
          id: company.companyId,
          name: company.companyName,
          code: company.companyCode,
          logo: <CompanyLogo className="size-4" />,
          plan: company.role,
        }
      }),
    [companies]
  )

  const handleTeamChange = async (companyId: string) => {
    const result = await setActiveCompanyAction({ companyId })
    if (!result.ok) return

    router.push(`/${companyId}/employee-portal`)
    router.refresh()
  }

  const isAdminRole = companyRole === "COMPANY_ADMIN" || companyRole === "HR_ADMIN" || companyRole === "PAYROLL_ADMIN"
  const visibleMenuItems = menuItems.filter((item) => item.roles.includes(companyRole))
  const visibleApproverItems = (canApproveRequests || isAdminRole)
    ? approverMenuItems.filter((item) => item.roles.includes(companyRole))
    : []
  const visibleAdminItems = isAdminRole
    ? adminMenuItems.filter((item) => item.roles.includes(companyRole))
    : []

  const renderItem = (item: { title: string; href: string; icon: (typeof menuItems)[number]["icon"] }) => {
    const href = `/${activeCompanyId}${item.href}`
    const isActive = pathname === href

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.title}
          className={cn(
            "h-9 rounded-none px-4 transition-all duration-200",
            isActive
              ? "bg-primary/10 text-primary font-mono font-bold border-l-2 border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium"
          )}
        >
          <Link href={href} className="flex items-center gap-3">
            <item.icon className={cn("h-4 w-4 shrink-0 opacity-80", isActive && "opacity-100")} />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40 bg-background shadow-none">
      <SidebarHeader className="border-b border-border/40 px-2 pb-1 pt-2">
        <TeamSwitcher teams={teams} activeTeamId={activeCompanyId} onTeamChange={handleTeamChange} />
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup className="mb-2 p-0">
          <SidebarGroupLabel className="px-6 pb-1 pt-3 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
            Employee Portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-2">{visibleMenuItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleApproverItems.length > 0 ? (
          <SidebarGroup className="mb-2 border-t border-border/40 p-0 pt-2">
            <SidebarGroupLabel className="px-6 pb-1 pt-3 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              Approvals
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1 px-2">{visibleApproverItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {visibleAdminItems.length > 0 ? (
          <SidebarGroup className="mb-2 border-t border-border/40 p-0 pt-2">
            <SidebarGroupLabel className="px-6 pb-1 pt-3 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1 px-2">{visibleAdminItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
