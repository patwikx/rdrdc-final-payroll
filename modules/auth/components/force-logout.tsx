"use client"

import { motion } from "framer-motion"
import { signOut } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

const reasonMessageMap: Record<string, string> = {
  "invalid-session": "Your session is no longer valid for this system. Please sign in again.",
  inactive: "Your session ended due to inactivity.",
  expired: "Your session has expired. Please sign in again.",
}

export function ForceLogout() {
  const searchParams = useSearchParams()
  const reason = searchParams.get("reason") ?? "invalid-session"
  const heading = reason === "invalid-session" ? "Invalid session" : "Signing out"
  const detail =
    reason === "invalid-session"
      ? "Redirecting you to login page"
      : "Redirecting you to login"

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void signOut({ callbackUrl: `/login?reason=${encodeURIComponent(reason)}` })
    }, 1200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [reason])

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-primary/10" />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border/70 bg-card/80 p-6 shadow-xl backdrop-blur"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="text-sm font-medium text-foreground">{heading}</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{detail}...</p>
        <p className="mt-3 text-xs text-muted-foreground/90">{reasonMessageMap[reason] ?? "Signing you out securely..."}</p>
      </motion.div>
    </main>
  )
}
