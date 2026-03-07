"use client"

import { useMemo, type ComponentType } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  IconCalendarEvent,
  IconChartBar,
  IconChecklist,
  IconClockHour4,
  IconFileInvoice,
  IconFileText,
  IconHome2,
  IconPackage,
  IconReceipt2,
  IconSettings,
  IconUser,
} from "@tabler/icons-react"

import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import {
  hasEmployeePortalCapability,
  type EmployeePortalCapability,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"

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
  capabilities: EmployeePortalCapability[]
  taskCounts: {
    leaveApprovalPending: number
    overtimeApprovalPending: number
    materialRequestApprovalPending: number
    materialRequestProcessingPending: number
    materialRequestPostingPending: number
    purchaseRequestApprovalPending: number
    purchaseOrderPending: number
  }
}

type SidebarItem = {
  title: string
  href: string
  icon: ComponentType<{ className?: string }>
  capability: EmployeePortalCapability
}

const menuItems: SidebarItem[] = [
  {
    title: "Dashboard",
    href: "/employee-portal",
    icon: IconHome2,
    capability: "portal_routes.dashboard.view",
  },
  {
    title: "My Payslips",
    href: "/employee-portal/payslips",
    icon: IconFileText,
    capability: "portal_routes.payslips.view",
  },
  {
    title: "Leave Requests",
    href: "/employee-portal/leaves",
    icon: IconCalendarEvent,
    capability: "portal_routes.leave_requests.view",
  },
  {
    title: "Overtime Requests",
    href: "/employee-portal/overtime",
    icon: IconClockHour4,
    capability: "portal_routes.overtime_requests.view",
  },
  {
    title: "Material Requests",
    href: "/employee-portal/material-requests",
    icon: IconPackage,
    capability: "portal_routes.material_requests.view",
  },
  {
    title: "Material Request KPI",
    href: "/employee-portal/material-request-kpis",
    icon: IconChartBar,
    capability: "portal_routes.material_request_kpis.view",
  },
  {
    title: "My Profile",
    href: "/employee-portal/profile",
    icon: IconUser,
    capability: "portal_routes.profile.view",
  },
]

const approverMenuItems: SidebarItem[] = [
  {
    title: "Leave Approvals",
    href: "/employee-portal/leave-approvals",
    icon: IconChecklist,
    capability: "portal_routes.leave_approvals.view",
  },
  {
    title: "Overtime Approvals",
    href: "/employee-portal/overtime-approvals",
    icon: IconChecklist,
    capability: "portal_routes.overtime_approvals.view",
  },
  {
    title: "MRS/PR Approvals",
    href: "/employee-portal/material-request-approvals",
    icon: IconChecklist,
    capability: "portal_routes.material_request_approvals.view",
  },
  {
    title: "Approval History",
    href: "/employee-portal/approval-history",
    icon: IconChecklist,
    capability: "portal_routes.approval_history.view",
  },
]

const processingMenuItems: SidebarItem[] = [
  {
    title: "Material Request Processing",
    href: "/employee-portal/material-request-processing",
    icon: IconPackage,
    capability: "portal_routes.material_request_processing.view",
  },
  {
    title: "Purchase Orders",
    href: "/employee-portal/purchase-orders",
    icon: IconFileInvoice,
    capability: "portal_routes.purchase_orders.view",
  },
  {
    title: "Goods Receipt PO",
    href: "/employee-portal/goods-receipt-pos",
    icon: IconReceipt2,
    capability: "portal_routes.goods_receipt_pos.view",
  },
]

const postingMenuItems: SidebarItem[] = [
  {
    title: "Material Request Posting",
    href: "/employee-portal/material-request-posting",
    icon: IconPackage,
    capability: "portal_routes.material_request_posting.view",
  },
  {
    title: "Receiving Reports",
    href: "/employee-portal/material-request-receiving-reports",
    icon: IconReceipt2,
    capability: "portal_routes.material_request_receiving_reports.view",
  },
]

const procurementMenuItems: SidebarItem[] = [
  {
    title: "MRS/PR Settings",
    href: "/employee-portal/request-settings",
    icon: IconSettings,
    capability: "portal_routes.request_settings.view",
  },
  {
    title: "Global Item Catalog",
    href: "/employee-portal/procurement-item-catalog",
    icon: IconPackage,
    capability: "portal_routes.procurement_item_catalog.view",
  },
  {
    title: "Purchase Requests",
    href: "/employee-portal/purchase-requests",
    icon: IconPackage,
    capability: "portal_routes.purchase_requests.view",
  },
]

export function EmployeePortalSidebar({
  companies,
  activeCompanyId,
  capabilities,
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

  const changeLogHref = `/${activeCompanyId}/employee-portal/change-log`
  const isChangeLogActive = pathname === changeLogHref || pathname.startsWith(`${changeLogHref}/`)
  const canViewChangeLog = hasEmployeePortalCapability(capabilities, "portal_routes.change_log.view")
  const visibleMenuItems = menuItems.filter((item) => hasEmployeePortalCapability(capabilities, item.capability))
  const visibleApproverItems = approverMenuItems.filter((item) =>
    hasEmployeePortalCapability(capabilities, item.capability)
  )
  const visibleProcessingItems = processingMenuItems.filter((item) =>
    hasEmployeePortalCapability(capabilities, item.capability)
  )
  const visiblePostingItems = postingMenuItems.filter((item) =>
    hasEmployeePortalCapability(capabilities, item.capability)
  )
  const visibleProcurementItems = procurementMenuItems.filter((item) =>
    hasEmployeePortalCapability(capabilities, item.capability)
  )

  const taskCountByHref: Record<string, number> = {
    "/employee-portal/leave-approvals": taskCounts.leaveApprovalPending,
    "/employee-portal/overtime-approvals": taskCounts.overtimeApprovalPending,
    "/employee-portal/material-request-approvals":
      taskCounts.materialRequestApprovalPending + taskCounts.purchaseRequestApprovalPending,
    "/employee-portal/material-request-processing": taskCounts.materialRequestProcessingPending,
    "/employee-portal/material-request-posting": taskCounts.materialRequestPostingPending,
    "/employee-portal/purchase-orders": taskCounts.purchaseOrderPending,
  }

  const renderItem = (item: SidebarItem) => {
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
              ? "border-l-2 border-primary bg-primary/10 font-mono font-bold text-primary"
              : "font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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

        {visibleProcurementItems.length > 0 ? (
          <SidebarGroup className="mb-1.5 border-t border-border/40 p-0 pt-1.5">
            <SidebarGroupLabel className="px-5 pb-0.5 pt-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.11em] text-muted-foreground/70">
              Procurement
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-1.5">{visibleProcurementItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

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
              Acctg Posting
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-1.5">{visiblePostingItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 px-3 py-2">
        <div className="flex items-center justify-end">
          {canViewChangeLog ? (
            <Link
              href={changeLogHref}
              className={cn(
                "text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline group-data-[collapsible=icon]:hidden",
                isChangeLogActive ? "text-foreground underline" : ""
              )}
            >
              Change Log
            </Link>
          ) : null}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
