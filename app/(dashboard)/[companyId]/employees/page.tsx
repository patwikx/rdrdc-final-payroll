import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { EmployeeMasterlistPage } from "@/modules/employees/masterlist/components/employee-masterlist-page"
import { getEmployeeMasterlistViewModel } from "@/modules/employees/masterlist/utils/get-employee-masterlist-data"

type EmployeeMasterlistRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Employee Masterlist | ${company.companyName} | Final Payroll System`,
      description: `View employee records for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Employee Masterlist | Final Payroll System",
      description: "View employee records.",
    }
  }
}

export default async function EmployeeMasterlistRoutePage({ params }: EmployeeMasterlistRouteProps) {
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

  const data = await getEmployeeMasterlistViewModel(company.companyId)
  const session = await auth()
  const canDeleteEmployees =
    data.companyRole === "COMPANY_ADMIN" || session?.user?.role === "SUPER_ADMIN"

  return (
    <EmployeeMasterlistPage
      companyId={company.companyId}
      companyName={data.companyName}
      employees={data.employees}
      canDeleteEmployees={canDeleteEmployees}
    />
  )
}
