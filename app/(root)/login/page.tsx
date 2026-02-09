import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"

import { LoginPage } from "@/modules/auth/components/login-page"
import { getSetupState } from "@/modules/setup/utils/setup-state"

export const metadata: Metadata = {
  title: "Login | RD Realty Group HRIS System",
  description: "Secure sign in for payroll and HR operations.",
}

export default async function LoginRoutePage() {
  const setupState = await getSetupState()

  if (!setupState.isInitialized) {
    redirect("/setup")
  }

  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <LoginPage />
    </Suspense>
  )
}
