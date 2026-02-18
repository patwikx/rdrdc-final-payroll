import { Skeleton } from "@/components/ui/skeleton"

export default function LeaveBalancesLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <section className="border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-6 w-36" />
            </div>
            <Skeleton className="h-4 w-[520px] max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-8 w-44" />
          </div>
        </div>
      </section>

      <div className="grid border-y border-border/60 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-border/60 p-4 sm:p-5">
          <div className="space-y-3 border border-border/60 bg-background p-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>

          <div className="mt-3 border border-border/60 bg-background">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-8" />
            </div>
            <div className="space-y-1.5 p-2">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={String(index)} className="flex items-start gap-2 border border-border/60 px-2.5 py-2">
                  <Skeleton className="h-9 w-9 shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-[calc(100vh-220px)] flex-col gap-4 p-4 sm:p-5">
          <section className="border border-border/60 bg-background px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={String(index)} className="space-y-2 border border-border/60 bg-background px-3 py-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>

          <section className="border border-border/60 bg-background">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
            <div className="space-y-3 p-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={String(index)} className="space-y-2 border border-border/60 px-2 py-2">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </section>

          <section className="flex flex-1 flex-col border border-border/60 bg-background">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="flex-1 space-y-3 p-4">
              <div className="border border-border/60">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px]">
                    <thead className="bg-muted/30">
                      <tr>
                        {Array.from({ length: 7 }).map((_, index) => (
                          <th key={String(index)} className="px-3 py-2 text-left">
                            <Skeleton className="h-3 w-16" />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 8 }).map((_, index) => (
                        <tr key={String(index)} className="border-t border-border/50">
                          {Array.from({ length: 7 }).map((__, cellIndex) => (
                            <td key={`${String(index)}-${String(cellIndex)}`} className="px-3 py-2">
                              <Skeleton className="h-3 w-20" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                <Skeleton className="h-3 w-40" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-8 w-14" />
                </div>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}
