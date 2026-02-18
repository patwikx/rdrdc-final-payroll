import { Skeleton } from "@/components/ui/skeleton"

export default function DailyTimeRecordLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <div className="border-b border-border/60 bg-muted/20 px-6 py-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-[320px]" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </div>

      <div className="border-b border-border/60 bg-background/50 px-6">
        <div className="py-2">
          <div className="inline-flex items-center gap-1 border border-border/60 bg-muted/40 p-1">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-230px)] flex-col lg:flex-row">
        <aside className="w-full shrink-0 space-y-3 border-r border-border/60 bg-background/30 p-3 lg:w-72">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-px w-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
          <Skeleton className="h-px w-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="space-y-px border border-border/60 bg-border/60">
              <div className="space-y-1.5 bg-background px-3 py-2.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-10" />
              </div>
              <div className="space-y-1.5 bg-background px-3 py-2.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-10" />
              </div>
              <div className="space-y-1.5 bg-background px-3 py-2.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-10" />
              </div>
            </div>
          </div>
        </aside>

        <section className="flex flex-1 flex-col bg-background">
          <div className="border-b border-border/60 bg-muted/10 px-8">
            <div className="grid h-10 grid-cols-16 items-center gap-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={String(index)} className="h-3 w-full" />
              ))}
            </div>
          </div>

          <div className="flex-1 divide-y divide-border/60">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={String(index)} className="grid grid-cols-16 items-center gap-3 px-8 py-4">
                <div className="col-span-4 flex items-center gap-4">
                  <Skeleton className="h-8 w-8 shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="col-span-2">
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="col-span-2 flex justify-center">
                  <Skeleton className="h-3 w-14" />
                </div>
                <div className="col-span-2 flex justify-center">
                  <Skeleton className="h-3 w-14" />
                </div>
                <div className="col-span-2 flex justify-center">
                  <Skeleton className="h-3 w-10" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <Skeleton className="h-5 w-10" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <Skeleton className="h-5 w-10" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <Skeleton className="h-5 w-10" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Skeleton className="h-7 w-14" />
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 flex h-12 items-center justify-between border-t border-border/60 bg-background px-8">
            <Skeleton className="h-3 w-36" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-8 w-14" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
