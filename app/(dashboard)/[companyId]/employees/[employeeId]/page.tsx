import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import {
  hasModuleAccess,
  type CompanyRole,
} from "@/modules/auth/utils/authorization-policy"
import { EmployeeProfilePage } from "@/modules/employees/profile/components/employee-profile-page"
import { getEmployeeProfileViewModel } from "@/modules/employees/profile/utils/get-employee-profile-data"

type EmployeeProfileRouteProps = {
  params: Promise<{ companyId: string; employeeId: string }>
}

export async function generateMetadata({ params }: EmployeeProfileRouteProps): Promise<Metadata> {
  const { companyId, employeeId } = await params

  try {
    const data = await getEmployeeProfileViewModel(companyId, employeeId)

    if (!data) {
      return {
        title: "Employee Record | Final Payroll System",
        description: "Employee profile record.",
      }
    }

    return {
      title: `${data.employee.fullName} | Employee Record | ${data.companyName}`,
      description: `Employee profile for ${data.employee.fullName}.`,
    }
  } catch {
    return {
      title: "Employee Record | Final Payroll System",
      description: "Employee profile record.",
    }
  }
}

export default async function EmployeeProfileRoutePage({ params }: EmployeeProfileRouteProps) {
  const { companyId, employeeId } = await params

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

  const data = await getEmployeeProfileViewModel(company.companyId, employeeId)

  if (!data) {
    notFound()
  }

  return <EmployeeProfilePage data={data} />
}
