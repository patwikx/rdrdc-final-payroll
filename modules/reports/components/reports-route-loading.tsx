import { Skeleton } from "@/components/ui/skeleton"

export function ReportsRouteLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <section className="border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-[620px] max-w-full" />
        </div>
      </section>

      <section className="space-y-4 px-4 py-4 sm:px-6">
        <div className="overflow-hidden border border-border/60 bg-background">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
            <Skeleton className="h-9 w-full sm:w-80" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>

          <div className="grid grid-cols-2 gap-px bg-border/60 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={String(index)} className="space-y-2 bg-background px-3 py-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border-t border-border/60">
            <table className="w-full min-w-[980px]">
              <thead className="bg-muted/20">
                <tr>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <th key={String(index)} className="px-3 py-2 text-left">
                      <Skeleton className="h-3 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, rowIndex) => (
                  <tr key={String(rowIndex)} className="border-t border-border/50">
                    {Array.from({ length: 8 }).map((__, cellIndex) => (
                      <td key={`${String(rowIndex)}-${String(cellIndex)}`} className="px-3 py-2.5">
                        <Skeleton className="h-3 w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
            <Skeleton className="h-3 w-44" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-8 w-14" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
