"use client"

import { useEffect } from "react"
import { IconAlertTriangle } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-start justify-center gap-3 px-4 py-8 sm:px-6">
      <h1 className="inline-flex items-center gap-2 text-xl font-semibold text-foreground"><IconAlertTriangle className="size-5" /> Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The app hit an unexpected error. You can try again, or return to setup if this is a new install.
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={() => (window.location.href = "/setup")}>
          Open setup
        </Button>
      </div>
    </main>
  )
}
