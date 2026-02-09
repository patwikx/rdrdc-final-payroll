import type { Metadata } from "next"
import { Suspense } from "react"

import { ForceLogout } from "@/modules/auth/components/force-logout"

export const metadata: Metadata = {
  title: "Logging Out | RD Realty Group HRIS System",
  description: "Ending your session securely.",
}

export default function LogoutPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <ForceLogout />
    </Suspense>
  )
}
