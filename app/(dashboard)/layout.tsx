import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { NavUser } from "@/components/nav-user"
import { db } from "@/lib/db"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SessionActivityGuard } from "@/modules/auth/components/session-activity-guard"
import { getUserCompanyOptions } from "@/modules/auth/utils/active-company-context"
import { getSessionMembershipStatus } from "@/modules/auth/utils/session-membership"
import { getSetupState } from "@/modules/setup/utils/setup-state"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [setupState, session] = await Promise.all([getSetupState(), auth()])

  if (!setupState.isInitialized) {
    redirect("/setup")
  }

  if (!session?.user) {
    redirect("/login")
  }

  const [membershipStatus, companyOptions] = await Promise.all([
    getSessionMembershipStatus(session.user.id),
    getUserCompanyOptions(session.user.id),
  ])

  if (!membershipStatus.valid) {
    redirect("/logout?reason=invalid-session")
  }

  if (companyOptions.length === 0) {
    redirect("/logout?reason=invalid-session")
  }

  const activeCompanyId =
    session.user.selectedCompanyId ?? session.user.defaultCompanyId ?? companyOptions[0]?.companyId ?? ""

  const [activeEmployee, currentUser] = await Promise.all([
    db.employee.findFirst({
      where: {
        userId: session.user.id,
        companyId: activeCompanyId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        photoUrl: true,
      },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
  ])

  const userName =
    (`${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim() ||
      session.user.name ||
      `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim() ||
      "User")
  const userEmail = currentUser?.email ?? session.user.email ?? ""
  const activeCompanyRole =
    companyOptions.find((company) => company.companyId === activeCompanyId)?.role ??
    companyOptions[0]?.role ??
    "EMPLOYEE"
  const canSwitchToEmployeePortal =
    (activeCompanyRole === "COMPANY_ADMIN" || activeCompanyRole === "HR_ADMIN" || activeCompanyRole === "PAYROLL_ADMIN") &&
    Boolean(activeEmployee?.id)

  const userAvatar = activeEmployee?.photoUrl ?? session.user.image ?? null

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider suppressHydrationWarning>
        <SessionActivityGuard />
        <AppSidebar
          companies={companyOptions}
          activeCompanyId={activeCompanyId}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/70 bg-background/95 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 sm:px-6">
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-8" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href={`/${activeCompanyId}/dashboard`}>Workspace</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Dashboard</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className="ml-auto w-auto shrink-0">
                <NavUser
                  user={{
                    name: userName,
                    email: userEmail,
                    avatar: userAvatar,
                  }}
                  accountHref={`/${activeCompanyId}/account`}
                  workspaceItems={
                    canSwitchToEmployeePortal
                      ? [
                          {
                            id: "employee-portal",
                            label: "Employee Portal",
                            href: `/${activeCompanyId}/employee-portal`,
                          },
                        ]
                      : []
                  }
                  inSidebar={false}
                />
              </div>
            </div>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
