import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { SetupWizardForm } from "@/modules/setup/components/setup-wizard-form"
import { getSetupState } from "@/modules/setup/utils/setup-state"

export const metadata: Metadata = {
  title: "Setup Wizard | Final Payroll System",
  description: "Configure super admin, company, payroll, attendance, leave, overtime, and statutory defaults.",
}

export default async function SetupPage() {
  const setupState = await getSetupState()

  if (setupState.isInitialized) {
    const session = await auth()

    if (session?.user) {
      redirect("/dashboard")
    }

    redirect("/login")
  }

  return <SetupWizardForm />
}
