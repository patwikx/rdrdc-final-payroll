import { Skeleton } from "@/components/ui/skeleton"

export default function PayrollRunsLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <header className="border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </header>

      <div className="space-y-4 px-4 py-6 sm:px-6">
        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="grid gap-px bg-border/60 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={String(index)} className="space-y-2 bg-background px-3 py-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="flex flex-col gap-3 border-b border-border/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-[280px]" />
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-9 w-24" />
            </div>
            <Skeleton className="h-9 w-36" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-muted/20">
                <tr className="border-b border-border/60">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <th key={String(index)} className="px-3 py-2 text-left">
                      <Skeleton className="h-3 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }).map((_, index) => (
                  <tr key={String(index)} className="border-b border-border/50">
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="mt-1 h-3 w-20" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="mt-1 h-3 w-16" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-3 w-44" />
                      <Skeleton className="mt-2 h-1.5 w-40" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-3 w-24" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-6 w-20" />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Skeleton className="h-7 w-16" />
                        <Skeleton className="h-7 w-14" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
            <Skeleton className="h-3 w-36" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-7 w-14" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
