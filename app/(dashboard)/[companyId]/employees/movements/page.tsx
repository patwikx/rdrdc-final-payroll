import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { EmployeeMovementsPage } from "@/modules/employees/movements/components/employee-movements-page"
import { getEmployeeMovementsViewModel } from "@/modules/employees/movements/utils/get-employee-movements-data"

type EmployeeMovementsRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ variant?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Employee Movements | ${company.companyName} | Final Payroll System`,
      description: `Manage employee movement records for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Employee Movements | Final Payroll System",
      description: "Manage employee movement records.",
    }
  }
}

export default async function EmployeeMovementsRoutePage({ params, searchParams }: EmployeeMovementsRouteProps) {
  const { companyId } = await params
  const { variant } = (await searchParams) ?? {}
  const parsedVariant = Number(variant)
  const designVariant = [1, 2, 3, 4, 5].includes(parsedVariant) ? (parsedVariant as 1 | 2 | 3 | 4 | 5) : 1

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

  const data = await getEmployeeMovementsViewModel(company.companyId)

  return <EmployeeMovementsPage data={data} designVariant={designVariant} />
}
