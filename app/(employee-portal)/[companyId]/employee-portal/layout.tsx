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
  const setupState = await getSetupState()
  if (!setupState.isInitialized) {
    redirect("/setup")
  }

  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

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

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <SessionActivityGuard />
        <EmployeePortalSidebar
          companies={context.companies}
          activeCompanyId={context.companyId}
          companyRole={context.companyRole}
          canApproveRequests={Boolean(context.employee?.user?.isRequestApprover)}
        />
        <SidebarInset>
          <EmployeePortalHeader companyName={context.companyName} />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
