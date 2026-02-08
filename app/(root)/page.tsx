import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getSetupState } from "@/modules/setup/utils/setup-state"

export const metadata: Metadata = {
  title: "Welcome | Final Payroll System",
  description: "Multi-company payroll platform entry point.",
}

export default async function RootPage() {
  const setupState = await getSetupState()

  if (!setupState.isInitialized) {
    redirect("/setup")
  }

  redirect("/login")
}
