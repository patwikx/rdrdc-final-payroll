import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { EmployeeOnboardingPage } from "@/modules/employees/onboarding/components/employee-onboarding-page"
import { getEmployeeOnboardingViewModel } from "@/modules/employees/onboarding/utils/get-employee-onboarding-data"

type EmployeeOnboardingRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Employee Onboarding | ${company.companyName} | Final Payroll System`,
      description: `Create and onboard employees for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Employee Onboarding | Final Payroll System",
      description: "Create and onboard employees.",
    }
  }
}

export default async function EmployeeOnboardingRoutePage({ params }: EmployeeOnboardingRouteProps) {
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

  const onboardingData = await getEmployeeOnboardingViewModel(company.companyId)

  return (
    <EmployeeOnboardingPage
      companyName={onboardingData.companyName}
      initialData={onboardingData.form}
      options={onboardingData.options}
    />
  )
}
