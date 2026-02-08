"use client"

import { IconAlertHexagon } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-start justify-center gap-3 px-4 py-8 sm:px-6">
          <h1 className="inline-flex items-center gap-2 text-xl font-semibold"><IconAlertHexagon className="size-5" /> Application Error</h1>
          <p className="text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={reset}>
              Retry
            </Button>
            <Button type="button" variant="outline" onClick={() => (window.location.href = "/") }>
              Go home
            </Button>
          </div>
        </main>
      </body>
    </html>
  )
}
