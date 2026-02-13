import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { NewCompanySetupPage } from "@/modules/settings/company/components/new-company-setup-page"

type NewCompanySetupRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `New Company Setup | ${company.companyName} | Final Payroll System`,
      description: `Create an additional company workspace for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "New Company Setup | Final Payroll System",
      description: "Create an additional company workspace.",
    }
  }
}

export default async function NewCompanySetupRoutePage({ params }: NewCompanySetupRouteProps) {
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

  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  if (!isSuperAdmin && company.companyRole !== "COMPANY_ADMIN") {
    return (
      <main className="flex w-full flex-col gap-2 px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold text-foreground">Access Restricted</h1>
        <p className="text-sm text-muted-foreground">
          Only Company Admin can create additional companies from this workspace.
        </p>
      </main>
    )
  }

  const parentCompanyOptions = await db.company.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: [{ name: "asc" }],
  })

  return (
    <NewCompanySetupPage
      sourceCompanyId={company.companyId}
      sourceCompanyName={company.companyName}
      parentCompanyOptions={parentCompanyOptions}
    />
  )
}
