import { Skeleton } from "@/components/ui/skeleton"

export default function AttendanceSchedulesLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <header className="border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </header>

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden border border-border/60 bg-background">
            <div className="space-y-3 border-b border-border/60 bg-muted/10 px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
              <Skeleton className="h-3 w-72" />
            </div>

            <div className="grid grid-cols-7 border-b border-border/60 bg-muted/10">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={String(index)} className="border-r border-border/60 px-2 py-2 last:border-r-0">
                  <Skeleton className="mx-auto h-3 w-8" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, index) => (
                <div key={String(index)} className="min-h-[128px] border-b border-r border-border/60 p-2.5">
                  <Skeleton className="h-5 w-8" />
                  <Skeleton className="mt-2 h-3 w-16" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-1 h-4 w-[80%]" />
                </div>
              ))}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border border-border/60 bg-background">
            <div className="space-y-2 border-b border-border/60 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-4 w-56" />
            </div>

            <div className="h-[56vh] min-h-[300px] space-y-3 px-4 py-3 lg:h-[calc(100vh-320px)]">
              <div className="space-y-2 border border-border/60 bg-muted/20 px-3 py-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={String(index)} className="flex items-center gap-2 border border-border/60 bg-background px-3 py-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3 w-52" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
