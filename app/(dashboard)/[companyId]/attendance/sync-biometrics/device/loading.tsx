import { Skeleton } from "@/components/ui/skeleton"

export default function SyncBiometricsDeviceLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <header className="border-b border-border/60 bg-muted/20 px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-6 w-36" />
            </div>
            <Skeleton className="h-4 w-[560px] max-w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </header>

      <main className="grid gap-3 p-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="border border-border/60 bg-background">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-16" />
          </div>

          <div className="h-[300px] space-y-2 border-b border-border/60 p-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={String(index)} className="space-y-1.5 border border-border/60 px-2 py-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-14" />
                </div>
                <Skeleton className="h-3 w-44" />
              </div>
            ))}
          </div>

          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-20" />
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={String(index)} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
            <Skeleton className="h-9 w-full" />
          </div>
        </section>

        <section className="space-y-3">
          <section className="border border-border/60 bg-background">
            <div className="grid gap-3 border-b border-border/60 px-4 py-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-1">
                <Skeleton className="h-4 w-72 max-w-full" />
                <Skeleton className="h-3 w-[460px] max-w-full" />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="sm:col-span-2 xl:col-span-2 space-y-1">
                <Skeleton className="h-3 w-[420px] max-w-full" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>

            <div className="grid gap-3 px-4 py-3 md:grid-cols-2 xl:max-w-[560px]">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>

            <div className="space-y-2 border-t border-border/60 px-4 py-3">
              <Skeleton className="h-3 w-44" />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Skeleton className="h-9 w-full" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </div>
              <Skeleton className="h-12 w-full" />
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="border border-border/60 bg-background">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <Skeleton className="h-4 w-36" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-14" />
                  <Skeleton className="h-6 w-14" />
                </div>
              </div>
              <div className="h-[420px] space-y-2 px-4 py-3">
                {Array.from({ length: 16 }).map((_, index) => (
                  <Skeleton key={String(index)} className="h-3 w-full" />
                ))}
              </div>
            </div>

            <div className="border border-border/60 bg-background">
              <div className="border-b border-border/60 px-4 py-3">
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="space-y-2 px-4 py-3">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={String(index)} className="flex items-center justify-between border border-border/60 px-2 py-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-border/60 px-4 py-3">
                <Skeleton className="h-3 w-36" />
                <div className="h-[180px] border border-border/60 bg-muted/20 p-2 space-y-1.5">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton key={String(index)} className="h-3 w-full" />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>
      </main>
    </main>
  )
}
