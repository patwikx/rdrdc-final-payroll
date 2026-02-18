import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { EmployeeBulkUpdateWorkspacePage } from "@/modules/employees/masterlist/components/employee-bulk-update-workspace-page"

type EmployeeBulkUpdateRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Employee Bulk Update | ${company.companyName} | Final Payroll System`,
      description: `Bulk update employee records for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Employee Bulk Update | Final Payroll System",
      description: "Bulk update employee records.",
    }
  }
}

export default async function EmployeeBulkUpdateRoutePage({
  params,
}: EmployeeBulkUpdateRouteProps) {
  const { companyId } = await params

  let company: Awaited<ReturnType<typeof getActiveCompanyContext>> | null = null
  let noAccess = false

  try {
    company = await getActiveCompanyContext({ companyId })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      noAccess = true
    } else {
      throw error
    }
  }

  if (noAccess || !company) {
    try {
      const fallback = await getActiveCompanyContext()
      redirect(`/${fallback.companyId}/dashboard`)
    } catch {
      return (
        <main className="flex w-full flex-col gap-2 px-4 py-6 sm:px-6">
          <h1 className="text-lg font-semibold text-foreground">No Company Access</h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have an active company assignment yet. Please contact your administrator.
          </p>
        </main>
      )
    }
  }

  if (!hasModuleAccess(company.companyRole as CompanyRole, "employees")) {
    redirect(`/${company.companyId}/dashboard`)
  }

  return (
    <EmployeeBulkUpdateWorkspacePage
      companyId={company.companyId}
      companyName={company.companyName}
    />
  )
}
