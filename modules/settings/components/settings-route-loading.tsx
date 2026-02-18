import { Skeleton } from "@/components/ui/skeleton"

export function SettingsRouteLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <section className="border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="h-4 w-[520px] max-w-full" />
        </div>
      </section>

      <section className="grid gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3 border border-border/60 bg-background p-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </aside>

        <section className="space-y-4">
          <div className="overflow-hidden border border-border/60 bg-background">
            <div className="grid grid-cols-2 gap-px bg-border/60 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={String(index)} className="space-y-2 bg-background px-3 py-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-20" />
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden border border-border/60 bg-background">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-8 w-28" />
            </div>

            <div className="space-y-3 p-4">
              <Skeleton className="h-9 w-full" />

              <div className="overflow-x-auto border border-border/60">
                <table className="w-full min-w-[860px]">
                  <thead className="bg-muted/20">
                    <tr>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <th key={String(index)} className="px-3 py-2 text-left">
                          <Skeleton className="h-3 w-20" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 7 }).map((_, rowIndex) => (
                      <tr key={String(rowIndex)} className="border-t border-border/50">
                        {Array.from({ length: 6 }).map((__, cellIndex) => (
                          <td key={`${String(rowIndex)}-${String(cellIndex)}`} className="px-3 py-2.5">
                            <Skeleton className="h-3 w-24" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <Skeleton className="h-3 w-40" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-8 w-14" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
