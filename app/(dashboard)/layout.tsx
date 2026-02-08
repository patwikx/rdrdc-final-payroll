import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { NavUser } from "@/components/nav-user"
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
  const setupState = await getSetupState()

  if (!setupState.isInitialized) {
    redirect("/setup")
  }

  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const membershipStatus = await getSessionMembershipStatus(session.user.id)
  if (!membershipStatus.valid) {
    redirect("/logout?reason=invalid-session")
  }

  const companyOptions = await getUserCompanyOptions(session.user.id)

  if (companyOptions.length === 0) {
    redirect("/logout?reason=invalid-session")
  }

  const activeCompanyId =
    session.user.selectedCompanyId ?? session.user.defaultCompanyId ?? companyOptions[0]?.companyId ?? ""

  const userName =
    session.user.name ?? (`${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim() || "User")

  const userEmail = session.user.email ?? ""

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
                    avatar: "/avatars/shadcn.jpg",
                  }}
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
