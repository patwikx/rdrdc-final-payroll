import Link from "next/link"
import { IconMapOff } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-start justify-center gap-3 px-4 py-8 sm:px-6">
      <h1 className="inline-flex items-center gap-2 text-xl font-semibold text-foreground"><IconMapOff className="size-5" /> Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you requested does not exist.</p>
      <Button asChild>
        <Link href="/">Return to home</Link>
      </Button>
    </main>
  )
}
