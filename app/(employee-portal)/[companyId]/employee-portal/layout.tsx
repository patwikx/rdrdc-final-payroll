import { redirect } from "next/navigation"

import { EmployeePortalHeader } from "@/components/employee-portal/employee-portal-header"
import { EmployeePortalSidebar } from "@/components/employee-portal/employee-portal-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SessionActivityGuard } from "@/modules/auth/components/session-activity-guard"
import { getSessionMembershipStatus } from "@/modules/auth/utils/session-membership"
import { getSetupState } from "@/modules/setup/utils/setup-state"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type EmployeePortalLayoutProps = {
  children: React.ReactNode
  params: Promise<{ companyId: string }>
}

export default async function EmployeePortalLayout({ children, params }: EmployeePortalLayoutProps) {
  const { companyId } = await params

  const [setupState, context] = await Promise.all([
    getSetupState(),
    getEmployeePortalContext(companyId),
  ])

  if (!setupState.isInitialized) {
    redirect("/setup")
  }

  if (!context) {
    redirect("/login")
  }

  const membershipStatus = await getSessionMembershipStatus(context.userId)
  if (!membershipStatus.valid) {
    redirect("/logout?reason=invalid-session")
  }

  const allowedRoles = new Set(["EMPLOYEE", "APPROVER", "COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"])
  if (!allowedRoles.has(context.companyRole)) {
    redirect(`/${context.companyId}/dashboard`)
  }
  const canSwitchToDashboard =
    (context.companyRole === "COMPANY_ADMIN" || context.companyRole === "HR_ADMIN" || context.companyRole === "PAYROLL_ADMIN") &&
    Boolean(context.employee?.id)
  const userName =
    (`${context.employee?.firstName ?? ""} ${context.employee?.lastName ?? ""}`.trim() ||
      `${context.user?.firstName ?? ""} ${context.user?.lastName ?? ""}`.trim() ||
      "User")
  const userEmail = context.employee?.user?.email ?? context.user?.email ?? ""
  const userAvatar = context.employee?.photoUrl ?? null

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <SessionActivityGuard />
        <EmployeePortalSidebar
          companies={context.companies}
          activeCompanyId={context.companyId}
          companyRole={context.companyRole}
          canApproveRequests={context.isRequestApprover}
          canProcessMaterialRequests={context.isMaterialRequestPurchaser}
          canPostMaterialRequests={context.isMaterialRequestPoster}
          taskCounts={context.taskCounts}
        />
        <SidebarInset>
          <EmployeePortalHeader
            dashboardHref={canSwitchToDashboard ? `/${context.companyId}/dashboard` : null}
            accountHref={`/${context.companyId}/employee-portal/profile`}
            accountLabel="Profile"
            user={{
              name: userName,
              email: userEmail,
              avatar: userAvatar,
            }}
          />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
