"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  IconBuilding,
  IconCalendarTime,
  IconChecklist,
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
  IconReceiptTax,
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

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
  logoUrl?: string | null
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
  reports: <IconScale className="size-4" />,
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
  "sync-biometrics-device": <IconClipboardList className="size-3.5" />,
  schedules: <IconCalendarTime className="size-3.5" />,
  // Payroll
  "payroll-runs": <IconReceipt2 className="size-3.5" />,
  "payroll-recurring-deductions": <IconCreditCardPay className="size-3.5" />,
  payslips: <IconFileText className="size-3.5" />,
  "statutory-reports": <IconScale className="size-3.5" />,
  // Reports
  "reports-payroll": <IconScale className="size-3.5" />,
  "reports-certificate-of-employment": <IconFileText className="size-3.5" />,
  "reports-demographics": <IconUsersGroup className="size-3.5" />,
  "reports-salary-history": <IconFileText className="size-3.5" />,
  "reports-monthly-bir-wtax": <IconReceiptTax className="size-3.5" />,
  "reports-late-overtime": <IconClock className="size-3.5" />,
  "reports-contact-emergency-directory": <IconUsers className="size-3.5" />,
  "reports-employment-milestones": <IconCalendarTime className="size-3.5" />,
  "reports-movement-change-log": <IconSwitchHorizontal className="size-3.5" />,
  "reports-training-certification-compliance": <IconChecklist className="size-3.5" />,
  "reports-government-id-compliance": <IconReceiptTax className="size-3.5" />,
  "reports-separation-attrition-detail": <IconChartBar className="size-3.5" />,
  // Leave & Overtime
  "approval-queue": <IconUserCheck className="size-3.5" />,
  "leave-balances": <IconChartBar className="size-3.5" />,
  // Settings
  "settings-company": <IconBuilding className="size-3.5" />,
  "settings-company-new": <IconBuilding className="size-3.5" />,
  "settings-organization": <IconUsersGroup className="size-3.5" />,
  "settings-employment": <IconFolderOpen className="size-3.5" />,
  "settings-payroll": <IconCreditCardPay className="size-3.5" />,
  "settings-attendance": <IconClock className="size-3.5" />,
  "settings-leave-ot": <IconCalendarTime className="size-3.5" />,
  "settings-statutory": <IconScale className="size-3.5" />,
  "settings-material-requests": <IconChecklist className="size-3.5" />,
  "settings-audit-logs": <IconFileText className="size-3.5" />,
  "settings-legacy-employee-sync": <IconClipboardList className="size-3.5" />,
  "settings-legacy-leave-ot-sync": <IconClipboardList className="size-3.5" />,
  "settings-legacy-material-requests-sync": <IconClipboardList className="size-3.5" />,
}

const isLegacySyncItemId = (itemId: string): boolean => {
  return itemId.startsWith("settings-legacy-")
}

// ── Component ──────────────────────────────────────────────────────────────

export function AppSidebar({ companies, activeCompanyId, className }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const routeCompanyId = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)
    return segments[0] ?? null
  }, [pathname])

  const activeCompany = useMemo(() => {
    return (
      (routeCompanyId ? companies.find((company) => company.companyId === routeCompanyId) : null) ??
      companies.find((company) => company.companyId === activeCompanyId) ??
      companies[0] ?? {
        companyId: activeCompanyId,
        companyCode: "N/A",
        companyName: "No Company",
        role: "EMPLOYEE",
      }
    )
  }, [activeCompanyId, companies, routeCompanyId])

  // ── Team data ─────────────────────────────────────────────────────────
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
    router.push(`/${companyId}/dashboard`)
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
  const navItems = getSidebarModulesForRole(activeCompany?.role).map((module) => {
    const activeSubPath = module.items
      .filter((sub) => matchesPath(currentCompanyPath, sub.path))
      .sort((a, b) => b.path.length - a.path.length)[0]?.path ?? null

    return {
      id: module.id,
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
        isActive: sub.path === activeSubPath,
        icon: subItemIconMap[sub.id] ?? <IconFileText className="size-3.5" />,
      })),
    }
  })

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
  const prefetchedRoutesRef = useRef<Set<string>>(new Set())

  const prefetchRoute = useCallback(
    (url: string) => {
      if (prefetchedRoutesRef.current.has(url)) return
      prefetchedRoutesRef.current.add(url)
      router.prefetch(url)
    },
    [router]
  )

  useEffect(() => {
    prefetchRoute(dashboardUrl)
    const activeNavItem = navItems.find((item) => item.isActive) ?? navItems[0]
    if (!activeNavItem) return
    prefetchRoute(activeNavItem.url)
    for (const item of activeNavItem.items) {
      prefetchRoute(item.url)
    }
  }, [dashboardUrl, navItems, prefetchRoute])

  return (
    <Sidebar collapsible="icon" className={cn(className)}>
      {/* ── Header: Team Switcher ────────────────────────────────────── */}
      <SidebarHeader>
        <TeamSwitcher
          teams={teams}
          activeTeamId={activeCompany.companyId}
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
                <Link
                  href={dashboardUrl}
                  prefetch={false}
                  onMouseEnter={() => prefetchRoute(dashboardUrl)}
                  onFocus={() => prefetchRoute(dashboardUrl)}
                  onTouchStart={() => prefetchRoute(dashboardUrl)}
                >
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
            {navItems.map((item) => {
              const legacySyncItems =
                item.id === "system-settings"
                  ? item.items.filter((sub) => isLegacySyncItemId(sub.id))
                  : []
              const primaryItems =
                item.id === "system-settings"
                  ? item.items.filter((sub) => !isLegacySyncItemId(sub.id))
                  : item.items

              return (
                <Collapsible
                  key={item.title}
                  asChild
                  open={openSection === item.title}
                  onOpenChange={(open) => handleToggle(item.title, open)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        onMouseEnter={() => prefetchRoute(item.url)}
                        onFocus={() => prefetchRoute(item.url)}
                        onTouchStart={() => prefetchRoute(item.url)}
                      >
                        {item.icon}
                        <span>{item.title}</span>
                        <IconChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    {openSection === item.title ? (
                      <CollapsibleContent forceMount>
                        <SidebarMenuSub>
                          {primaryItems.map((sub) => (
                            <SidebarMenuSubItem key={sub.id}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={sub.isActive}
                              >
                                <Link
                                  href={sub.url}
                                  prefetch={false}
                                  onMouseEnter={() => prefetchRoute(sub.url)}
                                  onFocus={() => prefetchRoute(sub.url)}
                                  onTouchStart={() => prefetchRoute(sub.url)}
                                >
                                  {sub.icon}
                                  <span>{sub.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                          {legacySyncItems.length > 0 ? (
                            <>
                              <SidebarMenuSubItem className="mt-2 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/60">
                                Legacy Sync
                              </SidebarMenuSubItem>
                              {legacySyncItems.map((sub) => (
                                <SidebarMenuSubItem key={sub.id}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={sub.isActive}
                                  >
                                    <Link
                                      href={sub.url}
                                      prefetch={false}
                                      onMouseEnter={() => prefetchRoute(sub.url)}
                                      onFocus={() => prefetchRoute(sub.url)}
                                      onTouchStart={() => prefetchRoute(sub.url)}
                                    >
                                      {sub.icon}
                                      <span>{sub.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </>
                          ) : null}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    ) : null}
                  </SidebarMenuItem>
                </Collapsible>
              )
            })}
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
