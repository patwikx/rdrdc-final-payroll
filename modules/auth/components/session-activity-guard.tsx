"use client"

import { getSession, signOut } from "next-auth/react"
import { useEffect, useRef } from "react"

type SessionActivityGuardProps = {
  inactivityTimeoutMs?: number
}

const DEFAULT_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000
const KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000

export function SessionActivityGuard({
  inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
}: SessionActivityGuardProps) {
  const lastActivityAtRef = useRef<number>(0)
  const alreadySigningOutRef = useRef<boolean>(false)
  const lastKeepAliveAtRef = useRef<number>(0)

  useEffect(() => {
    lastActivityAtRef.current = Date.now()
    lastKeepAliveAtRef.current = Date.now()

    const markActive = () => {
      lastActivityAtRef.current = Date.now()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markActive()
      }
    }

    const signOutForReason = async (reason: "inactive" | "expired") => {
      if (alreadySigningOutRef.current) {
        return
      }

      alreadySigningOutRef.current = true
      await signOut({ callbackUrl: `/login?reason=${reason}` })
    }

    const tick = () => {
      const now = Date.now()

      if (now - lastActivityAtRef.current >= inactivityTimeoutMs) {
        void signOutForReason("inactive")
        return
      }

      const isVisible = document.visibilityState === "visible"
      const isRecentlyActive = now - lastActivityAtRef.current < inactivityTimeoutMs
      const shouldKeepAlive = now - lastKeepAliveAtRef.current >= KEEP_ALIVE_INTERVAL_MS

      if (isVisible && isRecentlyActive && shouldKeepAlive) {
        lastKeepAliveAtRef.current = now
        void getSession()
      }
    }

    const intervalId = window.setInterval(tick, 15_000)

    window.addEventListener("mousemove", markActive)
    window.addEventListener("mousedown", markActive)
    window.addEventListener("keydown", markActive)
    window.addEventListener("scroll", markActive)
    window.addEventListener("touchstart", markActive)
    window.addEventListener("focus", markActive)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("mousemove", markActive)
      window.removeEventListener("mousedown", markActive)
      window.removeEventListener("keydown", markActive)
      window.removeEventListener("scroll", markActive)
      window.removeEventListener("touchstart", markActive)
      window.removeEventListener("focus", markActive)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [inactivityTimeoutMs])

  return null
}
