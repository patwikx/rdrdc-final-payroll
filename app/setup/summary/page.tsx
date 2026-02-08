import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SetupWizardSummaryForm } from "@/modules/setup/components/setup-wizard-summary-form"
import { getSetupState } from "@/modules/setup/utils/setup-state"

export const metadata: Metadata = {
  title: "Setup Summary | Final Payroll System",
  description: "Review setup details and confirm final system initialization.",
}

export default async function SetupSummaryPage() {
  const setupState = await getSetupState()

  if (setupState.isInitialized) {
    redirect("/login")
  }

  return <SetupWizardSummaryForm />
}
