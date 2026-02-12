"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  IconBuilding,
  IconCalendarTime,
  IconChartBar,
  IconChevronRight,
  IconClipboardList,
  IconClock,
  IconCreditCardPay,
  IconFileText,
  IconFolderOpen,
  IconLayoutDashboard,
  IconList,
  IconReceipt2,
  IconScale,
  IconSettings,
  IconShieldCheck,
  IconSwitchHorizontal,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react"
import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { AnimatePresence, motion, type Variants } from "framer-motion"

import { TeamSwitcher } from "@/components/team-switcher"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { getPhYear } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import { setActiveCompanyAction } from "@/modules/auth/actions/set-active-company-action"
import {
  getSidebarModulesForRole,
  toCompanyScopedPath,
} from "@/modules/navigation/sidebar-config"

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Icon Maps ──────────────────────────────────────────────────────────────

const moduleIconMap: Record<string, ReactNode> = {
  employees: <IconUsers className="size-4" />,
  timekeeping: <IconCalendarTime className="size-4" />,
  payroll: <IconCreditCardPay className="size-4" />,
  leaveOvertime: <IconChartBar className="size-4" />,
  settings: <IconSettings className="size-4" />,
}

/** Sub-item icons keyed by the `id` from sidebar-config */
const subItemIconMap: Record<string, ReactNode> = {
  // Employees
  "employee-masterlist": <IconList className="size-3.5" />,
  "employee-onboarding": <IconUserPlus className="size-3.5" />,
  "employee-movements": <IconSwitchHorizontal className="size-3.5" />,
  "employee-user-access": <IconShieldCheck className="size-3.5" />,
  // Time Keeping
  dtr: <IconClock className="size-3.5" />,
  "sync-biometrics": <IconClipboardList className="size-3.5" />,
  schedules: <IconCalendarTime className="size-3.5" />,
  // Payroll
  "payroll-runs": <IconReceipt2 className="size-3.5" />,
  "payroll-recurring-deductions": <IconCreditCardPay className="size-3.5" />,
  payslips: <IconFileText className="size-3.5" />,
  "statutory-reports": <IconScale className="size-3.5" />,
  // Leave & Overtime
  "approval-queue": <IconUserCheck className="size-3.5" />,
  "leave-balances": <IconChartBar className="size-3.5" />,
  // Settings
  "settings-company": <IconBuilding className="size-3.5" />,
  "settings-organization": <IconUsersGroup className="size-3.5" />,
  "settings-employment": <IconFolderOpen className="size-3.5" />,
  "settings-payroll": <IconCreditCardPay className="size-3.5" />,
  "settings-attendance": <IconClock className="size-3.5" />,
  "settings-leave-ot": <IconCalendarTime className="size-3.5" />,
  "settings-statutory": <IconScale className="size-3.5" />,
}

// ── Animation Variants ─────────────────────────────────────────────────────

const collapsibleVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: {
    height: "auto",
    opacity: 1,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.15, ease: "easeIn" as const },
  },
}

// ── Component ──────────────────────────────────────────────────────────────

export function AppSidebar({ companies, activeCompanyId, className }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const activeCompany =
    companies.find((c) => c.companyId === activeCompanyId) ??
    companies[0] ?? {
      companyId: activeCompanyId,
      companyCode: "N/A",
      companyName: "No Company",
      role: "EMPLOYEE",
    }

  // ── Team data ─────────────────────────────────────────────────────────
  const teams = companies.map((company) => ({
    id: company.companyId,
    name: company.companyName,
    code: company.companyCode,
    plan: company.role,
  }))

  const handleTeamChange = async (companyId: string) => {
    const result = await setActiveCompanyAction({ companyId })
    if (!result.ok) return
    router.push(`/${companyId}/dashboard`)
    router.refresh()
  }

  // ── Path matching ─────────────────────────────────────────────────────
  const normalizeCompanyPath = (path: string): string => {
    const parts = path.split("/").filter(Boolean)
    return parts.length <= 1 ? "/" : `/${parts.slice(1).join("/")}`
  }

  const matchesPath = (path: string, target: string): boolean =>
    path === target || path.startsWith(`${target}/`)

  const currentCompanyPath = normalizeCompanyPath(pathname)

  // ── Nav items ─────────────────────────────────────────────────────────
  const navItems = getSidebarModulesForRole(activeCompany?.role).map((module) => ({
    title: module.label,
    icon: moduleIconMap[module.icon],
    url:
      module.items[0] !== undefined
        ? toCompanyScopedPath(activeCompany.companyId, module.items[0].path)
        : toCompanyScopedPath(activeCompany.companyId, "/dashboard"),
    isActive: module.matchPrefixes.some((prefix) =>
      matchesPath(currentCompanyPath, prefix)
    ),
    items: module.items.map((sub) => ({
      id: sub.id,
      title: sub.label,
      url: toCompanyScopedPath(activeCompany.companyId, sub.path),
      isActive: matchesPath(currentCompanyPath, sub.path),
      icon: subItemIconMap[sub.id],
    })),
  }))

  // ── Accordion state (single-open) ─────────────────────────────────────
  const activeSection = useMemo(
    () => navItems.find((item) => item.isActive)?.title ?? null,
    [navItems]
  )
  const [openSection, setOpenSection] = useState<string | null>(activeSection)

  useEffect(() => {
    setOpenSection(activeSection)
  }, [activeSection])

  const handleToggle = (title: string, open: boolean) => {
    setOpenSection(open ? title : null)
  }

  // ── Dashboard link ────────────────────────────────────────────────────
  const dashboardUrl = toCompanyScopedPath(activeCompany.companyId, "/dashboard")
  const isDashboardActive = matchesPath(currentCompanyPath, "/dashboard")

  return (
    <Sidebar collapsible="icon" className={cn(className)}>
      {/* ── Header: Team Switcher ────────────────────────────────────── */}
      <SidebarHeader>
        <TeamSwitcher
          teams={teams}
          activeTeamId={activeCompanyId}
          onTeamChange={handleTeamChange}
        />
      </SidebarHeader>

      <Separator className="mx-auto w-[calc(100%-1rem)]" />

      {/* ── Content: Navigation ──────────────────────────────────────── */}
      <SidebarContent>
        {/* Dashboard — standalone link */}
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard" isActive={isDashboardActive}>
                <Link href={dashboardUrl}>
                  <IconLayoutDashboard className="size-4" />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Module navigation with collapsible sub-items */}
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <Collapsible
                key={item.title}
                asChild
                open={openSection === item.title}
                onOpenChange={(open) => handleToggle(item.title, open)}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title} isActive={item.isActive}>
                      {item.icon}
                      <span>{item.title}</span>
                      <IconChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <AnimatePresence initial={false}>
                    {openSection === item.title && (
                      <CollapsibleContent forceMount asChild>
                        <motion.div
                          variants={collapsibleVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          style={{ overflow: "hidden" }}
                        >
                          <SidebarMenuSub>
                            {item.items.map((sub) => (
                              <SidebarMenuSubItem key={sub.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={sub.isActive}
                                >
                                  <Link href={sub.url}>
                                    {sub.icon}
                                    <span>{sub.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </motion.div>
                      </CollapsibleContent>
                    )}
                  </AnimatePresence>
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Settings"
              size="sm"
              className="text-muted-foreground"
            >
              <span className="text-xs">
                © {getPhYear()} RDRDC Payroll
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
