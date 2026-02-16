import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { IconBuildingOff, IconUserCircle } from "@tabler/icons-react"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { AccountSettingsPage } from "@/modules/account/components/account-settings-page"
import { getAccountSettingsViewModel } from "@/modules/account/utils/get-account-settings-view-model"

type AccountRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Account Settings | ${company.companyName} | Final Payroll System`,
      description: "Manage your account profile and security settings.",
    }
  } catch {
    return {
      title: "Account Settings | Final Payroll System",
      description: "Manage your account profile and security settings.",
    }
  }
}

export default async function AccountRoutePage({ params }: AccountRouteProps) {
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
          <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground">
            <IconBuildingOff className="size-5" />
            No Company Access
          </h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have an active company assignment yet. Please contact your administrator.
          </p>
        </main>
      )
    }
  }

  const viewModel = await getAccountSettingsViewModel(company)

  if (!viewModel) {
    return (
      <main className="flex w-full flex-col gap-2 px-4 py-6 sm:px-6">
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground">
          <IconUserCircle className="size-5" />
          Account Settings
        </h1>
        <p className="text-sm text-muted-foreground">Unable to load your account details right now.</p>
      </main>
    )
  }

  return (
    <AccountSettingsPage
      companyId={viewModel.companyId}
      companyName={viewModel.companyName}
      initialProfile={viewModel.user}
    />
  )
}
