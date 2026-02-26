"use client"

import { useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  IconCalendarEvent,
  IconChartBar,
  IconChecklist,
  IconClockHour4,
  IconFileText,
  IconHome2,
  IconPackage,
  IconReceipt2,
  IconUser,
  IconUserCheck,
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
  logoUrl?: string | null
  role: string
}

type EmployeePortalSidebarProps = {
  companies: EmployeePortalCompany[]
  activeCompanyId: string
  companyRole: PortalRole
  canApproveRequests: boolean
  canProcessMaterialRequests: boolean
  canPostMaterialRequests: boolean
  taskCounts: {
    leaveApprovalPending: number
    overtimeApprovalPending: number
    materialRequestApprovalPending: number
    materialRequestProcessingPending: number
    materialRequestPostingPending: number
  }
}

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
    title: "Material Requests",
    href: "/employee-portal/material-requests",
    icon: IconPackage,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
  {
    title: "Material Request KPI",
    href: "/employee-portal/material-request-kpis",
    icon: IconChartBar,
    roles: ["COMPANY_ADMIN"],
  },
  {
    title: "Receiving Reports",
    href: "/employee-portal/material-request-receiving-reports",
    icon: IconReceipt2,
    roles: ["COMPANY_ADMIN"],
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
  {
    title: "Material Request Approvals",
    href: "/employee-portal/material-request-approvals",
    icon: IconChecklist,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
  {
    title: "Approval History",
    href: "/employee-portal/approval-history",
    icon: IconChecklist,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
] as const

const processingMenuItems = [
  {
    title: "Material Request Processing",
    href: "/employee-portal/material-request-processing",
    icon: IconPackage,
    roles: ["EMPLOYEE", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"],
  },
] as const

const postingMenuItems = [
  {
    title: "Material Request Posting",
    href: "/employee-portal/material-request-posting",
    icon: IconPackage,
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

export function EmployeePortalSidebar({
  companies,
  activeCompanyId,
  companyRole,
  canApproveRequests,
  canProcessMaterialRequests,
  canPostMaterialRequests,
  taskCounts,
}: EmployeePortalSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const teams = useMemo(
    () =>
      companies.map((company) => ({
        id: company.companyId,
        name: company.companyName,
        code: company.companyCode,
        logoUrl: company.logoUrl ?? null,
        plan: company.role,
      })),
    [companies]
  )

  const handleTeamChange = async (companyId: string) => {
    const result = await setActiveCompanyAction({ companyId })
    if (!result.ok) return

    router.push(`/${companyId}/employee-portal`)
    router.refresh()
  }

  const isAdminRole = companyRole === "COMPANY_ADMIN" || companyRole === "HR_ADMIN" || companyRole === "PAYROLL_ADMIN"
  const visibleMenuItems = menuItems.filter((item) => (item.roles as readonly PortalRole[]).includes(companyRole))
  const visibleApproverItems = (canApproveRequests || isAdminRole)
    ? approverMenuItems.filter((item) => item.roles.includes(companyRole))
    : []
  const visibleProcessingItems = (canProcessMaterialRequests || isAdminRole)
    ? processingMenuItems.filter((item) => item.roles.includes(companyRole))
    : []
  const visiblePostingItems = (canPostMaterialRequests || isAdminRole)
    ? postingMenuItems.filter((item) => item.roles.includes(companyRole))
    : []
  const visibleAdminItems = isAdminRole
    ? adminMenuItems.filter((item) => item.roles.includes(companyRole))
    : []

  const taskCountByHref: Record<string, number> = {
    "/employee-portal/leave-approvals": taskCounts.leaveApprovalPending,
    "/employee-portal/overtime-approvals": taskCounts.overtimeApprovalPending,
    "/employee-portal/material-request-approvals": taskCounts.materialRequestApprovalPending,
    "/employee-portal/material-request-processing": taskCounts.materialRequestProcessingPending,
    "/employee-portal/material-request-posting": taskCounts.materialRequestPostingPending,
  }

  const renderItem = (item: { title: string; href: string; icon: (typeof menuItems)[number]["icon"] }) => {
    const href = `/${activeCompanyId}${item.href}`
    const isActive =
      item.href === "/employee-portal"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`)
    const taskCount = taskCountByHref[item.href] ?? 0

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.title}
          className={cn(
            "h-8 rounded-none px-3 transition-all duration-200",
            isActive
              ? "bg-primary/10 text-primary font-mono font-bold border-l-2 border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium"
          )}
        >
          <Link href={href} className="flex w-full items-center gap-2.5">
            <item.icon className={cn("h-4 w-4 shrink-0 opacity-80", isActive && "opacity-100")} />
            <span>{item.title}</span>
            {taskCount > 0 ? (
              <span
                className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
              >
                {taskCount > 99 ? "99+" : String(taskCount)}
              </span>
            ) : null}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40 bg-background shadow-none">
      <SidebarHeader className="border-b border-border/40 px-2 pb-0.5 pt-1.5">
        <TeamSwitcher teams={teams} activeTeamId={activeCompanyId} onTeamChange={handleTeamChange} />
      </SidebarHeader>

      <SidebarContent className="py-1.5">
        <SidebarGroup className="mb-1.5 p-0">
          <SidebarGroupLabel className="px-5 pb-0.5 pt-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.11em] text-muted-foreground/70">
            Employee Portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 px-1.5">{visibleMenuItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleApproverItems.length > 0 ? (
          <SidebarGroup className="mb-1.5 border-t border-border/40 p-0 pt-1.5">
            <SidebarGroupLabel className="px-5 pb-0.5 pt-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.11em] text-muted-foreground/70">
              Approvals
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-1.5">{visibleApproverItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {visibleProcessingItems.length > 0 ? (
          <SidebarGroup className="mb-1.5 border-t border-border/40 p-0 pt-1.5">
            <SidebarGroupLabel className="px-5 pb-0.5 pt-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.11em] text-muted-foreground/70">
              Processing
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-1.5">{visibleProcessingItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {visiblePostingItems.length > 0 ? (
          <SidebarGroup className="mb-1.5 border-t border-border/40 p-0 pt-1.5">
            <SidebarGroupLabel className="px-5 pb-0.5 pt-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.11em] text-muted-foreground/70">
              Posting
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-1.5">{visiblePostingItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {visibleAdminItems.length > 0 ? (
          <SidebarGroup className="mb-1.5 border-t border-border/40 p-0 pt-1.5">
            <SidebarGroupLabel className="px-5 pb-0.5 pt-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.11em] text-muted-foreground/70">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-1.5">{visibleAdminItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
